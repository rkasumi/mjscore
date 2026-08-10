import { describe, expect, it } from "vitest";

import { findPlayerByName, normalizePlayerName } from "./playerIdentity.js";

describe("player identity names", () => {
  it("matches trimmed and width-normalized names", () => {
    const players = [{ id: "alice", name: "Alice" }];

    expect(normalizePlayerName(" ＡＬＩＣＥ ")).toBe("alice");
    expect(findPlayerByName(players, " alice ")?.id).toBe("alice");
  });
});
