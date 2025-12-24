import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { Hand, HandSeat, Player } from "../../shared/types";

type SeatInput = {
  playerId: string;
  name: string;
  score: string;
};

type Props = {
  players: Player[];
  editingHand: Hand | null;
  onSave: (seats: HandSeat[], editingId?: string) => void;
  onCancelEdit: () => void;
};

const buildSeats = (players: Player[], hand: Hand | null): SeatInput[] =>
  players.map((player) => {
    const match = hand?.seats.find((seat) => seat.playerId === player.id);
    return {
      playerId: player.id,
      name: player.name,
      score: match ? String(match.score / 100) : "",
    };
  });

const parseScore = (value: string): number | null => {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const HandForm = ({ players, editingHand, onSave, onCancelEdit }: Props) => {
  const [seats, setSeats] = useState<SeatInput[]>(buildSeats(players, editingHand));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSeats(buildSeats(players, editingHand));
    setError(null);
  }, [editingHand, players]);

  const filledSeats = useMemo(() => {
    return seats
      .map((seat) => ({
        ...seat,
        parsedScore: parseScore(seat.score),
      }))
      .filter((seat) => seat.parsedScore !== null);
  }, [seats]);

  const totalScore = useMemo(() => {
    return filledSeats.reduce((sum, seat) => sum + (seat.parsedScore ?? 0) * 100, 0);
  }, [filledSeats]);

  const validationMessage = useMemo(() => {
    if (players.length < 4) {
      return "プレイヤーを4人以上登録してください。";
    }
    if (filledSeats.length !== 4) {
      return "点数が入力されたプレイヤーを4人にしてください。";
    }
    if (totalScore !== 100000) {
      return "合計点数が100000点になるように入力してください。";
    }
    return null;
  }, [players.length, filledSeats.length, totalScore]);

  const handleScoreChange = (playerId: string, value: string) => {
    setSeats((prev) =>
      prev.map((seat) => (seat.playerId === playerId ? { ...seat, score: value } : seat)),
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const payload = filledSeats.map((seat) => ({
      playerId: seat.playerId,
      score: Number(seat.parsedScore) * 100,
    }));

    onSave(payload, editingHand?.id);
    if (!editingHand) {
      setSeats(buildSeats(players, null));
    }
    setError(null);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="section-title">半荘入力</h2>
        <span className="text-xs text-slate-400">空欄は抜け番</span>
      </div>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        {seats.map((seat) => (
          <div key={seat.playerId} className="grid gap-3 md:grid-cols-[1fr_160px]">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
              {seat.name}
            </div>
            <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
              <input
                type="number"
                step={1}
                className="w-full bg-transparent px-3 py-2 outline-none"
                placeholder="点数 (100点単位)"
                value={seat.score}
                onChange={(event) => handleScoreChange(seat.playerId, event.target.value)}
              />
              <span className="border-l border-slate-200 px-3 py-2 text-slate-500">00</span>
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-2 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <span>合計: {totalScore} 点</span>
          {validationMessage && !error ? <span>{validationMessage}</span> : null}
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-200"
          >
            {editingHand ? "更新" : "追加"}
          </button>
          {editingHand ? (
            <button
              type="button"
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
              onClick={onCancelEdit}
            >
              編集をやめる
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
};
