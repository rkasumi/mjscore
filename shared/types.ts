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
  players: Player[];
  hands: Hand[];
};
