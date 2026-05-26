import type { Hand, Player } from "../../shared/types";

export type Wind = "E" | "S" | "W" | "N";
export type SeatMap = Record<Wind, string>;

export const WIND_ORDER: Wind[] = ["E", "S", "W", "N"];
export const WIND_LABELS: Record<Wind, string> = {
  E: "東",
  S: "南",
  W: "西",
  N: "北",
};

export const buildParticipationCounts = (hands: Hand[]): Map<string, number> => {
  const counts = new Map<string, number>();
  hands.forEach((hand) => {
    hand.seats.forEach((seat) => {
      counts.set(seat.playerId, (counts.get(seat.playerId) ?? 0) + 1);
    });
  });
  return counts;
};

const shuffleArray = <T,>(items: T[]): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = next[i]!;
    next[i] = next[j]!;
    next[j] = current;
  }
  return next;
};

export const pickPlayersByMinCount = (
  players: Player[],
  counts: Map<string, number>,
  pickCount = 4,
): string[] => {
  const ranked = players
    .map((player) => ({ id: player.id, count: counts.get(player.id) ?? 0 }))
    .sort((a, b) => a.count - b.count);

  const selected: string[] = [];
  let cursor = 0;
  while (selected.length < pickCount && cursor < ranked.length) {
    const targetCount = ranked[cursor]!.count;
    const group: { id: string; count: number }[] = [];
    while (cursor < ranked.length && ranked[cursor]!.count === targetCount) {
      group.push(ranked[cursor]!);
      cursor += 1;
    }
    const remaining = pickCount - selected.length;
    if (group.length <= remaining) {
      selected.push(...group.map((item) => item.id));
      continue;
    }
    const shuffled = shuffleArray(group.map((item) => item.id));
    selected.push(...shuffled.slice(0, remaining));
  }

  return selected.slice(0, pickCount);
};

export const buildSeatMap = (playerIds: string[]): SeatMap => {
  const shuffled = shuffleArray(playerIds).slice(0, 4);
  return {
    E: shuffled[0] ?? "",
    S: shuffled[1] ?? "",
    W: shuffled[2] ?? "",
    N: shuffled[3] ?? "",
  };
};

export const isValidSeatMap = (seatMap: SeatMap | null, validIds: Set<string>): seatMap is SeatMap => {
  if (!seatMap) {
    return false;
  }
  const ids = WIND_ORDER.map((wind) => seatMap[wind]);
  if (ids.some((id) => !id || !validIds.has(id))) {
    return false;
  }
  return new Set(ids).size === WIND_ORDER.length;
};

export const seatMapToOrderedIds = (seatMap: SeatMap | null): string[] => {
  if (!seatMap) {
    return [];
  }
  return WIND_ORDER.map((wind) => seatMap[wind]).filter(Boolean);
};

export const buildSeatMapFromOrder = (playerIds: string[]): SeatMap => ({
  E: playerIds[0] ?? "",
  S: playerIds[1] ?? "",
  W: playerIds[2] ?? "",
  N: playerIds[3] ?? "",
});
