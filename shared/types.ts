export type Player = {
  id: string;
  name: string;
};

export type HandSeat = {
  playerId: string;
  score: number;
};

export type Hand = {
  id: string;
  seats: HandSeat[];
  createdAt: string;
};

export type Session = {
  id: string;
  createdAt: string;
  day?: string;
  label?: string;
  players: Player[];
  hands: Hand[];
};

export type SessionEnvelope = {
  version: number;
  updatedAt: string;
  session: Session | null;
};

export type SessionStatus = "active" | "finalized" | "voided";

export type SessionSummary = {
  id: string;
  day?: string;
  label?: string;
  status: SessionStatus;
  handsCount: number;
  playerNames: string[];
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
};
