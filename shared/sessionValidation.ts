import type { Hand, HandSeat, Player, Session, SessionEnvelope } from "./types.js";

const MAX_PLAYERS = 8;
const MAX_HANDS = 1000;
const MAX_TEXT_LENGTH = 200;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown, maxLength = MAX_TEXT_LENGTH): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength;

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || (typeof value === "string" && value.length <= MAX_TEXT_LENGTH);

const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

export const isDateOnly = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const isPlayer = (value: unknown): value is Player =>
  isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name);

const isHandSeat = (value: unknown): value is HandSeat =>
  isRecord(value) &&
  isNonEmptyString(value.playerId) &&
  typeof value.score === "number" &&
  Number.isFinite(value.score) &&
  Number.isInteger(value.score);

const isHand = (value: unknown, playerIds: Set<string>): value is Hand => {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isIsoDate(value.createdAt) ||
    !Array.isArray(value.seats) ||
    value.seats.length !== 4 ||
    !value.seats.every(isHandSeat)
  ) {
    return false;
  }
  const seatIds = value.seats.map((seat) => seat.playerId);
  return new Set(seatIds).size === seatIds.length && seatIds.every((id) => playerIds.has(id));
};

export const isSession = (value: unknown): value is Session => {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isIsoDate(value.createdAt) ||
    !(value.day === undefined || isDateOnly(value.day)) ||
    !isOptionalString(value.label) ||
    !Array.isArray(value.players) ||
    value.players.length < 1 ||
    value.players.length > MAX_PLAYERS ||
    !value.players.every(isPlayer) ||
    !Array.isArray(value.hands) ||
    value.hands.length > MAX_HANDS
  ) {
    return false;
  }

  const playerIds = value.players.map((player) => player.id);
  if (new Set(playerIds).size !== playerIds.length) {
    return false;
  }
  const handIds = value.hands.map((hand) => (isRecord(hand) ? hand.id : null));
  if (handIds.some((id) => typeof id !== "string") || new Set(handIds).size !== handIds.length) {
    return false;
  }
  const validPlayerIds = new Set(playerIds);
  return value.hands.every((hand) => isHand(hand, validPlayerIds));
};

export const parseSession = (value: unknown): Session => {
  if (!isSession(value)) {
    throw new Error("Invalid session payload");
  }
  return value;
};

export const isSessionEnvelope = (value: unknown): value is SessionEnvelope => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.version === "number" &&
    Number.isInteger(value.version) &&
    value.version >= 0 &&
    isIsoDate(value.updatedAt) &&
    (value.session === null || isSession(value.session))
  );
};

export const parseSessionEnvelope = (value: unknown): SessionEnvelope => {
  if (!isSessionEnvelope(value)) {
    throw new Error("Invalid session envelope");
  }
  return value;
};
