import { describe, expect, it } from "vitest";

import type { Session } from "../shared/types.js";
import { buildAnalytics } from "./analytics.js";

const session: Session = {
  id: "session",
  createdAt: "2026-07-13T00:00:00.000Z",
  day: "2026-07-13",
  players: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })),
  hands: [
    {
      id: "one",
      createdAt: "2026-07-13T01:00:00.000Z",
      seats: [40000, 30000, 20000, 10000].map((score, index) => ({
        playerId: ["a", "b", "c", "d"][index]!,
        score,
      })),
    },
    {
      id: "two",
      createdAt: "2026-07-13T02:00:00.000Z",
      seats: [45000, 25000, 20000, 10000].map((score, index) => ({
        playerId: ["a", "b", "c", "d"][index]!,
        score,
      })),
    },
  ],
};

describe("buildAnalytics", () => {
  it("builds ranking, rates, records, and direct matchups", () => {
    const result = buildAnalytics([session]);
    expect(result.sessions).toBe(1);
    expect(result.hands).toBe(2);
    expect(result.players[0]).toMatchObject({
      playerId: "a",
      hands: 2,
      totalPoint: 125,
      averageRank: 1,
      rankCounts: [2, 0, 0, 0],
      topRate: 1,
    });
    expect(result.records.find((record) => record.playerId === "a")).toMatchObject({
      highestScore: 45000,
      bestPoint: 65,
      longestTopStreak: 2,
    });
    expect(
      result.headToHead.find(
        (pair) => pair.playerAId === "a" && pair.playerBId === "b",
      ),
    ).toMatchObject({ sharedHands: 2, playerAHigher: 2, playerBHigher: 0, ties: 0 });
  });
});
