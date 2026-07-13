import type { Session } from "../../shared/types";
import { ORIGIN_SCORE } from "../../shared/rules";
import { calculateHandResults } from "./scoring";

export type ConditionNeedGap = {
  targetId: string;
  gap: number;
};

export { ORIGIN_SCORE, RANK_POINTS } from "../../shared/rules";
export const DEFAULT_TOP_N = 3;
export const DEFAULT_MAX_GAP = 100000;
export const DEFAULT_TOP_GAP_COUNT = 2;
export const RANK_COSTS: Record<number, number> = { 1: 0, 2: 1, 3: 4, 4: 9 };

export const round1 = (value: number): number => Math.round(value * 10) / 10;
export const ceilTo100 = (value: number): number => Math.ceil(value / 100 - 1e-9) * 100;

export const buildTotalPoints = (session: Session): Map<string, number> => {
  const totals = new Map<string, number>();
  session.players.forEach((player) => totals.set(player.id, 0));

  session.hands.forEach((hand) => {
    const results = calculateHandResults(hand.seats);
    results.forEach((result) => {
      const prevTotal = totals.get(result.playerId) ?? 0;
      totals.set(result.playerId, round1(prevTotal + result.totalPoint));
    });
  });

  return totals;
};

export const permute = (items: string[]): string[][] => {
  if (items.length <= 1) {
    return [items];
  }
  const results: string[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    permute(rest).forEach((perm) => results.push([item, ...perm]));
  });
  return results;
};

export const buildRankGroups = (session: Session, totals: Map<string, number>): string[][] => {
  const sorted = [...session.players].sort(
    (a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0),
  );
  const groups: string[][] = [];
  let currentTotal: number | null = null;
  let currentGroup: string[] = [];

  sorted.forEach((player) => {
    const total = totals.get(player.id) ?? 0;
    if (currentTotal === null || total !== currentTotal) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [player.id];
      currentTotal = total;
      return;
    }
    currentGroup.push(player.id);
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

type ConditionInput = {
  playerId: string;
  targets: string[];
  totals: Map<string, number>;
  seatSet: Set<string>;
  bonusByPlayer: Map<string, number>;
  maxGap: number;
};

export const buildConditionRequirements = ({
  playerId,
  targets,
  totals,
  seatSet,
  bonusByPlayer,
  maxGap,
}: ConditionInput): { needGaps: ConditionNeedGap[]; needScoreMin: number | null; impossible: boolean } => {
  const needGaps: ConditionNeedGap[] = [];
  let needScoreMin = 0;
  let impossible = false;
  const bonusP = bonusByPlayer.get(playerId) ?? 0;
  const totalP = totals.get(playerId) ?? 0;

  targets.forEach((targetId) => {
    if (targetId === playerId) {
      return;
    }
    const totalQ = totals.get(targetId) ?? 0;
    const diff = totalQ - totalP;

    if (seatSet.has(targetId)) {
      const bonusQ = bonusByPlayer.get(targetId) ?? 0;
      const needGapRaw = 1000 * (diff - (bonusP - bonusQ));
      if (needGapRaw > 0) {
        const gap = ceilTo100(needGapRaw);
        if (gap > maxGap) {
          impossible = true;
          return;
        }
        needGaps.push({ targetId, gap });
      }
      return;
    }

    const needScoreMinRaw = ORIGIN_SCORE + 1000 * (diff - bonusP);
    if (needScoreMinRaw > ORIGIN_SCORE) {
      const scoreMin = ceilTo100(needScoreMinRaw);
      needScoreMin = Math.max(needScoreMin, scoreMin);
    }
  });

  return { needGaps, needScoreMin: needScoreMin > 0 ? needScoreMin : null, impossible };
};
