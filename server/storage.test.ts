import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import type { Session } from "../shared/types.js";
import {
  LegacyDataMigrationRequiredError,
  PlayerIdentityConflictError,
  SessionConflictError,
  SessionRepository,
} from "./storage.js";
import { createSqliteBackup } from "./sqlite-backup.js";

const directories: string[] = [];

const createRepository = (): SessionRepository => {
  const directory = mkdtempSync(path.join(tmpdir(), "mjscore-storage-"));
  directories.push(directory);
  return new SessionRepository(path.join(directory, "mjscore.sqlite"));
};

const createSession = (id = "session-1"): Session => ({
  id,
  createdAt: "2026-07-13T00:00:00.000Z",
  day: "2026-07-13",
  label: "test",
  players: ["a", "b", "c", "d"].map((playerId) => ({
    id: playerId,
    name: playerId.toUpperCase(),
  })),
  hands: [
    {
      id: `${id}-hand-1`,
      createdAt: "2026-07-13T01:00:00.000Z",
      seats: [40000, 30000, 20000, 10000].map((score, index) => ({
        playerId: ["a", "b", "c", "d"][index]!,
        score,
      })),
    },
  ],
});

afterEach(() => {
  while (directories.length > 0) {
    rmSync(directories.pop()!, { recursive: true, force: true });
  }
});

describe("SessionRepository", () => {
  it("stores and reconstructs the active session", () => {
    const repository = createRepository();
    try {
      expect(repository.readEnvelope().session).toBeNull();
      const saved = repository.saveActiveSession(createSession(), 0);
      expect(saved.version).toBe(1);
      expect(repository.readEnvelope()).toEqual(saved);
    } finally {
      repository.close();
    }
  });

  it("rejects stale writes without changing the database", () => {
    const repository = createRepository();
    try {
      const first = repository.saveActiveSession(createSession(), 0);
      const changed = { ...first.session!, label: "stale" };
      expect(() => repository.saveActiveSession(changed, 0)).toThrow(SessionConflictError);
      expect(repository.readEnvelope()).toEqual(first);
    } finally {
      repository.close();
    }
  });

  it("finalizes the previous session when a new id becomes active", () => {
    const repository = createRepository();
    try {
      repository.saveActiveSession(createSession("first"), 0);
      const second = repository.saveActiveSession(createSession("second"), 1);
      expect(second.version).toBe(2);
      expect(repository.listSessions().map((session) => [session.id, session.status])).toEqual([
        ["second", "active"],
        ["first", "finalized"],
      ]);
      expect(repository.readSession("first")).toEqual(createSession("first"));
    } finally {
      repository.close();
    }
  });

  it("reopens a finalized session and finalizes the current one", () => {
    const repository = createRepository();
    try {
      repository.saveActiveSession(createSession("first"), 0);
      repository.saveActiveSession(createSession("second"), 1);
      const reopened = repository.reopenSession("first", 2);
      expect(reopened.version).toBe(3);
      expect(reopened.session?.id).toBe("first");
      expect(repository.listSessions().map((session) => [session.id, session.status])).toEqual([
        ["first", "active"],
        ["second", "finalized"],
      ]);
    } finally {
      repository.close();
    }
  });

  it("finalizes the active session without creating a replacement", () => {
    const repository = createRepository();
    try {
      repository.saveActiveSession(createSession("final"), 0);
      const envelope = repository.finalizeActiveSession("final", 1);
      expect(envelope).toMatchObject({ version: 2, session: null });
      expect(repository.readSessionDetail("final")?.summary.status).toBe("finalized");
      expect(repository.listKnownPlayers()).toEqual(createSession("final").players);
    } finally {
      repository.close();
    }
  });

  it("voids only finalized sessions", () => {
    const repository = createRepository();
    try {
      repository.saveActiveSession(createSession("first"), 0);
      expect(() => repository.voidSession("first", 1)).toThrow(
        "Active session cannot be voided",
      );
      repository.saveActiveSession(createSession("second"), 1);
      const envelope = repository.voidSession("first", 2);
      expect(envelope.version).toBe(3);
      expect(repository.readSessionDetail("first")?.summary.status).toBe("voided");
    } finally {
      repository.close();
    }
  });

  it("filters finalized sessions by day and stores season definitions", () => {
    const repository = createRepository();
    try {
      repository.saveActiveSession({ ...createSession("june"), day: "2026-06-30" }, 0);
      repository.saveActiveSession({ ...createSession("july"), day: "2026-07-01" }, 1);
      repository.saveActiveSession({ ...createSession("active"), day: "2026-08-01" }, 2);
      expect(repository.listFinalizedSessions("2026-07-01", "2026-07-31").map((item) => item.id)).toEqual([
        "july",
      ]);
      const season = repository.createSeason(" 2026年7月 ", "2026-07-01", "2026-07-31");
      expect(repository.listSeasons()).toEqual([{ ...season, name: "2026年7月" }]);
    } finally {
      repository.close();
    }
  });

  it("upgrades a schema version 1 database before using seasons", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mjscore-storage-"));
    directories.push(directory);
    const databasePath = path.join(directory, "mjscore.sqlite");
    const repository = new SessionRepository(databasePath);
    repository.close();

    const oldDatabase = new DatabaseSync(databasePath);
    oldDatabase.exec("DROP TABLE seasons");
    oldDatabase.prepare("UPDATE metadata SET value = '1' WHERE key = 'schema_version'").run();
    oldDatabase.close();

    const upgraded = new SessionRepository(databasePath);
    try {
      const season = upgraded.createSeason("upgrade", "2026-01-01", "2026-12-31");
      expect(upgraded.listSeasons()).toEqual([season]);
    } finally {
      upgraded.close();
    }
  });

  it("imports a valid legacy envelope only into an empty database", () => {
    const repository = createRepository();
    try {
      const imported = repository.importLegacyEnvelope({
        version: 7,
        updatedAt: "2026-07-13T02:00:00.000Z",
        session: createSession(),
      });
      expect(repository.readEnvelope()).toEqual(imported);
      expect(() => repository.importLegacyEnvelope(imported)).toThrow("Database is not empty");
    } finally {
      repository.close();
    }
  });

  it("requires an explicit legacy migration and can reopen the migrated database", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mjscore-storage-"));
    directories.push(directory);
    const databasePath = path.join(directory, "mjscore.sqlite");
    const legacyPath = path.join(directory, "session.json");
    const envelope = {
      version: 3,
      updatedAt: "2026-07-13T02:00:00.000Z",
      session: createSession(),
    };
    writeFileSync(legacyPath, JSON.stringify(envelope), "utf-8");
    expect(() => new SessionRepository(databasePath)).toThrow(
      LegacyDataMigrationRequiredError,
    );

    const migrationRepository = new SessionRepository(databasePath, { allowLegacyData: true });
    migrationRepository.importLegacyEnvelope(envelope);
    migrationRepository.close();

    const reopened = new SessionRepository(databasePath);
    try {
      expect(reopened.readEnvelope()).toEqual(envelope);
    } finally {
      reopened.close();
    }
  });

  it("rejects invalid payloads before writing", () => {
    const repository = createRepository();
    try {
      expect(() => repository.saveActiveSession({ id: "invalid" }, 0)).toThrow(
        "Invalid session payload",
      );
      expect(repository.readEnvelope().session).toBeNull();
    } finally {
      repository.close();
    }
  });

  it("lists the full player catalog and rejects duplicate identity names", () => {
    const repository = createRepository();
    try {
      repository.saveActiveSession(createSession("first"), 0);
      const second = createSession("second");
      const secondIds = ["e", "f", "g", "h"];
      second.players = second.players.map((player, index) => ({
        ...player,
        id: secondIds[index]!,
        name: secondIds[index]!.toUpperCase(),
      }));
      second.hands = second.hands.map((hand) => ({
        ...hand,
        seats: hand.seats.map((seat, index) => ({
          ...seat,
          playerId: secondIds[index]!,
        })),
      }));
      repository.saveActiveSession(second, 1);

      expect(repository.listKnownPlayers()).toEqual(second.players);
      expect(repository.listAllPlayers()).toHaveLength(8);

      const conflicting = {
        ...second,
        players: second.players.map((player, index) =>
          index === 0 ? { ...player, name: " Ａ " } : player,
        ),
      };
      expect(() => repository.saveActiveSession(conflicting, 2)).toThrow(
        PlayerIdentityConflictError,
      );
      expect(repository.readEnvelope().session).toEqual(second);
    } finally {
      repository.close();
    }
  });

  it("creates a checked standalone backup while the WAL database is open", async () => {
    const repository = createRepository();
    const backupPath = path.join(
      path.dirname(repository.databasePath),
      "backups",
      "mjscore.sqlite",
    );
    try {
      repository.saveActiveSession(createSession(), 0);
      expect(
        await createSqliteBackup(repository.databasePath, backupPath),
      ).toBeGreaterThan(0);

      const snapshot = new DatabaseSync(backupPath, { readOnly: true });
      try {
        expect(snapshot.prepare("PRAGMA quick_check").get()).toEqual({ quick_check: "ok" });
        expect(snapshot.prepare("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({
          count: 1,
        });
      } finally {
        snapshot.close();
      }
    } finally {
      repository.close();
    }
  });
});
