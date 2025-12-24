import type { Session } from "../../shared/types";

const SESSION_KEY = "mjscore.session";
const META_KEY = "mjscore.sessionMeta";

export type SessionMeta = {
  version: number;
  updatedAt: string;
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

export const loadLocalMeta = (): SessionMeta | null => {
  const raw = localStorage.getItem(META_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }
};

export const saveLocalMeta = (meta: SessionMeta): void => {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
};
