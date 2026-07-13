import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import { isDateOnly, parseSession } from "../shared/sessionValidation.js";
import type {
  Hand,
  HandSeat,
  Player,
  Session,
  SessionEnvelope,
  Season,
  SessionStatus,
  SessionSummary,
} from "../shared/types.js";

const SCHEMA_VERSION = 2;

const asString = (value: SQLOutputValue | undefined, field: string): string => {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${field} in database`);
  }
  return value;
};

const asNullableString = (value: SQLOutputValue | undefined): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: SQLOutputValue | undefined, field: string): number => {
  if (typeof value !== "number") {
    throw new Error(`Invalid ${field} in database`);
  }
  return value;
};

const isStatus = (value: string): value is SessionStatus =>
  value === "active" || value === "finalized" || value === "voided";

export class SessionConflictError extends Error {
  constructor(readonly current: SessionEnvelope) {
    super("Session version conflict");
    this.name = "SessionConflictError";
  }
}

export class LegacyDataMigrationRequiredError extends Error {
  constructor(readonly legacyPath: string) {
    super(`Legacy data exists at ${legacyPath}; run the JSON migration before starting the API`);
    this.name = "LegacyDataMigrationRequiredError";
  }
}

type RepositoryOptions = {
  allowLegacyData?: boolean;
};

export class SessionRepository {
  private readonly db: DatabaseSync;

  constructor(
    readonly databasePath: string,
    options: RepositoryOptions = {},
  ) {
    const directory = path.dirname(databasePath);
    mkdirSync(directory, { recursive: true });
    const legacyPath = path.join(directory, "session.json");
    if (!options.allowLegacyData && !existsSync(databasePath) && existsSync(legacyPath)) {
      throw new LegacyDataMigrationRequiredError(legacyPath);
    }
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = FULL");
    this.initializeSchema();
    const legacyImport = this.db
      .prepare("SELECT value FROM metadata WHERE key = 'legacy_import_completed'")
      .get();
    if (
      !options.allowLegacyData &&
      existsSync(legacyPath) &&
      legacyImport?.value !== "1"
    ) {
      this.db.close();
      throw new LegacyDataMigrationRequiredError(legacyPath);
    }
  }

  close(): void {
    this.db.close();
  }

  readEnvelope(): SessionEnvelope {
    const version = this.readMetaNumber("global_version");
    const updatedAt = this.readMetaString("updated_at");
    const row = this.db
      .prepare("SELECT id FROM sessions WHERE status = 'active' LIMIT 1")
      .get();
    const session = row ? this.readSession(asString(row.id, "session id")) : null;
    return { version, updatedAt, session };
  }

  saveActiveSession(sessionValue: unknown, baseVersion: number): SessionEnvelope {
    const session = parseSession(sessionValue);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.readEnvelope();
      if (current.version !== baseVersion) {
        throw new SessionConflictError(current);
      }

      const now = new Date().toISOString();
      const nextVersion = current.version + 1;
      if (current.session && current.session.id !== session.id) {
        this.db
          .prepare(
            "UPDATE sessions SET status = 'finalized', finalized_at = ?, updated_at = ? WHERE id = ?",
          )
          .run(now, now, current.session.id);
      }
      this.replaceSession(session, "active", nextVersion, now);
      this.writeMeta("global_version", String(nextVersion));
      this.writeMeta("updated_at", now);
      this.db.exec("COMMIT");
      return { version: nextVersion, updatedAt: now, session };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  importLegacyEnvelope(envelopeValue: unknown): SessionEnvelope {
    if (!envelopeValue || typeof envelopeValue !== "object" || Array.isArray(envelopeValue)) {
      throw new Error("Invalid legacy envelope");
    }
    const candidate = envelopeValue as Record<string, unknown>;
    const version = candidate.version;
    const updatedAt = candidate.updatedAt;
    if (!Number.isInteger(version) || typeof version !== "number" || version < 0) {
      throw new Error("Invalid legacy envelope version");
    }
    if (typeof updatedAt !== "string" || Number.isNaN(Date.parse(updatedAt))) {
      throw new Error("Invalid legacy envelope timestamp");
    }
    const session = candidate.session === null ? null : parseSession(candidate.session);

    this.db.exec("BEGIN IMMEDIATE");
    try {
      const countRow = this.db.prepare("SELECT COUNT(*) AS count FROM sessions").get();
      if (asNumber(countRow?.count, "session count") > 0 || this.readMetaNumber("global_version") > 0) {
        throw new Error("Database is not empty");
      }
      if (session) {
        this.replaceSession(session, "active", version, updatedAt);
      }
      this.writeMeta("global_version", String(version));
      this.writeMeta("updated_at", updatedAt);
      this.writeMeta("legacy_import_completed", "1");
      this.db.exec("COMMIT");
      return { version, updatedAt, session };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listSessions(): SessionSummary[] {
    return this.db
      .prepare(
        `SELECT s.id, s.day, s.label, s.status, s.created_at, s.updated_at, s.finalized_at,
                (SELECT COUNT(*) FROM hands h
                  WHERE h.session_id = s.id AND h.voided_at IS NULL) AS hands_count,
                (SELECT COALESCE(GROUP_CONCAT(ordered.display_name, char(31)), '')
                   FROM (SELECT display_name FROM session_players
                          WHERE session_id = s.id ORDER BY position) ordered) AS player_names
           FROM sessions s
          ORDER BY CASE s.status WHEN 'active' THEN 0 WHEN 'finalized' THEN 1 ELSE 2 END,
                   COALESCE(s.day, substr(s.created_at, 1, 10)) DESC,
                   s.created_at DESC`,
      )
      .all()
      .map((row) => {
        const status = asString(row.status, "session status");
        if (!isStatus(status)) {
          throw new Error("Invalid session status in database");
        }
        const names = asString(row.player_names, "player names");
        return {
          id: asString(row.id, "session id"),
          day: asNullableString(row.day) ?? undefined,
          label: asNullableString(row.label) ?? undefined,
          status,
          handsCount: asNumber(row.hands_count, "hands count"),
          playerNames: names ? names.split(String.fromCharCode(31)) : [],
          createdAt: asString(row.created_at, "created at"),
          updatedAt: asString(row.updated_at, "updated at"),
          finalizedAt: asNullableString(row.finalized_at),
        };
      });
  }

  readSessionDetail(id: string): { summary: SessionSummary; session: Session } | null {
    const session = this.readSession(id);
    const summary = this.listSessions().find((item) => item.id === id);
    return session && summary ? { summary, session } : null;
  }

  listFinalizedSessions(from: string | null, to: string | null): Session[] {
    return this.listSessions()
      .filter((summary) => {
        if (summary.status !== "finalized") return false;
        const day = summary.day ?? summary.createdAt.slice(0, 10);
        return (!from || day >= from) && (!to || day <= to);
      })
      .map((summary) => this.readSession(summary.id))
      .filter((session): session is Session => session !== null);
  }

  listKnownPlayers(): Player[] {
    const latest = this.listSessions().find((summary) => summary.status !== "voided");
    return latest ? (this.readSession(latest.id)?.players ?? []) : [];
  }

  listSeasons(): Season[] {
    return this.db
      .prepare("SELECT id, name, starts_on, ends_on, created_at FROM seasons ORDER BY starts_on DESC")
      .all()
      .map((row) => ({
        id: asString(row.id, "season id"),
        name: asString(row.name, "season name"),
        startsOn: asString(row.starts_on, "season start"),
        endsOn: asString(row.ends_on, "season end"),
        createdAt: asString(row.created_at, "season created at"),
      }));
  }

  createSeason(nameValue: string, startsOn: string, endsOn: string): Season {
    const name = nameValue.trim();
    if (!name || name.length > 100) throw new Error("Invalid season name");
    if (!isDateOnly(startsOn) || !isDateOnly(endsOn)) {
      throw new Error("Invalid season dates");
    }
    if (startsOn > endsOn) throw new Error("Season start must not be after end");
    const season: Season = {
      id: randomUUID(),
      name,
      startsOn,
      endsOn,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        "INSERT INTO seasons(id, name, starts_on, ends_on, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(season.id, season.name, season.startsOn, season.endsOn, season.createdAt);
    return season;
  }

  reopenSession(id: string, baseVersion: number): SessionEnvelope {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.readEnvelope();
      if (current.version !== baseVersion) {
        throw new SessionConflictError(current);
      }
      const target = this.db.prepare("SELECT status FROM sessions WHERE id = ?").get(id);
      if (!target) {
        throw new Error("Session not found");
      }
      if (asString(target.status, "session status") === "voided") {
        throw new Error("Voided session cannot be reopened");
      }
      const now = new Date().toISOString();
      if (current.session && current.session.id !== id) {
        this.db
          .prepare(
            "UPDATE sessions SET status = 'finalized', finalized_at = ?, updated_at = ? WHERE id = ?",
          )
          .run(now, now, current.session.id);
      }
      this.db
        .prepare(
          "UPDATE sessions SET status = 'active', finalized_at = NULL, updated_at = ? WHERE id = ?",
        )
        .run(now, id);
      const nextVersion = current.version + 1;
      this.db.prepare("UPDATE sessions SET version = ? WHERE id = ?").run(nextVersion, id);
      this.writeMeta("global_version", String(nextVersion));
      this.writeMeta("updated_at", now);
      const session = this.readSession(id);
      if (!session) {
        throw new Error("Failed to reopen session");
      }
      this.db.exec("COMMIT");
      return { version: nextVersion, updatedAt: now, session };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  finalizeActiveSession(id: string, baseVersion: number): SessionEnvelope {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.readEnvelope();
      if (current.version !== baseVersion) {
        throw new SessionConflictError(current);
      }
      if (!current.session || current.session.id !== id) {
        throw new Error("Active session not found");
      }
      const now = new Date().toISOString();
      const nextVersion = current.version + 1;
      this.db
        .prepare(
          "UPDATE sessions SET status = 'finalized', version = ?, finalized_at = ?, updated_at = ? WHERE id = ?",
        )
        .run(nextVersion, now, now, id);
      this.writeMeta("global_version", String(nextVersion));
      this.writeMeta("updated_at", now);
      this.db.exec("COMMIT");
      return { version: nextVersion, updatedAt: now, session: null };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  voidSession(id: string, baseVersion: number): SessionEnvelope {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.readEnvelope();
      if (current.version !== baseVersion) {
        throw new SessionConflictError(current);
      }
      const target = this.db.prepare("SELECT status FROM sessions WHERE id = ?").get(id);
      if (!target) {
        throw new Error("Session not found");
      }
      if (asString(target.status, "session status") === "active") {
        throw new Error("Active session cannot be voided");
      }
      const now = new Date().toISOString();
      this.db
        .prepare(
          "UPDATE sessions SET status = 'voided', voided_at = ?, updated_at = ? WHERE id = ?",
        )
        .run(now, now, id);
      const nextVersion = current.version + 1;
      this.writeMeta("global_version", String(nextVersion));
      this.writeMeta("updated_at", now);
      this.db.exec("COMMIT");
      return { version: nextVersion, updatedAt: now, session: current.session };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  readSession(id: string): Session | null {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    if (!row) {
      return null;
    }
    const players: Player[] = this.db
      .prepare(
        "SELECT player_id, display_name FROM session_players WHERE session_id = ? ORDER BY position",
      )
      .all(id)
      .map((playerRow) => ({
        id: asString(playerRow.player_id, "player id"),
        name: asString(playerRow.display_name, "player name"),
      }));
    const hands: Hand[] = this.db
      .prepare(
        "SELECT id, created_at FROM hands WHERE session_id = ? AND voided_at IS NULL ORDER BY sequence",
      )
      .all(id)
      .map((handRow) => {
        const handId = asString(handRow.id, "hand id");
        const seats: HandSeat[] = this.db
          .prepare(
            "SELECT player_id, score FROM hand_results WHERE hand_id = ? ORDER BY seat_index",
          )
          .all(handId)
          .map((seatRow) => ({
            playerId: asString(seatRow.player_id, "seat player id"),
            score: asNumber(seatRow.score, "seat score"),
          }));
        return {
          id: handId,
          createdAt: asString(handRow.created_at, "hand created at"),
          seats,
        };
      });
    return parseSession({
      id: asString(row.id, "session id"),
      createdAt: asString(row.created_at, "session created at"),
      day: asNullableString(row.day) ?? undefined,
      label: asNullableString(row.label) ?? undefined,
      players,
      hands,
    });
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        current_name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        day TEXT,
        label TEXT,
        status TEXT NOT NULL CHECK (status IN ('active', 'finalized', 'voided')),
        ruleset_json TEXT NOT NULL DEFAULT '{"version":1}',
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        finalized_at TEXT,
        voided_at TEXT
      ) STRICT;
      CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active
        ON sessions(status) WHERE status = 'active';
      CREATE TABLE IF NOT EXISTS session_players (
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        player_id TEXT NOT NULL REFERENCES players(id),
        display_name TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (session_id, player_id),
        UNIQUE (session_id, position)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS hands (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        voided_at TEXT,
        UNIQUE (session_id, sequence)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS hand_results (
        hand_id TEXT NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
        player_id TEXT NOT NULL REFERENCES players(id),
        seat_index INTEGER NOT NULL,
        score INTEGER NOT NULL,
        PRIMARY KEY (hand_id, player_id),
        UNIQUE (hand_id, seat_index)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS hands_session_id ON hands(session_id);
      CREATE INDEX IF NOT EXISTS hand_results_player_id ON hand_results(player_id);
      CREATE TABLE IF NOT EXISTS seasons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        starts_on TEXT NOT NULL,
        ends_on TEXT NOT NULL,
        created_at TEXT NOT NULL,
        CHECK (starts_on <= ends_on)
      ) STRICT;
    `);
    const now = new Date().toISOString();
    this.db
      .prepare("INSERT OR IGNORE INTO metadata(key, value) VALUES ('schema_version', ?)")
      .run(String(SCHEMA_VERSION));
    this.db
      .prepare("INSERT OR IGNORE INTO metadata(key, value) VALUES ('global_version', '0')")
      .run();
    this.db
      .prepare("INSERT OR IGNORE INTO metadata(key, value) VALUES ('updated_at', ?)")
      .run(now);
    const schemaVersion = this.readMetaNumber("schema_version");
    if (schemaVersion === 1) {
      this.writeMeta("schema_version", String(SCHEMA_VERSION));
    } else if (schemaVersion !== SCHEMA_VERSION) {
      throw new Error("Unsupported database schema version");
    }
  }

  private replaceSession(
    session: Session,
    status: SessionStatus,
    version: number,
    updatedAt: string,
  ): void {
    for (const player of session.players) {
      this.db
        .prepare(
          `INSERT INTO players(id, current_name, created_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET current_name = excluded.current_name, updated_at = excluded.updated_at`,
        )
        .run(player.id, player.name, updatedAt, updatedAt);
    }
    this.db
      .prepare(
        `INSERT INTO sessions(id, day, label, status, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           day = excluded.day,
           label = excluded.label,
           status = excluded.status,
           version = excluded.version,
           updated_at = excluded.updated_at,
           finalized_at = NULL,
           voided_at = NULL`,
      )
      .run(
        session.id,
        session.day ?? null,
        session.label ?? null,
        status,
        version,
        session.createdAt,
        updatedAt,
      );
    this.db.prepare("DELETE FROM hands WHERE session_id = ?").run(session.id);
    this.db.prepare("DELETE FROM session_players WHERE session_id = ?").run(session.id);
    session.players.forEach((player, position) => {
      this.db
        .prepare(
          "INSERT INTO session_players(session_id, player_id, display_name, position) VALUES (?, ?, ?, ?)",
        )
        .run(session.id, player.id, player.name, position);
    });
    session.hands.forEach((hand, sequence) => {
      this.db
        .prepare("INSERT INTO hands(id, session_id, sequence, created_at) VALUES (?, ?, ?, ?)")
        .run(hand.id, session.id, sequence, hand.createdAt);
      hand.seats.forEach((seat, seatIndex) => {
        this.db
          .prepare(
            "INSERT INTO hand_results(hand_id, player_id, seat_index, score) VALUES (?, ?, ?, ?)",
          )
          .run(hand.id, seat.playerId, seatIndex, seat.score);
      });
    });
  }

  private readMetaString(key: string): string {
    const row = this.db.prepare("SELECT value FROM metadata WHERE key = ?").get(key);
    return asString(row?.value, `metadata ${key}`);
  }

  private readMetaNumber(key: string): number {
    const value = Number(this.readMetaString(key));
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid numeric metadata ${key}`);
    }
    return value;
  }

  private writeMeta(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO metadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }
}

const dataDir = process.env.DATA_DIR ?? "/data";
const databasePath = path.join(dataDir, "mjscore.sqlite");
let defaultRepository: SessionRepository | null = null;

export const getDefaultRepository = (): SessionRepository => {
  defaultRepository ??= new SessionRepository(databasePath);
  return defaultRepository;
};

export const readEnvelope = async (): Promise<SessionEnvelope> =>
  getDefaultRepository().readEnvelope();

export const writeEnvelope = async (
  session: unknown,
  baseVersion: number,
): Promise<SessionEnvelope> => getDefaultRepository().saveActiveSession(session, baseVersion);
