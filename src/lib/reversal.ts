import type { Session } from "../../shared/types";
import {
  DEFAULT_MAX_GAP,
  DEFAULT_TOP_GAP_COUNT,
  DEFAULT_TOP_N,
  ORIGIN_SCORE,
  RANK_COSTS,
  RANK_POINTS,
  ceilTo100,
  buildConditionRequirements,
  buildRankGroups,
  buildTotalPoints,
  permute,
} from "./reversalUtils";
import type { ConditionNeedGap } from "./reversalUtils";

export type { ConditionNeedGap } from "./reversalUtils";

export type ConditionScenario = {
  playerId: string;
  seatOrder: string[];
  rank: number;
  needGaps: ConditionNeedGap[];
  needScoreMin: number | null;
  difficulty: number;
};

export type ReverseConditionResult = {
  overallToFirstTopN: ConditionScenario[];
  overallOneUpTopN: ConditionScenario[];
};

export type BaseOnlyCondition = {
  playerId: string;
  needGaps: ConditionNeedGap[];
  needScoreMin: number | null;
};

export type ReverseConditionOptions = {
  topN?: number;
  maxGap?: number;
  topGapCount?: number;
};

export const calculateReverseConditions = (
  session: Session,
  seatPlayerIds: string[],
  options: ReverseConditionOptions = {},
): ReverseConditionResult => {
  if (seatPlayerIds.length !== 4) {
    return { overallToFirstTopN: [], overallOneUpTopN: [] };
  }

  const topN = options.topN ?? DEFAULT_TOP_N;
  const maxGap = options.maxGap ?? DEFAULT_MAX_GAP;
  const topGapCount = options.topGapCount ?? DEFAULT_TOP_GAP_COUNT;
  const totals = buildTotalPoints(session);
  const seatSet = new Set(seatPlayerIds);
  const allTargets = session.players.map((player) => player.id);
  const permutations = permute(seatPlayerIds);
  const rankGroups = buildRankGroups(session, totals);
  const groupIndex = new Map<string, number>();
  rankGroups.forEach((group, index) => {
    group.forEach((playerId) => groupIndex.set(playerId, index));
  });

  const overallToFirstMap = new Map<string, ConditionScenario[]>();
  const overallOneUpMap = new Map<string, ConditionScenario[]>();
  seatPlayerIds.forEach((playerId) => {
    overallToFirstMap.set(playerId, []);
    overallOneUpMap.set(playerId, []);
  });

  permutations.forEach((order) => {
    const bonusByPlayer = new Map<string, number>();
    const rankByPlayer = new Map<string, number>();
    order.forEach((playerId, index) => {
      bonusByPlayer.set(playerId, RANK_POINTS[index]);
      rankByPlayer.set(playerId, index + 1);
    });

    seatPlayerIds.forEach((playerId) => {
      const rank = rankByPlayer.get(playerId) ?? 0;
      const rankCost = RANK_COSTS[rank] ?? 0;

      const toFirst = buildConditionRequirements({
        playerId,
        targets: allTargets,
        totals,
        seatSet,
        bonusByPlayer,
        maxGap,
      });

      if (!toFirst.impossible) {
        const sortedGaps = [...toFirst.needGaps].sort((a, b) => b.gap - a.gap);
        const gapCost =
          sortedGaps.slice(0, topGapCount).reduce((sum, item) => sum + item.gap, 0) /
          1000;
        const ownScoreCost = toFirst.needScoreMin
          ? Math.max(0, toFirst.needScoreMin - ORIGIN_SCORE) / 1000
          : 0;
        const difficulty = rankCost + ownScoreCost + gapCost;

        overallToFirstMap.get(playerId)?.push({
          playerId,
          seatOrder: order,
          rank,
          needGaps: sortedGaps,
          needScoreMin: toFirst.needScoreMin,
          difficulty,
        });
      }

      const playerGroupIndex = groupIndex.get(playerId) ?? 0;
      if (playerGroupIndex === 0) {
        return;
      }
      const targets = rankGroups[playerGroupIndex - 1] ?? [];
      const oneUp = buildConditionRequirements({
        playerId,
        targets,
        totals,
        seatSet,
        bonusByPlayer,
        maxGap,
      });

      if (!oneUp.impossible) {
        const sortedGaps = [...oneUp.needGaps].sort((a, b) => b.gap - a.gap);
        const gapCost =
          sortedGaps.slice(0, topGapCount).reduce((sum, item) => sum + item.gap, 0) / 1000;
        const ownScoreCost = oneUp.needScoreMin
          ? Math.max(0, oneUp.needScoreMin - ORIGIN_SCORE) / 1000
          : 0;
        const difficulty = rankCost + ownScoreCost + gapCost;

        overallOneUpMap.get(playerId)?.push({
          playerId,
          seatOrder: order,
          rank,
          needGaps: sortedGaps,
          needScoreMin: oneUp.needScoreMin,
          difficulty,
        });
      }
    });
  });

  const pickTopN = (map: Map<string, ConditionScenario[]>): ConditionScenario[] => {
    const result: ConditionScenario[] = [];
    map.forEach((scenarios) => {
      const sorted = [...scenarios].sort((a, b) => a.difficulty - b.difficulty);
      result.push(...sorted.slice(0, topN));
    });
    return result;
  };

  return {
    overallToFirstTopN: pickTopN(overallToFirstMap),
    overallOneUpTopN: pickTopN(overallOneUpMap),
  };
};

export const calculateBaseOnlyConditions = (
  session: Session,
  seatPlayerIds: string[],
): BaseOnlyCondition[] => {
  if (seatPlayerIds.length !== 4) {
    return [];
  }
  const totals = buildTotalPoints(session);
  const seatSet = new Set(seatPlayerIds);
  const allTargets = session.players.map((player) => player.id);

  return seatPlayerIds.map((playerId) => {
    const totalP = totals.get(playerId) ?? 0;
    const needGaps: ConditionNeedGap[] = [];
    let needScoreMin = 0;

    allTargets.forEach((targetId) => {
      if (targetId === playerId) {
        return;
      }
      const totalQ = totals.get(targetId) ?? 0;
      const diff = totalQ - totalP;

      if (seatSet.has(targetId)) {
        const needGapRaw = 1000 * diff;
        if (needGapRaw > 0) {
          needGaps.push({ targetId, gap: ceilTo100(needGapRaw) });
        }
        return;
      }

      const needScoreMinRaw = ORIGIN_SCORE + 1000 * diff;
      if (needScoreMinRaw > ORIGIN_SCORE) {
        needScoreMin = Math.max(needScoreMin, ceilTo100(needScoreMinRaw));
      }
    });

    return {
      playerId,
      needGaps: needGaps.sort((a, b) => b.gap - a.gap),
      needScoreMin: needScoreMin > 0 ? needScoreMin : null,
    };
  });
};
