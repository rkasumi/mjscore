import { describe, expect, it } from "vitest";

import type { Hand, Session } from "../../shared/types";
import type { ConditionScenario } from "./reversal";
import {
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
    expect(cards.every((card) => card.ownPlacement?.startsWith("自分"))).toBe(true);
    expect(
      cards.some((card) =>
        card.requirements.some((requirement) => requirement.label.includes("トップラス")),
      ),
    ).toBe(true);
    expect(
      cards.some((card) =>
        card.requirements.some((requirement) => requirement.label.includes("着順差以上")),
      ),
    ).toBe(true);
  });

  it("falls back to the highest realistic target rank", () => {
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
    const item = buildDisplayReverseCards(session, ["a", "b", "c", "d"]).find(
      (candidate) => candidate.playerName === "D",
    );
    expect(item?.targetRank).toBe(2);
    expect(item?.targetLabel).toBe("総合2位へ");
    expect(item?.fallback).toBe(true);
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
    expect(second?.targetLabel).toBe("現実的な首位条件なし");
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
  gap?: number;
} = {}): ConditionScenario => ({
  playerId,
  seatOrder,
  rank: seatOrder.indexOf(playerId) + 1,
  needGaps: [{ targetId: "a", gap }],
  needScoreMin: null,
  difficulty: gap / 1000,
});

describe("selectDisplayScenario", () => {
  it("uses a realistic overall-first condition when one exists", () => {
    const selected = selectDisplayScenario({
      playerId: "c",
      targetScenarios: [
        { targetRank: 1, scenarios: [scenario()] },
        { targetRank: 2, scenarios: [scenario({ gap: 5000 })] },
      ],
    });
    expect(selected?.targetRank).toBe(1);
    expect(selected?.fallback).toBe(false);
  });

  it("falls back to moving up one place when first place needs an excessive gap", () => {
    const selected = selectDisplayScenario({
      playerId: "c",
      targetScenarios: [
        { targetRank: 1, scenarios: [scenario({ gap: 30100 })] },
        { targetRank: 2, scenarios: [scenario({ gap: 10000 })] },
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
});
