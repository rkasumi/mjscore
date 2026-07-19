import type { Hand, Session } from "../../shared/types";
import { buildSessionAggregate } from "./aggregation";
import {
  calculateTargetRankConditions,
  type ConditionScenario,
} from "./reversal";

const MIN_INTERVAL_MS = 20 * 60 * 1000;
const MAX_INTERVAL_MS = 180 * 60 * 1000;
export const DISPLAY_REALISTIC_MAX_GAP = 30000;
export const DISPLAY_REALISTIC_MAX_SCORE = 60000;

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
};

type DisplayScenarioSelection = {
  scenario: ConditionScenario;
  targetRank: number;
  fallback: boolean;
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

const isRealisticScenario = (scenario: ConditionScenario): boolean => {
  const playerRank = scenario.seatOrder.indexOf(scenario.playerId);
  if (playerRank < 0) return false;
  if (
    scenario.needScoreMin !== null &&
    scenario.needScoreMin > DISPLAY_REALISTIC_MAX_SCORE
  ) {
    return false;
  }
  return scenario.needGaps.every((gap) => {
    const targetRank = scenario.seatOrder.indexOf(gap.targetId);
    return (
      targetRank > playerRank &&
      gap.gap <= DISPLAY_REALISTIC_MAX_GAP
    );
  });
};

export const selectDisplayScenario = ({
  playerId,
  targetScenarios,
}: {
  playerId: string;
  targetScenarios: Array<{
    targetRank: number;
    scenarios: ConditionScenario[];
  }>;
}): DisplayScenarioSelection | null => {
  for (const target of targetScenarios) {
    const scenario = target.scenarios.find(
      (candidate) =>
        candidate.playerId === playerId && isRealisticScenario(candidate),
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
): DisplayReverseCard[] => {
  if (seatPlayerIds.length !== 4) return [];
  const playerMap = new Map(session.players.map((player) => [player.id, player.name]));
  const aggregate = buildSessionAggregate(session);
  return aggregate.players
    .filter((player) => seatPlayerIds.includes(player.playerId))
    .map((player) => {
      const highestTargetRank = player.rank === 1 ? 1 : player.rank - 1;
      const targetScenarios = Array.from(
        { length: highestTargetRank },
        (_, index) => {
          const targetRank = index + 1;
          return {
            targetRank,
            scenarios: calculateTargetRankConditions(
              session,
              seatPlayerIds,
              player.playerId,
              targetRank,
              { topN: 24 },
            ),
          };
        },
      );
      const selection = selectDisplayScenario({
        playerId: player.playerId,
        targetScenarios,
      });
      const nextRankPlayer =
        player.rank > 1 ? aggregate.players[player.rank - 2] ?? null : null;
      const gapToNextRank = nextRankPlayer
        ? Math.round((nextRankPlayer.totalPoint - player.totalPoint) * 10) / 10
        : null;
      if (!selection) {
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
        };
      }
      const isKeepingFirst = player.rank === 1 && selection.targetRank === 1;
      const playersAllowedAhead = new Set(
        aggregate.players
          .slice(0, selection.targetRank - 1)
          .map((candidate) => candidate.playerId),
      );
      const gapTargetIds = new Set(
        selection.scenario.needGaps.map((gap) => gap.targetId),
      );
      const relevantPlayerIds = new Set(
        aggregate.players
          .filter(
            (candidate) =>
              !playersAllowedAhead.has(candidate.playerId) &&
              (candidate.rank < player.rank ||
                gapTargetIds.has(candidate.playerId)),
          )
          .map((candidate) => candidate.playerId),
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
      };
    });
};

export const buildScenarioPremise = (
  scenario: ConditionScenario,
  playerMap: Map<string, string>,
): string => premiseText(scenario, playerMap);
