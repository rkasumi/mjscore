import { calculateHandResults } from "../shared/scoring.js";
import type {
  AnalyticsResponse,
  HeadToHeadAnalytics,
  PlayerAnalytics,
  PlayerRecord,
  Session,
} from "../shared/types.js";

type MutablePlayer = {
  name: string;
  hands: number;
  totalPoint: number;
  rankTotal: number;
  rankCounts: [number, number, number, number];
};

type MutableRecord = PlayerRecord & {
  currentTopStreak: number;
};

const round1 = (value: number): number => Math.round(value * 10) / 10;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const pairKey = (a: string, b: string): [string, string, string] => {
  const [first, second] = a < b ? [a, b] : [b, a];
  return [first, second, `${first}\u0000${second}`];
};

export const buildAnalytics = (
  sessionsValue: Session[],
  from: string | null = null,
  to: string | null = null,
): AnalyticsResponse => {
  const sessions = [...sessionsValue].sort((a, b) => {
    const left = `${a.day ?? a.createdAt.slice(0, 10)}\u0000${a.createdAt}`;
    const right = `${b.day ?? b.createdAt.slice(0, 10)}\u0000${b.createdAt}`;
    return left.localeCompare(right);
  });
  const players = new Map<string, MutablePlayer>();
  const records = new Map<string, MutableRecord>();
  const headToHead = new Map<string, HeadToHeadAnalytics>();
  let hands = 0;

  for (const session of sessions) {
    for (const player of session.players) {
      const current = players.get(player.id);
      if (current) {
        current.name = player.name;
      } else {
        players.set(player.id, {
          name: player.name,
          hands: 0,
          totalPoint: 0,
          rankTotal: 0,
          rankCounts: [0, 0, 0, 0],
        });
      }
      if (!records.has(player.id)) {
        records.set(player.id, {
          playerId: player.id,
          highestScore: null,
          lowestScore: null,
          bestPoint: null,
          worstPoint: null,
          longestTopStreak: 0,
          currentTopStreak: 0,
        });
      }
    }

    for (const hand of session.hands) {
      hands += 1;
      const results = calculateHandResults(hand.seats);
      for (const result of results) {
        const player = players.get(result.playerId);
        const record = records.get(result.playerId);
        if (!player || !record) continue;
        player.hands += 1;
        player.totalPoint = round1(player.totalPoint + result.totalPoint);
        player.rankTotal += result.rank;
        const rankIndex = Math.min(3, Math.max(0, result.rank - 1));
        player.rankCounts[rankIndex] = (player.rankCounts[rankIndex] ?? 0) + 1;
        record.highestScore = Math.max(record.highestScore ?? result.score, result.score);
        record.lowestScore = Math.min(record.lowestScore ?? result.score, result.score);
        record.bestPoint = Math.max(record.bestPoint ?? result.totalPoint, result.totalPoint);
        record.worstPoint = Math.min(record.worstPoint ?? result.totalPoint, result.totalPoint);
        record.currentTopStreak = result.rank === 1 ? record.currentTopStreak + 1 : 0;
        record.longestTopStreak = Math.max(record.longestTopStreak, record.currentTopStreak);
      }

      for (let leftIndex = 0; leftIndex < results.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < results.length; rightIndex += 1) {
          const left = results[leftIndex];
          const right = results[rightIndex];
          if (!left || !right) continue;
          const [playerAId, playerBId, key] = pairKey(left.playerId, right.playerId);
          const playerA = left.playerId === playerAId ? left : right;
          const playerB = left.playerId === playerBId ? left : right;
          const current = headToHead.get(key) ?? {
            playerAId,
            playerBId,
            sharedHands: 0,
            playerAHigher: 0,
            playerBHigher: 0,
            ties: 0,
            playerAPoint: 0,
            playerBPoint: 0,
          };
          current.sharedHands += 1;
          current.playerAPoint = round1(current.playerAPoint + playerA.totalPoint);
          current.playerBPoint = round1(current.playerBPoint + playerB.totalPoint);
          if (playerA.rank < playerB.rank) current.playerAHigher += 1;
          else if (playerB.rank < playerA.rank) current.playerBHigher += 1;
          else current.ties += 1;
          headToHead.set(key, current);
        }
      }
    }
  }

  const playerAnalytics: PlayerAnalytics[] = [...players].map(([playerId, player]) => ({
    playerId,
    name: player.name,
    hands: player.hands,
    totalPoint: round1(player.totalPoint),
    averagePoint: player.hands > 0 ? round1(player.totalPoint / player.hands) : null,
    averageRank: player.hands > 0 ? round1(player.rankTotal / player.hands) : null,
    rankCounts: player.rankCounts,
    topRate: player.hands > 0 ? round3(player.rankCounts[0] / player.hands) : null,
    lastRate: player.hands > 0 ? round3(player.rankCounts[3] / player.hands) : null,
  }));
  playerAnalytics.sort((a, b) => b.totalPoint - a.totalPoint || a.name.localeCompare(b.name));

  return {
    from,
    to,
    sessions: sessions.length,
    hands,
    players: playerAnalytics,
    headToHead: [...headToHead.values()],
    records: [...records.values()].map(({ currentTopStreak: _currentTopStreak, ...record }) =>
      record,
    ),
  };
};
