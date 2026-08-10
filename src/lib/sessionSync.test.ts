import { describe, expect, it } from "vitest";

import type { Session } from "../../shared/types";
import { HttpPollingSessionSync } from "./sessionSync";

const session: Session = {
  id: "session",
  createdAt: "2026-08-09T00:00:00.000Z",
  players: [{ id: "local-player", name: "ちあ" }],
  hands: [],
};

describe("HttpPollingSessionSync", () => {
  it("surfaces the API error message when saving fails", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({ error: "Player name already belongs to another identity: ちあ" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    const sync = new HttpPollingSessionSync("/api", fetchImpl);

    await expect(sync.save(session, 0)).rejects.toThrow(
      "Player name already belongs to another identity: ちあ",
    );
  });

  it("uses the fallback message when the API response is not JSON", async () => {
    const fetchImpl: typeof fetch = async () => new Response("bad request", { status: 400 });
    const sync = new HttpPollingSessionSync("/api", fetchImpl);

    await expect(sync.save(session, 0)).rejects.toThrow("Failed to save session");
  });
});
