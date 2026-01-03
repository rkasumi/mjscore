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
  seatPlayerIds: string[];
  onToggleSeat: (playerId: string) => void;
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

export const HandForm = ({
  players,
  editingHand,
  seatPlayerIds,
  onToggleSeat,
  onSave,
  onCancelEdit,
}: Props) => {
  const [seats, setSeats] = useState<SeatInput[]>(buildSeats(players, editingHand));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSeats(buildSeats(players, editingHand));
    setError(null);
  }, [editingHand, players]);

  const filledSeats = useMemo(() => {
    return seats
      .filter((seat) => seatPlayerIds.includes(seat.playerId))
      .map((seat) => ({
        ...seat,
        parsedScore: parseScore(seat.score),
      }))
      .filter((seat) => seat.parsedScore !== null);
  }, [seatPlayerIds, seats]);

  const totalScore = useMemo(() => {
    return filledSeats.reduce((sum, seat) => sum + (seat.parsedScore ?? 0) * 100, 0);
  }, [filledSeats]);

  const validationMessage = useMemo(() => {
    if (players.length < 4) {
      return "プレイヤーを4人以上登録してください。";
    }
    if (seatPlayerIds.length !== 4) {
      return "参加者を4人選択してください。";
    }
    if (filledSeats.length !== 4) {
      return "点数が入力されたプレイヤーを4人にしてください。";
    }
    if (totalScore !== 100000) {
      return "合計点数が100000点になるように入力してください。";
    }
    return null;
  }, [players.length, filledSeats.length, seatPlayerIds.length, totalScore]);

  const selectedSeats = useMemo(
    () => seats.filter((seat) => seatPlayerIds.includes(seat.playerId)),
    [seatPlayerIds, seats],
  );

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">空欄は抜け番</span>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {players.map((player) => {
            const active = seatPlayerIds.includes(player.id);
            return (
              <button
                key={player.id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => onToggleSeat(player.id)}
              >
                {player.name}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          参加者を4人ちょうど選択してください（{seatPlayerIds.length}/4）。
        </p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {selectedSeats.map((seat) => (
          <div key={seat.playerId} className="grid gap-3 md:grid-cols-[1fr_160px]">
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
              {seat.name}
            </div>
            <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-white/80 text-sm">
              <input
                type="number"
                step={1}
                className="w-full bg-transparent px-3 py-2 outline-none"
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
