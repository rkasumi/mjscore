import type { Hand, Session } from "../../shared/types";
import { ORIGIN_SCORE } from "../../shared/rules";
import { buildSessionAggregate } from "./aggregation";
import {
  calculateTargetRankConditions,
  type ConditionScenario,
} from "./reversal";

const MIN_INTERVAL_MS = 20 * 60 * 1000;
const MAX_INTERVAL_MS = 180 * 60 * 1000;
export const DISPLAY_REALISTIC_MAX_GAP = 30000;
export const DISPLAY_REALISTIC_MAX_SCORE = 60000;
export type DisplayConditionMode = "first" | "rank-up";

export type DisplayRequirement = {
  label: string;
  value: string | null;
};

export type DisplayReverseCard = {
  playerId: string;
  playerName: string;
  currentRank: number;
  targetRank: number | null;
  targetLabel: string;
  ownPlacement: string | null;
  requirements: DisplayRequirement[];
  available: boolean;
  fallback: boolean;
  gapToNextRank: number | null;
  statusMessage: string | null;
};

type DisplayScenarioSelection = {
  scenario: ConditionScenario;
  targetRank: number;
  fallback: boolean;
};

type DisplayTargetScenarios = {
  targetRank: number;
  rivalPlayerIds: string[];
  scenarios: ConditionScenario[];
};

export type PaceEstimate = {
  medianMinutes: number;
  predictedEndAt: Date;
  sampleCount: number;
};

export const calculatePaceEstimate = (
  hands: Hand[],
  now = new Date(),
): PaceEstimate | null => {
  if (hands.length < 3) return null;
  const timestamps = hands.map((hand) => Date.parse(hand.createdAt));
  const intervals: number[] = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    const previous = timestamps[index - 1];
    const current = timestamps[index];
    if (previous === undefined || current === undefined) continue;
    const interval = current - previous;
    if (interval >= MIN_INTERVAL_MS && interval <= MAX_INTERVAL_MS) {
      intervals.push(interval);
    }
  }
  if (intervals.length < 2) return null;
  intervals.sort((a, b) => a - b);
  const center = Math.floor(intervals.length / 2);
  const medianMs =
    intervals.length % 2 === 0
      ? ((intervals[center - 1] ?? 0) + (intervals[center] ?? 0)) / 2
      : (intervals[center] ?? 0);
  const medianMinutes = Math.round(medianMs / 60000);
  return {
    medianMinutes,
    predictedEndAt: new Date(now.getTime() + medianMs),
    sampleCount: intervals.length,
  };
};

const premiseText = (scenario: ConditionScenario, playerMap: Map<string, string>): string =>
  scenario.seatOrder
    .map((playerId, index) => `${playerMap.get(playerId) ?? "不明"}${index + 1}着`)
    .join("・");

const isRankConsistentScenario = (scenario: ConditionScenario): boolean => {
  const playerRank = scenario.seatOrder.indexOf(scenario.playerId);
  if (playerRank < 0) return false;
  return scenario.needGaps.every(
    (gap) => scenario.seatOrder.indexOf(gap.targetId) > playerRank,
  );
};

const isRealisticScenario = (scenario: ConditionScenario): boolean => {
  if (!isRankConsistentScenario(scenario)) return false;
  if (
    scenario.needScoreMin !== null &&
    scenario.needScoreMin > DISPLAY_REALISTIC_MAX_SCORE
  ) {
    return false;
  }
  return scenario.needGaps.every(
    (gap) => gap.gap <= DISPLAY_REALISTIC_MAX_GAP,
  );
};

const compareDisplayScenarios = (
  left: ConditionScenario,
  right: ConditionScenario,
  rivalPlayerIds: string[],
): number => {
  const scoreBurden = (scenario: ConditionScenario): [number, number] => {
    const burdens = scenario.needGaps.map((gap) => gap.gap);
    if (scenario.needScoreMin !== null) {
      burdens.push(Math.max(0, scenario.needScoreMin - ORIGIN_SCORE));
    }
    return [
      Math.max(0, ...burdens),
      burdens.reduce((sum, burden) => sum + burden, 0),
    ];
  };
  const rankBurden = (scenario: ConditionScenario): [number, number] => {
    const playerRank = scenario.seatOrder.indexOf(scenario.playerId);
    const targetIds = new Set([
      ...rivalPlayerIds,
      ...scenario.needGaps.map((gap) => gap.targetId),
    ]);
    const differences = [...targetIds]
      .map((targetId) => scenario.seatOrder.indexOf(targetId))
      .filter((targetRank) => targetRank >= 0)
      .map((targetRank) => Math.abs(targetRank - playerRank));
    return [
      Math.max(0, ...differences),
      differences.reduce((sum, difference) => sum + difference, 0),
    ];
  };

  const [leftMaxScore, leftTotalScore] = scoreBurden(left);
  const [rightMaxScore, rightTotalScore] = scoreBurden(right);
  if (leftMaxScore !== rightMaxScore) return leftMaxScore - rightMaxScore;
  if (leftTotalScore !== rightTotalScore) return leftTotalScore - rightTotalScore;

  const [leftMaxRank, leftTotalRank] = rankBurden(left);
  const [rightMaxRank, rightTotalRank] = rankBurden(right);
  if (leftMaxRank !== rightMaxRank) return leftMaxRank - rightMaxRank;
  if (leftTotalRank !== rightTotalRank) return leftTotalRank - rightTotalRank;
  return rivalPlayerIds.length > 0
    ? right.rank - left.rank
    : left.rank - right.rank;
};

const sortedDisplayScenarios = (
  playerId: string,
  target: DisplayTargetScenarios,
): ConditionScenario[] =>
  target.scenarios
    .filter(
      (scenario) =>
        scenario.playerId === playerId && isRankConsistentScenario(scenario),
    )
    .sort((left, right) =>
      compareDisplayScenarios(left, right, target.rivalPlayerIds),
    );

const selectReferenceScenario = ({
  playerId,
  targetScenarios,
}: {
  playerId: string;
  targetScenarios: DisplayTargetScenarios[];
}): DisplayScenarioSelection | null => {
  for (const target of [...targetScenarios].reverse()) {
    const scenario = sortedDisplayScenarios(playerId, target)[0];
    if (scenario) {
      return {
        scenario,
        targetRank: target.targetRank,
        fallback: target.targetRank > 1,
      };
    }
  }
  return null;
};

export const selectDisplayScenario = ({
  playerId,
  targetScenarios,
}: {
  playerId: string;
  targetScenarios: DisplayTargetScenarios[];
}): DisplayScenarioSelection | null => {
  for (const target of targetScenarios) {
    const scenario = sortedDisplayScenarios(playerId, target).find(
      isRealisticScenario,
    );
    if (scenario) {
      return {
        scenario,
        targetRank: target.targetRank,
        fallback: target.targetRank > 1,
      };
    }
  }
  return null;
};

const buildPlacementRequirements = (
  scenario: ConditionScenario,
  playerMap: Map<string, string>,
  relevantPlayerIds: Set<string>,
): DisplayRequirement[] => {
  const playerRankIndex = scenario.seatOrder.indexOf(scenario.playerId);
  const gapMap = new Map(scenario.needGaps.map((gap) => [gap.targetId, gap.gap]));
  const requirements = scenario.seatOrder
    .filter(
      (playerId) =>
        playerId !== scenario.playerId && relevantPlayerIds.has(playerId),
    )
    .map((targetId) => {
      const actualTargetRankIndex = scenario.seatOrder.indexOf(targetId);
      const rankDifference = actualTargetRankIndex - playerRankIndex;
      const targetName = playerMap.get(targetId) ?? "不明";
      const gap = gapMap.get(targetId);

      if (playerRankIndex === 0 && actualTargetRankIndex === 3) {
        return {
          label: `${targetName}とトップラス`,
          value: gap === undefined ? null : `${gap.toLocaleString()}点差`,
        };
      }
      if (rankDifference > 0) {
        return {
          label: `${targetName}に${rankDifference}着順差以上`,
          value: gap === undefined ? null : `${gap.toLocaleString()}点差`,
        };
      }
      return {
        label: `${targetName}より${Math.abs(rankDifference)}着順下`,
        value: null,
      };
    });
  if (scenario.needScoreMin !== null) {
    requirements.push({
      label: "自分の素点",
      value: `${scenario.needScoreMin.toLocaleString()}点以上`,
    });
  }
  return requirements;
};

export const buildDisplayReverseCards = (
  session: Session,
  seatPlayerIds: string[],
  mode: DisplayConditionMode = "first",
): DisplayReverseCard[] => {
  if (seatPlayerIds.length !== 4) return [];
  const playerMap = new Map(session.players.map((player) => [player.id, player.name]));
  const aggregate = buildSessionAggregate(session);
  return aggregate.players
    .filter((player) => seatPlayerIds.includes(player.playerId))
    .map((player) => {
      const nextRankPlayer =
        player.rank > 1 ? aggregate.players[player.rank - 2] ?? null : null;
      const gapToNextRank = nextRankPlayer
        ? Math.round((nextRankPlayer.totalPoint - player.totalPoint) * 10) / 10
        : null;
      if (mode === "rank-up" && player.rank === 1) {
        return {
          playerId: player.playerId,
          playerName: player.name,
          currentRank: player.rank,
          targetRank: null,
          targetLabel: "着順アップ対象外",
          ownPlacement: null,
          requirements: [],
          available: false,
          fallback: false,
          gapToNextRank,
          statusMessage: "現在トップです",
        };
      }

      const targetRanks = mode === "first" ? [1] : [player.rank - 1];
      const targetScenarios = targetRanks.map((targetRank) => {
        const playersAllowedAhead = new Set(
          aggregate.players
            .slice(0, targetRank - 1)
            .map((candidate) => candidate.playerId),
        );
        return {
          targetRank,
          rivalPlayerIds: aggregate.players
            .filter(
              (candidate) =>
                candidate.rank < player.rank &&
                !playersAllowedAhead.has(candidate.playerId),
            )
            .map((candidate) => candidate.playerId),
          scenarios: calculateTargetRankConditions(
            session,
            seatPlayerIds,
            player.playerId,
            targetRank,
            { maxGap: Number.MAX_SAFE_INTEGER, topN: 24 },
          ),
        };
      });
      const selection = selectDisplayScenario({
        playerId: player.playerId,
        targetScenarios,
      });
      if (!selection) {
        const reference = selectReferenceScenario({
          playerId: player.playerId,
          targetScenarios,
        });
        if (reference) {
          const referenceTarget = targetScenarios.find(
            (target) => target.targetRank === reference.targetRank,
          );
          const relevantPlayerIds = new Set([
            ...(referenceTarget?.rivalPlayerIds ?? []),
            ...reference.scenario.needGaps.map((gap) => gap.targetId),
          ]);
          return {
            playerId: player.playerId,
            playerName: player.name,
            currentRank: player.rank,
            targetRank: reference.targetRank,
            targetLabel:
              reference.targetRank === 1
                ? "首位条件（参考）"
                : `総合${reference.targetRank}位条件（参考）`,
            ownPlacement: `自分${reference.scenario.rank}着`,
            requirements: buildPlacementRequirements(
              reference.scenario,
              playerMap,
              relevantPlayerIds,
            ),
            available: false,
            fallback: reference.fallback,
            gapToNextRank,
            statusMessage: null,
          };
        }
        return {
          playerId: player.playerId,
          playerName: player.name,
          currentRank: player.rank,
          targetRank: null,
          targetLabel:
            player.rank === 1
              ? "現実的な維持条件なし"
              : player.rank === 2
                ? "現実的な首位条件なし"
                : "現実的な上位条件なし",
          ownPlacement: null,
          requirements: [],
          available: false,
          fallback: false,
          gapToNextRank,
          statusMessage: "次の半荘だけでの逆転は困難",
        };
      }
      const isKeepingFirst = player.rank === 1 && selection.targetRank === 1;
      const rivalPlayerIds = new Set(
        targetScenarios.find(
          (target) => target.targetRank === selection.targetRank,
        )?.rivalPlayerIds ?? [],
      );
      const gapTargetIds = new Set(
        selection.scenario.needGaps.map((gap) => gap.targetId),
      );
      const relevantPlayerIds = new Set(
        [...rivalPlayerIds, ...gapTargetIds],
      );
      return {
        playerId: player.playerId,
        playerName: player.name,
        currentRank: player.rank,
        targetRank: selection.targetRank,
        targetLabel: isKeepingFirst
          ? "総合1位キープ"
          : `総合${selection.targetRank}位へ`,
        ownPlacement: `自分${selection.scenario.rank}着`,
        requirements: buildPlacementRequirements(
          selection.scenario,
          playerMap,
          relevantPlayerIds,
        ),
        available: true,
        fallback: selection.fallback,
        gapToNextRank,
        statusMessage: null,
      };
    });
};

export const buildScenarioPremise = (
  scenario: ConditionScenario,
  playerMap: Map<string, string>,
): string => premiseText(scenario, playerMap);
