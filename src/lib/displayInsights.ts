import type { Hand, Session } from "../../shared/types";
import { buildSessionAggregate } from "./aggregation";
import { calculateReverseConditions, type ConditionScenario } from "./reversal";

const MIN_INTERVAL_MS = 20 * 60 * 1000;
const MAX_INTERVAL_MS = 180 * 60 * 1000;

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

const scenarioText = (
  playerName: string,
  scenario: ConditionScenario,
  playerMap: Map<string, string>,
): string => {
  const premise = premiseText(scenario, playerMap);
  const gap = scenario.needGaps[0];
  if (gap) {
    return `${playerName}: ${premise}のとき、${playerMap.get(gap.targetId) ?? "不明"}に${gap.gap.toLocaleString()}点差で総合1位`;
  }
  if (scenario.needScoreMin) {
    return `${playerName}: ${premise}のとき、素点${scenario.needScoreMin.toLocaleString()}点以上で総合1位`;
  }
  return `${playerName}: ${premise}なら総合1位`;
};

export const buildReverseTickerItems = (session: Session, seatPlayerIds: string[]): string[] => {
  if (seatPlayerIds.length !== 4) return [];
  const playerMap = new Map(session.players.map((player) => [player.id, player.name]));
  const aggregate = buildSessionAggregate(session);
  const result = calculateReverseConditions(session, seatPlayerIds, { topN: 1 });
  return aggregate.players
    .filter((player) => seatPlayerIds.includes(player.playerId))
    .map((player) => {
      const scenario = result.overallToFirstTopN.find(
        (candidate) => candidate.playerId === player.playerId,
      );
      return scenario ? scenarioText(player.name, scenario, playerMap) : null;
    })
    .filter((item): item is string => item !== null);
};

export const buildScenarioPremise = (
  scenario: ConditionScenario,
  playerMap: Map<string, string>,
): string => premiseText(scenario, playerMap);
