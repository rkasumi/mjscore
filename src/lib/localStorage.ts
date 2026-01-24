import type { Session } from "../../shared/types";

const SESSION_KEY = "mjscore.session";
const META_KEY = "mjscore.sessionMeta";
const SEAT_PICKER_PREFIX = "mjscore.seatPicker";

export type SeatPickerMode = "auto" | "manual";
export type SeatPickerFixedSeats = {
  E: string;
  S: string;
  W: string;
  N: string;
};
export type SeatPickerSeatMap = SeatPickerFixedSeats;

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

const seatPickerKey = (sessionId: string, suffix: string): string =>
  `${SEAT_PICKER_PREFIX}.${sessionId}.${suffix}`;

export const loadSeatPickerFixedSeats = (sessionId: string): SeatPickerFixedSeats | null => {
  const raw = localStorage.getItem(seatPickerKey(sessionId, "fixedSeats"));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SeatPickerFixedSeats;
  } catch {
    return null;
  }
};

export const saveSeatPickerFixedSeats = (
  sessionId: string,
  seats: SeatPickerFixedSeats | null,
): void => {
  const key = seatPickerKey(sessionId, "fixedSeats");
  if (!seats) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(seats));
};

export const loadSeatPickerSeatMap = (sessionId: string): SeatPickerSeatMap | null => {
  const raw = localStorage.getItem(seatPickerKey(sessionId, "seatMap"));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SeatPickerSeatMap;
  } catch {
    return null;
  }
};

export const saveSeatPickerSeatMap = (
  sessionId: string,
  seats: SeatPickerSeatMap | null,
): void => {
  const key = seatPickerKey(sessionId, "seatMap");
  if (!seats) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(seats));
};

export const loadSeatPickerMode = (sessionId: string): SeatPickerMode | null => {
  const raw = localStorage.getItem(seatPickerKey(sessionId, "mode"));
  if (!raw) {
    return null;
  }
  return raw === "manual" ? "manual" : raw === "auto" ? "auto" : null;
};

export const saveSeatPickerMode = (sessionId: string, mode: SeatPickerMode): void => {
  localStorage.setItem(seatPickerKey(sessionId, "mode"), mode);
};

export const loadSeatPickerManualSelected = (sessionId: string): string[] => {
  const raw = localStorage.getItem(seatPickerKey(sessionId, "manualSelected"));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
};

export const saveSeatPickerManualSelected = (sessionId: string, ids: string[]): void => {
  localStorage.setItem(seatPickerKey(sessionId, "manualSelected"), JSON.stringify(ids));
};
