import { describe, expect, it } from "vitest";

import type { Hand, Session } from "../../shared/types";
import type { ConditionScenario } from "./reversal";
import {
  buildDisplayRequirements,
  buildDisplayReverseCards,
  calculatePaceEstimate,
  selectDisplayScenario,
} from "./displayInsights";

const handAt = (minutes: number): Hand => ({
  id: `hand-${minutes}`,
  createdAt: new Date(Date.UTC(2026, 6, 13, 10, minutes)).toISOString(),
  seats: ["a", "b", "c", "d"].map((playerId) => ({ playerId, score: 25000 })),
});

describe("calculatePaceEstimate", () => {
  it("uses the median of plausible consecutive intervals", () => {
    const estimate = calculatePaceEstimate(
      [handAt(0), handAt(40), handAt(90), handAt(150)],
      new Date("2026-07-13T13:00:00.000Z"),
    );
    expect(estimate?.medianMinutes).toBe(50);
    expect(estimate?.predictedEndAt.toISOString()).toBe("2026-07-13T13:50:00.000Z");
    expect(estimate?.sampleCount).toBe(3);
  });

  it("returns null when there are too few useful intervals", () => {
    expect(calculatePaceEstimate([handAt(0), handAt(5), handAt(10)])).toBeNull();
  });
});

describe("buildDisplayReverseCards", () => {
  it("summarizes the finishing-order relationship for each player", () => {
    const session: Session = {
      id: "session",
      createdAt: "2026-07-13T00:00:00.000Z",
      players: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })),
      hands: [],
    };
    const cards = buildDisplayReverseCards(session, ["a", "b", "c", "d"]);
    expect(cards).toHaveLength(4);
    expect(cards.every((card) => card.targetLabel.length > 0)).toBe(true);
    expect(
      cards.some((card) =>
        card.requirements.some((requirement) => requirement.label.includes("トップラス")),
      ),
    ).toBe(true);
    expect(
      cards.some((card) =>
        card.requirements.some((requirement) => requirement.label.includes("より上")),
      ),
    ).toBe(true);
  });

  it("separates overall-first and one-rank-up targets", () => {
    const session: Session = {
      id: "session",
      createdAt: "2026-07-13T00:00:00.000Z",
      players: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })),
      hands: [
        {
          id: "hand",
          createdAt: "2026-07-13T01:00:00.000Z",
          seats: [
            { playerId: "a", score: 60000 },
            { playerId: "b", score: 20000 },
            { playerId: "c", score: 15000 },
            { playerId: "d", score: 5000 },
          ],
        },
      ],
    };
    const firstItem = buildDisplayReverseCards(
      session,
      ["a", "b", "c", "d"],
      "first",
    ).find(
      (candidate) => candidate.playerName === "D",
    );
    const rankUpItem = buildDisplayReverseCards(
      session,
      ["a", "b", "c", "d"],
      "rank-up",
    ).find((candidate) => candidate.playerName === "D");
    expect(firstItem?.targetRank).toBe(1);
    expect(firstItem?.targetLabel).toBe("首位条件（参考）");
    expect(rankUpItem?.targetRank).toBe(3);
    expect(rankUpItem?.targetLabel).toBe("総合3位へ");
    expect(rankUpItem?.available).toBe(true);
  });

  it("marks the current leader as outside the rank-up target", () => {
    const session: Session = {
      id: "session",
      createdAt: "2026-07-13T00:00:00.000Z",
      players: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })),
      hands: [],
    };
    const leader = buildDisplayReverseCards(
      session,
      ["a", "b", "c", "d"],
      "rank-up",
    ).find((card) => card.currentRank === 1);
    expect(leader?.targetLabel).toBe("着順アップ対象外");
    expect(leader?.statusMessage).toBe("現在トップです");
  });

  it("keeps a card visible when no realistic higher target exists", () => {
    const session: Session = {
      id: "session",
      createdAt: "2026-07-13T00:00:00.000Z",
      players: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })),
      hands: [0, 1].map((index) => ({
        id: `hand-${index}`,
        createdAt: `2026-07-13T0${index + 1}:00:00.000Z`,
        seats: [
          { playerId: "a", score: 60000 },
          { playerId: "b", score: 20000 },
          { playerId: "c", score: 15000 },
          { playerId: "d", score: 5000 },
        ],
      })),
    };
    const cards = buildDisplayReverseCards(session, ["a", "b", "c", "d"]);
    const second = cards.find((card) => card.playerName === "B");
    expect(cards).toHaveLength(4);
    expect(second?.available).toBe(false);
    expect(second?.targetLabel).toBe("首位条件（参考）");
    expect(second?.requirements).toContainEqual({
      label: "Aとトップラス",
      value: "80,000点差",
    });
    expect(second?.gapToNextRank).toBe(160);
  });
});

const scenario = ({
  playerId = "c",
  seatOrder = ["c", "a", "b", "d"],
  gap = 10000,
}: {
  playerId?: string;
  seatOrder?: string[];
  gap?: number | null;
} = {}): ConditionScenario => ({
  playerId,
  seatOrder,
  rank: seatOrder.indexOf(playerId) + 1,
  needGaps: gap === null ? [] : [{ targetId: "a", gap }],
  needScoreMin: null,
  difficulty: (gap ?? 0) / 1000,
});

describe("selectDisplayScenario", () => {
  it("uses a realistic overall-first condition when one exists", () => {
    const selected = selectDisplayScenario({
      playerId: "c",
      targetScenarios: [
        { targetRank: 1, rivalPlayerIds: ["a"], scenarios: [scenario()] },
        {
          targetRank: 2,
          rivalPlayerIds: ["a"],
          scenarios: [scenario({ gap: 5000 })],
        },
      ],
    });
    expect(selected?.targetRank).toBe(1);
    expect(selected?.fallback).toBe(false);
  });

  it("falls back to moving up one place when first place needs an excessive gap", () => {
    const selected = selectDisplayScenario({
      playerId: "c",
      targetScenarios: [
        {
          targetRank: 1,
          rivalPlayerIds: ["a"],
          scenarios: [scenario({ gap: 30100 })],
        },
        {
          targetRank: 2,
          rivalPlayerIds: ["a"],
          scenarios: [scenario({ gap: 10000 })],
        },
      ],
    });
    expect(selected?.targetRank).toBe(2);
    expect(selected?.fallback).toBe(true);
  });

  it("rejects a point-gap condition that contradicts the assumed finishing order", () => {
    const selected = selectDisplayScenario({
      playerId: "c",
      targetScenarios: [
        {
          targetRank: 1,
          rivalPlayerIds: ["a"],
          scenarios: [
            scenario({
              seatOrder: ["a", "c", "b", "d"],
              gap: 10000,
            }),
          ],
        },
      ],
    });
    expect(selected).toBeNull();
  });

  it("prefers a one-rank gap over top-last when both need no score gap", () => {
    const selected = selectDisplayScenario({
      playerId: "c",
      targetScenarios: [
        {
          targetRank: 3,
          rivalPlayerIds: ["a"],
          scenarios: [
            scenario({
              seatOrder: ["c", "b", "d", "a"],
              gap: null,
            }),
            scenario({
              seatOrder: ["b", "d", "c", "a"],
              gap: null,
            }),
          ],
        },
      ],
    });
    expect(selected?.scenario.rank).toBe(3);
    expect(selected?.scenario.seatOrder.indexOf("a")).toBe(3);
  });

  it("prefers an easier placement when its score gap is still realistic", () => {
    const selected = selectDisplayScenario({
      playerId: "c",
      targetScenarios: [
        {
          targetRank: 3,
          rivalPlayerIds: ["a"],
          scenarios: [
            scenario({
              seatOrder: ["c", "b", "d", "a"],
              gap: 0,
            }),
            scenario({
              seatOrder: ["b", "d", "c", "a"],
              gap: 20000,
            }),
          ],
        },
      ],
    });
    expect(selected?.scenario.rank).toBe(3);
    expect(selected?.scenario.seatOrder.indexOf("a")).toBe(3);
  });

  it("uses the worst adjacent score gap when placement is not fixed", () => {
    const selected = selectDisplayScenario({
      playerId: "c",
      targetScenarios: [
        {
          targetRank: 3,
          rivalPlayerIds: ["a"],
          scenarios: [
            scenario({
              seatOrder: ["c", "a", "b", "d"],
              gap: 10000,
            }),
            scenario({
              seatOrder: ["b", "c", "a", "d"],
              gap: 30000,
            }),
            scenario({
              seatOrder: ["b", "d", "c", "a"],
              gap: 30000,
            }),
          ],
        },
      ],
    });
    expect(selected?.scenario.needGaps).toEqual([
      { targetId: "a", gap: 30000 },
    ]);
  });

  it("uses a realistic top-third condition when any adjacent placement is too costly", () => {
    const selected = selectDisplayScenario({
      playerId: "c",
      targetScenarios: [
        {
          targetRank: 3,
          rivalPlayerIds: ["a"],
          scenarios: [
            scenario({
              seatOrder: ["c", "a", "b", "d"],
              gap: 20000,
            }),
            scenario({
              seatOrder: ["b", "c", "a", "d"],
              gap: 40000,
            }),
            scenario({
              seatOrder: ["c", "b", "a", "d"],
              gap: 10000,
            }),
          ],
        },
      ],
    });
    expect(selected?.scenario.seatOrder).toEqual(["c", "b", "a", "d"]);
    expect(selected?.scenario.needGaps).toEqual([
      { targetId: "a", gap: 10000 },
    ]);
  });
});

describe("buildDisplayRequirements", () => {
  const playerMap = new Map([
    ["a", "A"],
    ["b", "B"],
    ["c", "C"],
    ["d", "D"],
  ]);

  it("describes a one-place relation without fixing either placement", () => {
    expect(
      buildDisplayRequirements(
        scenario({ seatOrder: ["b", "c", "a", "d"], gap: 12000 }),
        playerMap,
        new Set(["a"]),
      ),
    ).toEqual([{ label: "Aより上", value: "12,000点差" }]);
  });

  it("describes first and third as a top-third condition", () => {
    expect(
      buildDisplayRequirements(
        scenario({ seatOrder: ["c", "b", "a", "d"], gap: 20000 }),
        playerMap,
        new Set(["a"]),
      ),
    ).toEqual([{ label: "Aとトップ3着", value: "20,000点差" }]);
  });

  it("describes first and fourth as a top-last condition", () => {
    expect(
      buildDisplayRequirements(
        scenario({ seatOrder: ["c", "b", "d", "a"], gap: 30000 }),
        playerMap,
        new Set(["a"]),
      ),
    ).toEqual([{ label: "Aとトップラス", value: "30,000点差" }]);
  });
});
