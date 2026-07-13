import type { HandSeat } from "./types.js";
import { ORIGIN_SCORE, RANK_POINTS } from "./rules.js";

export type HandResult = {
  playerId: string;
  score: number;
  rank: number;
  rankPoint: number;
  totalPoint: number;
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

const average = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

export const calculateHandResults = (seats: HandSeat[]): HandResult[] => {
  const indexed = seats.map((seat, index) => ({ ...seat, index }));
  const sorted = [...indexed].sort((a, b) => b.score - a.score);
  const results = new Map<number, { rank: number; rankPoint: number }>();

  let cursor = 0;
  while (cursor < sorted.length) {
    const score = sorted[cursor]!.score;
    const group = sorted.filter((item) => item.score === score);
    const groupStart = cursor + 1;
    const groupEnd = cursor + group.length;
    const pointSlice = RANK_POINTS.slice(groupStart - 1, groupEnd);
    const sharedPoint = average(pointSlice);

    for (const item of group) {
      results.set(item.index, { rank: groupStart, rankPoint: sharedPoint });
    }
    cursor += group.length;
  }

  return indexed.map((seat) => {
    const meta = results.get(seat.index);
    if (!meta) throw new Error("Rank calculation failed");
    const scorePoint = (seat.score - ORIGIN_SCORE) / 1000;
    return {
      playerId: seat.playerId,
      score: seat.score,
      rank: meta.rank,
      rankPoint: meta.rankPoint,
      totalPoint: round1(scorePoint + meta.rankPoint),
    };
  });
};
