import { describe, expect, it } from "vitest";
import { calculateHandResults } from "./scoring";

const seat = (playerId: string, score: number) => ({ playerId, score });

describe("calculateHandResults", () => {
  it("splits rank points evenly for a 1st/2nd tie", () => {
    const results = calculateHandResults([
      seat("a", 30000),
      seat("b", 30000),
      seat("c", 25000),
      seat("d", 20000),
    ]);

    const tied = results.filter((item) => item.rank === 1);
    expect(tied).toHaveLength(2);
    for (const item of tied) {
      expect(item.rankPoint).toBe(30);
    }
  });

  it("splits rank points evenly for a 2nd/3rd tie", () => {
    const results = calculateHandResults([
      seat("a", 32000),
      seat("b", 26000),
      seat("c", 26000),
      seat("d", 16000),
    ]);

    const tied = results.filter((item) => item.rank === 2);
    expect(tied).toHaveLength(2);
    for (const item of tied) {
      expect(item.rankPoint).toBe(0);
    }
  });

  it("gives 100.0pt for 80000 top", () => {
    const results = calculateHandResults([
      seat("a", 80000),
      seat("b", 10000),
      seat("c", 5000),
      seat("d", 5000),
    ]);
    const top = results.find((item) => item.playerId === "a");
    expect(top?.totalPoint).toBe(100);
  });
});
