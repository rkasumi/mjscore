import { describe, expect, it } from "vitest";

import type { Session } from "../../shared/types";
import {
  buildResultImageAltText,
  buildResultImageFilename,
  buildResultImageModel,
  buildResultImagePostText,
} from "./resultImage";

const session: Session = {
  id: "session",
  createdAt: "2026-07-18T00:00:00.000Z",
  day: "2026-07-18",
  label: "夜/卓",
  players: [
    { id: "a", name: "Alice" },
    { id: "b", name: "Bob" },
    { id: "c", name: "Carol" },
    { id: "d", name: "Dave" },
    { id: "unused", name: "観戦者" },
  ],
  hands: [
    {
      id: "hand",
      createdAt: "2026-07-18T01:00:00.000Z",
      seats: [
        { playerId: "a", score: 40000 },
        { playerId: "b", score: 30000 },
        { playerId: "c", score: 20000 },
        { playerId: "d", score: 10000 },
      ],
    },
  ],
};

describe("result image model", () => {
  it("hides selected names consistently and excludes non-participants", () => {
    const model = buildResultImageModel(session, new Set(["a", "c", "d"]), "finalized");

    expect(model.statusLabel).toBe("最終結果");
    expect(model.players.map((player) => player.displayName)).toEqual([
      "Alice",
      "匿名B",
      "Carol",
      "Dave",
    ]);
    expect(model.players.map((player) => player.rank)).toEqual([1, 2, 3, 4]);
    expect(model.graphPlayers.map((player) => player.displayName)).toEqual([
      "Alice",
      "匿名B",
      "Carol",
      "Dave",
    ]);

    const postText = buildResultImagePostText(model);
    const altText = buildResultImageAltText(model);
    expect(postText).toContain("2位 匿名B +10.0pt");
    expect(altText).toContain("2位 匿名B +10.0pt");
    expect(postText).not.toContain("Bob");
    expect(altText).not.toContain("Bob");
    expect(postText).not.toContain("観戦者");
    expect(altText).not.toContain("観戦者");
  });

  it("creates a filesystem-safe PNG filename", () => {
    const model = buildResultImageModel(
      session,
      new Set(session.players.map((player) => player.id)),
      "active",
    );
    expect(buildResultImageFilename(model)).toBe("mjscore-2026-07-18-夜-卓.png");
  });

  it("keeps copied X text and ALT text within their limits", () => {
    const longTextSession: Session = {
      ...session,
      label: "長い卓名".repeat(50),
      players: session.players.map((player) => ({
        ...player,
        name: `${player.name}${"長い名前".repeat(50)}`,
      })),
    };
    const model = buildResultImageModel(
      longTextSession,
      new Set(longTextSession.players.map((player) => player.id)),
      "finalized",
    );

    expect(Array.from(buildResultImagePostText(model)).length).toBeLessThanOrEqual(280);
    expect(Array.from(buildResultImageAltText(model)).length).toBeLessThanOrEqual(1000);
  });
});
