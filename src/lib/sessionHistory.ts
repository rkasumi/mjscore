import { parseSession, parseSessionEnvelope } from "../../shared/sessionValidation";
import type {
  Player,
  SessionDetail,
  SessionEnvelope,
  SessionStatus,
  SessionSummary,
} from "../../shared/types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStatus = (value: unknown): value is SessionStatus =>
  value === "active" || value === "finalized" || value === "voided";

const parseSummary = (value: unknown): SessionSummary => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isStatus(value.status) ||
    typeof value.handsCount !== "number" ||
    !Array.isArray(value.playerNames) ||
    !value.playerNames.every((name) => typeof name === "string") ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !(value.finalizedAt === null || typeof value.finalizedAt === "string")
  ) {
    throw new Error("Invalid session summary");
  }
  if (!(value.day === undefined || typeof value.day === "string")) {
    throw new Error("Invalid session day");
  }
  if (!(value.label === undefined || typeof value.label === "string")) {
    throw new Error("Invalid session label");
  }
  return {
    id: value.id,
    day: value.day,
    label: value.label,
    status: value.status,
    handsCount: value.handsCount,
    playerNames: value.playerNames,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    finalizedAt: value.finalizedAt,
  };
};

const readJson = async (response: Response): Promise<unknown> => {
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === "string" ? payload.error : "API error";
    throw new Error(message);
  }
  return payload;
};

export const fetchSessionHistory = async (): Promise<SessionSummary[]> => {
  const payload = await readJson(await fetch(`${apiBaseUrl}/sessions`));
  if (!isRecord(payload) || !Array.isArray(payload.sessions)) {
    throw new Error("Invalid session history response");
  }
  return payload.sessions.map(parseSummary);
};

export const fetchSessionDetail = async (id: string): Promise<SessionDetail> => {
  const payload = await readJson(await fetch(`${apiBaseUrl}/sessions/${encodeURIComponent(id)}`));
  if (!isRecord(payload)) {
    throw new Error("Invalid session detail response");
  }
  return {
    summary: parseSummary(payload.summary),
    session: parseSession(payload.session),
  };
};

type StoredPlayers = {
  players: Player[];
  knownPlayers: Player[];
};

const parseStoredPlayer = (value: unknown): Player => {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    throw new Error("Invalid stored player");
  }
  return { id: value.id, name: value.name };
};

export const fetchStoredPlayers = async (): Promise<StoredPlayers> => {
  const payload = await readJson(await fetch(`${apiBaseUrl}/players`));
  if (!isRecord(payload) || !Array.isArray(payload.players)) {
    throw new Error("Invalid players response");
  }
  const players = payload.players.map(parseStoredPlayer);
  const knownPlayers = Array.isArray(payload.knownPlayers)
    ? payload.knownPlayers.map(parseStoredPlayer)
    : players;
  return { players, knownPlayers };
};

const mutateSession = async (
  id: string,
  action: "finalize" | "reopen" | "void",
  baseVersion: number,
): Promise<SessionEnvelope> => {
  const response = await fetch(
    `${apiBaseUrl}/sessions/${encodeURIComponent(id)}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseVersion }),
    },
  );
  return parseSessionEnvelope(await readJson(response));
};

export const reopenStoredSession = (id: string, baseVersion: number): Promise<SessionEnvelope> =>
  mutateSession(id, "reopen", baseVersion);

export const finalizeStoredSession = (id: string, baseVersion: number): Promise<SessionEnvelope> =>
  mutateSession(id, "finalize", baseVersion);

export const voidStoredSession = (id: string, baseVersion: number): Promise<SessionEnvelope> =>
  mutateSession(id, "void", baseVersion);
