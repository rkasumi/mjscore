import { describe, expect, it } from "vitest";

import type { Hand, Session } from "../../shared/types";
import { buildReverseTickerItems, calculatePaceEstimate } from "./displayInsights";

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

describe("buildReverseTickerItems", () => {
  it("includes the full assumed finishing order", () => {
    const session: Session = {
      id: "session",
      createdAt: "2026-07-13T00:00:00.000Z",
      players: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })),
      hands: [],
    };
    const items = buildReverseTickerItems(session, ["a", "b", "c", "d"]);
    expect(items).toHaveLength(4);
    expect(
      items.every((item) => ["A", "B", "C", "D"].every((name) => item.includes(`${name}`))),
    ).toBe(true);
    expect(items.every((item) => (item.match(/\d着/g) ?? []).length === 4)).toBe(true);
  });
});
