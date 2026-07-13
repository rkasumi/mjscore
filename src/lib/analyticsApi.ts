import type {
  AnalyticsResponse,
  HeadToHeadAnalytics,
  PlayerAnalytics,
  PlayerRecord,
  Season,
} from "../../shared/types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value));

const readJson = async (response: Response): Promise<unknown> => {
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === "string" ? payload.error : "API error";
    throw new Error(message);
  }
  return payload;
};

const parsePlayer = (value: unknown): PlayerAnalytics => {
  if (
    !isRecord(value) ||
    typeof value.playerId !== "string" ||
    typeof value.name !== "string" ||
    typeof value.hands !== "number" ||
    typeof value.totalPoint !== "number" ||
    !isNumberOrNull(value.averagePoint) ||
    !isNumberOrNull(value.averageRank) ||
    !Array.isArray(value.rankCounts) ||
    value.rankCounts.length !== 4 ||
    !value.rankCounts.every((count) => typeof count === "number") ||
    !isNumberOrNull(value.topRate) ||
    !isNumberOrNull(value.lastRate)
  ) {
    throw new Error("Invalid player analytics");
  }
  return {
    playerId: value.playerId,
    name: value.name,
    hands: value.hands,
    totalPoint: value.totalPoint,
    averagePoint: value.averagePoint,
    averageRank: value.averageRank,
    rankCounts: [
      value.rankCounts[0]!,
      value.rankCounts[1]!,
      value.rankCounts[2]!,
      value.rankCounts[3]!,
    ],
    topRate: value.topRate,
    lastRate: value.lastRate,
  };
};

const parseHeadToHead = (value: unknown): HeadToHeadAnalytics => {
  if (!isRecord(value)) throw new Error("Invalid head-to-head analytics");
  const keys = [
    "sharedHands",
    "playerAHigher",
    "playerBHigher",
    "ties",
    "playerAPoint",
    "playerBPoint",
  ] as const;
  if (
    typeof value.playerAId !== "string" ||
    typeof value.playerBId !== "string" ||
    !keys.every((key) => typeof value[key] === "number")
  ) {
    throw new Error("Invalid head-to-head analytics");
  }
  return {
    playerAId: value.playerAId,
    playerBId: value.playerBId,
    sharedHands: Number(value.sharedHands),
    playerAHigher: Number(value.playerAHigher),
    playerBHigher: Number(value.playerBHigher),
    ties: Number(value.ties),
    playerAPoint: Number(value.playerAPoint),
    playerBPoint: Number(value.playerBPoint),
  };
};

const parseRecord = (value: unknown): PlayerRecord => {
  if (
    !isRecord(value) ||
    typeof value.playerId !== "string" ||
    !isNumberOrNull(value.highestScore) ||
    !isNumberOrNull(value.lowestScore) ||
    !isNumberOrNull(value.bestPoint) ||
    !isNumberOrNull(value.worstPoint) ||
    typeof value.longestTopStreak !== "number"
  ) {
    throw new Error("Invalid player record");
  }
  return {
    playerId: value.playerId,
    highestScore: value.highestScore,
    lowestScore: value.lowestScore,
    bestPoint: value.bestPoint,
    worstPoint: value.worstPoint,
    longestTopStreak: value.longestTopStreak,
  };
};

const parseSeason = (value: unknown): Season => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.startsOn !== "string" ||
    typeof value.endsOn !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("Invalid season");
  }
  return {
    id: value.id,
    name: value.name,
    startsOn: value.startsOn,
    endsOn: value.endsOn,
    createdAt: value.createdAt,
  };
};

export const fetchAnalytics = async (
  from: string | null,
  to: string | null,
): Promise<AnalyticsResponse> => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const payload = await readJson(await fetch(`${apiBaseUrl}/analytics?${params.toString()}`));
  if (
    !isRecord(payload) ||
    !(payload.from === null || typeof payload.from === "string") ||
    !(payload.to === null || typeof payload.to === "string") ||
    typeof payload.sessions !== "number" ||
    typeof payload.hands !== "number" ||
    !Array.isArray(payload.players) ||
    !Array.isArray(payload.headToHead) ||
    !Array.isArray(payload.records)
  ) {
    throw new Error("Invalid analytics response");
  }
  return {
    from: payload.from,
    to: payload.to,
    sessions: payload.sessions,
    hands: payload.hands,
    players: payload.players.map(parsePlayer),
    headToHead: payload.headToHead.map(parseHeadToHead),
    records: payload.records.map(parseRecord),
  };
};

export const fetchSeasons = async (): Promise<Season[]> => {
  const payload = await readJson(await fetch(`${apiBaseUrl}/seasons`));
  if (!isRecord(payload) || !Array.isArray(payload.seasons)) {
    throw new Error("Invalid seasons response");
  }
  return payload.seasons.map(parseSeason);
};

export const createSeason = async (
  name: string,
  startsOn: string,
  endsOn: string,
): Promise<Season> =>
  parseSeason(
    await readJson(
      await fetch(`${apiBaseUrl}/seasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startsOn, endsOn }),
      }),
    ),
  );
