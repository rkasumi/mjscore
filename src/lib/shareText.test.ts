import { describe, expect, it } from "vitest";

import type { Session } from "../../shared/types";
import { buildResultShareText } from "./shareText";

const session: Session = {
  id: "session",
  createdAt: "2026-07-13T00:00:00.000Z",
  day: "2026-07-13",
  label: "夜卓",
  players: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })),
  hands: [
    {
      id: "hand",
      createdAt: "2026-07-13T01:00:00.000Z",
      seats: [40000, 30000, 20000, 10000].map((score, index) => ({
        playerId: ["a", "b", "c", "d"][index]!,
        score,
      })),
    },
  ],
};

describe("buildResultShareText", () => {
  it("formats a post-ready result with a snapshot URL", () => {
    expect(buildResultShareText(session, "https://example.test/share/result")).toBe(
      [
        "2026-07-13 夜卓 麻雀結果（1半荘）",
        "",
        "1位 A +60.0pt",
        "2位 B +10.0pt",
        "3位 C -20.0pt",
        "4位 D -50.0pt",
        "",
        "共有: https://example.test/share/result",
      ].join("\n"),
    );
  });
});
