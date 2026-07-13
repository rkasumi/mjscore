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

export type SessionDetail = {
  summary: SessionSummary;
  session: Session;
};

export type Season = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  createdAt: string;
};

export type PlayerAnalytics = {
  playerId: string;
  name: string;
  hands: number;
  totalPoint: number;
  averagePoint: number | null;
  averageRank: number | null;
  rankCounts: [number, number, number, number];
  topRate: number | null;
  lastRate: number | null;
};

export type HeadToHeadAnalytics = {
  playerAId: string;
  playerBId: string;
  sharedHands: number;
  playerAHigher: number;
  playerBHigher: number;
  ties: number;
  playerAPoint: number;
  playerBPoint: number;
};

export type PlayerRecord = {
  playerId: string;
  highestScore: number | null;
  lowestScore: number | null;
  bestPoint: number | null;
  worstPoint: number | null;
  longestTopStreak: number;
};

export type AnalyticsResponse = {
  from: string | null;
  to: string | null;
  sessions: number;
  hands: number;
  players: PlayerAnalytics[];
  headToHead: HeadToHeadAnalytics[];
  records: PlayerRecord[];
};
