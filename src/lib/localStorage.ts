import type { Session } from "../../shared/types";

const SESSION_KEY = "mjscore.session";
const META_KEY = "mjscore.sessionMeta";

export type SessionMeta = {
  version: number;
  updatedAt: string;
  dirty: boolean;
  lastLocalChangeAt: number;
  lastSyncSuccessAt: number;
  lastSyncError?: {
    message: string;
    at: number;
  } | null;
};

export const loadLocalSession = (): Session | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
};

export const saveLocalSession = (session: Session): void => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const normalizeMeta = (raw: Partial<SessionMeta>): SessionMeta => ({
  version: raw.version ?? 0,
  updatedAt: raw.updatedAt ?? "",
  dirty: raw.dirty ?? false,
  lastLocalChangeAt: raw.lastLocalChangeAt ?? 0,
  lastSyncSuccessAt: raw.lastSyncSuccessAt ?? 0,
  lastSyncError: raw.lastSyncError ?? null,
});

export const loadLocalMeta = (): SessionMeta | null => {
  const raw = localStorage.getItem(META_KEY);
  if (!raw) {
    return null;
  }
  try {
    return normalizeMeta(JSON.parse(raw) as Partial<SessionMeta>);
  } catch {
    return null;
  }
};

export const saveLocalMeta = (meta: SessionMeta): void => {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
};
