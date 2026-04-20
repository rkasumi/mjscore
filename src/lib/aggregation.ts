import type { Session } from "../../shared/types";
import { calculateHandResults } from "./scoring";

export type PlayerAggregate = {
  playerId: string;
  name: string;
  totalPoint: number;
  averageRank: number | null;
  hands: number;
  rank: number;
};

export type GraphPoint = {
  handIndex: number;
  [playerId: string]: number;
};

export type SessionAggregate = {
  players: PlayerAggregate[];
  cumulativeSeries: GraphPoint[];
  handsCount: number;
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

export const buildSessionAggregate = (session: Session): SessionAggregate => {
  const totals = new Map<string, number>();
  const rankTotals = new Map<string, number>();
  const handCounts = new Map<string, number>();
  const cumulativeSeries: GraphPoint[] = [];

  const playerIds = session.players.map((player) => player.id);
  const currentTotals = new Map<string, number>();
  for (const playerId of playerIds) {
    currentTotals.set(playerId, 0);
    totals.set(playerId, 0);
    rankTotals.set(playerId, 0);
    handCounts.set(playerId, 0);
  }

  const basePoint: GraphPoint = { handIndex: 0 };
  for (const playerId of playerIds) {
    basePoint[playerId] = 0;
  }
  cumulativeSeries.push({ ...basePoint });

  session.hands.forEach((hand, index) => {
    const results = calculateHandResults(hand.seats);
    const handPoint: GraphPoint = { handIndex: index + 1 };
    const cumulativePoint: GraphPoint = { handIndex: index + 1 };

    for (const playerId of playerIds) {
      handPoint[playerId] = 0;
    }

    for (const result of results) {
      const prevTotal = totals.get(result.playerId) ?? 0;
      const prevRank = rankTotals.get(result.playerId) ?? 0;
      const prevCount = handCounts.get(result.playerId) ?? 0;
      const nextTotal = round1(prevTotal + result.totalPoint);

      totals.set(result.playerId, nextTotal);
      rankTotals.set(result.playerId, prevRank + result.rank);
      handCounts.set(result.playerId, prevCount + 1);
      handPoint[result.playerId] = result.totalPoint;
    }

    for (const playerId of playerIds) {
      const current = currentTotals.get(playerId) ?? 0;
      const delta = handPoint[playerId] ?? 0;
      const next = round1(current + delta);
      currentTotals.set(playerId, next);
      cumulativePoint[playerId] = next;
    }

    cumulativeSeries.push(cumulativePoint);
  });

  const playerAggregates = session.players.map((player) => {
    const totalPoint = totals.get(player.id) ?? 0;
    const count = handCounts.get(player.id) ?? 0;
    const rankTotal = rankTotals.get(player.id) ?? 0;
    return {
      playerId: player.id,
      name: player.name,
      totalPoint,
      averageRank: count > 0 ? round1(rankTotal / count) : null,
      hands: count,
      rank: 0,
    };
  });

  const sortedByTotal = [...playerAggregates].sort((a, b) => b.totalPoint - a.totalPoint);
  sortedByTotal.forEach((player, index) => {
    player.rank = index + 1;
  });

  return {
    players: sortedByTotal,
    cumulativeSeries,
    handsCount: session.hands.length,
  };
};
