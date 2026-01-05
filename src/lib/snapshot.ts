import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import type { Hand, Session } from "../../shared/types";
import { createId } from "./id";

export type SnapshotV1 = {
  t: "mjscore_snap";
  v: 1;
  d: string;
  p: string[];
  h: [number[], number[]][];
};

const SNAPSHOT_TYPE = "mjscore_snap";
const SNAPSHOT_VERSION = 1;
const HAND_TOTAL = 1000;

const toDateString = (value: string | null | undefined): string => {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
};

const buildPlayerIndex = (session: Session): { names: string[]; map: Map<string, number> } => {
  const usedIds = new Set<string>();
  session.hands.forEach((hand) => {
    hand.seats.forEach((seat) => usedIds.add(seat.playerId));
  });

  const names: string[] = [];
  const map = new Map<string, number>();
  session.players.forEach((player) => {
    if (!usedIds.has(player.id)) {
      return;
    }
    map.set(player.id, names.length);
    names.push(player.name);
  });

  session.hands.forEach((hand) => {
    hand.seats.forEach((seat) => {
      if (map.has(seat.playerId)) {
        return;
      }
      map.set(seat.playerId, names.length);
      names.push("不明");
    });
  });

  return { names, map };
};

const buildSnapshotHand = (hand: Hand, playerMap: Map<string, number>) => {
  const players = hand.seats.map((seat) => playerMap.get(seat.playerId) ?? -1);
  const scores = hand.seats.map((seat) => Math.round(seat.score / 100));
  return [players, scores] as [number[], number[]];
};

export const buildSnapshot = (session: Session): SnapshotV1 => {
  const { names, map } = buildPlayerIndex(session);
  return {
    t: SNAPSHOT_TYPE,
    v: SNAPSHOT_VERSION,
    d: toDateString(session.createdAt),
    p: names,
    h: session.hands.map((hand) => buildSnapshotHand(hand, map)),
  };
};

export const encodeSnapshot = (snapshot: SnapshotV1): string =>
  compressToEncodedURIComponent(JSON.stringify(snapshot));

const isNumberArray = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) &&
  value.length === length &&
  value.every((item) => Number.isFinite(item) && Number.isInteger(item));

const validateSnapshot = (payload: unknown): SnapshotV1 | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidate = payload as SnapshotV1;
  if (candidate.t !== SNAPSHOT_TYPE || candidate.v !== SNAPSHOT_VERSION) {
    return null;
  }
  if (!Array.isArray(candidate.p) || candidate.p.length > 8) {
    return null;
  }
  if (!candidate.p.every((name) => typeof name === "string")) {
    return null;
  }
  if (!Array.isArray(candidate.h)) {
    return null;
  }
  for (const hand of candidate.h) {
    if (!Array.isArray(hand) || hand.length !== 2) {
      return null;
    }
    const [players, scores] = hand;
    if (!isNumberArray(players, 4) || !isNumberArray(scores, 4)) {
      return null;
    }
    const unique = new Set(players);
    if (unique.size !== 4) {
      return null;
    }
    for (const playerIndex of players) {
      if (playerIndex < 0 || playerIndex >= candidate.p.length) {
        return null;
      }
    }
    const sum = scores.reduce((total, score) => total + score, 0);
    if (sum !== HAND_TOTAL) {
      return null;
    }
  }
  if (typeof candidate.d !== "string") {
    return null;
  }
  return candidate;
};

export const decodeSnapshot = (
  encoded: string,
): { snapshot: SnapshotV1 | null; error: string | null } => {
  const raw = decompressFromEncodedURIComponent(encoded);
  if (!raw) {
    return { snapshot: null, error: "共有リンクの形式が不正です。" };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const snapshot = validateSnapshot(parsed);
    if (!snapshot) {
      return { snapshot: null, error: "共有リンクの形式が不正です。" };
    }
    return { snapshot, error: null };
  } catch {
    return { snapshot: null, error: "共有リンクの形式が不正です。" };
  }
};

export const snapshotToSession = (snapshot: SnapshotV1): Session => {
  const baseDate = new Date(`${snapshot.d}T00:00:00Z`);
  const baseTime = Number.isNaN(baseDate.getTime()) ? Date.now() : baseDate.getTime();
  const players = snapshot.p.map((name) => ({ id: createId(), name }));
  const hands = snapshot.h.map(([seatIndexes, scores], index) => ({
    id: createId(),
    createdAt: new Date(baseTime + index * 60000).toISOString(),
    seats: seatIndexes.map((seatIndex, seatPos) => ({
      playerId: players[seatIndex]?.id ?? createId(),
      score: scores[seatPos] * 100,
    })),
  }));

  return {
    id: createId(),
    createdAt: new Date(baseTime).toISOString(),
    players,
    hands,
  };
};
