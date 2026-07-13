import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Session } from "../shared/types.js";
import {
  LegacyDataMigrationRequiredError,
  SessionConflictError,
  SessionRepository,
} from "./storage.js";

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
});
