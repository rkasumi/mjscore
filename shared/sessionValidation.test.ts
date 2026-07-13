import { describe, expect, it } from "vitest";

import {
  isSession,
  isSessionEnvelope,
  parseSession,
  parseSessionEnvelope,
} from "./sessionValidation.js";

const validSession = {
  id: "session-1",
  createdAt: "2026-07-13T00:00:00.000Z",
  day: "2026-07-13",
  players: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })),
  hands: [
    {
      id: "hand-1",
      createdAt: "2026-07-13T01:00:00.000Z",
      seats: ["a", "b", "c", "d"].map((playerId, index) => ({
        playerId,
        score: 40000 - index * 10000,
      })),
    },
  ],
};

describe("session validation", () => {
  it("accepts a structurally valid session", () => {
    expect(isSession(validSession)).toBe(true);
    expect(parseSession(validSession)).toEqual(validSession);
  });

  it("rejects duplicate player ids", () => {
    const invalid = {
      ...validSession,
      players: validSession.players.map((player) => ({ ...player, id: "same" })),
    };
    expect(isSession(invalid)).toBe(false);
  });

  it("rejects hands that reference unknown players", () => {
    const invalid = structuredClone(validSession);
    invalid.hands[0]!.seats[0]!.playerId = "unknown";
    expect(isSession(invalid)).toBe(false);
  });

  it("rejects non-finite scores", () => {
    const invalid = structuredClone(validSession);
    invalid.hands[0]!.seats[0]!.score = Number.NaN;
    expect(isSession(invalid)).toBe(false);
  });

  it("validates session envelopes", () => {
    const envelope = {
      version: 2,
      updatedAt: "2026-07-13T02:00:00.000Z",
      session: validSession,
    };
    expect(isSessionEnvelope(envelope)).toBe(true);
    expect(parseSessionEnvelope(envelope)).toEqual(envelope);
    expect(isSessionEnvelope({ ...envelope, version: -1 })).toBe(false);
  });
});
