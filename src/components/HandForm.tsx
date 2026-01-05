import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { Hand, HandSeat, Player } from "../../shared/types";

type SeatInput = {
  playerId: string;
  name: string;
  score: string;
  isAuto: boolean;
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
      isAuto: false,
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
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);

  useEffect(() => {
    setSeats(buildSeats(players, editingHand));
    setError(null);
  }, [editingHand, players]);

  const selectedSeats = useMemo(
    () => seats.filter((seat) => seatPlayerIds.includes(seat.playerId)),
    [seatPlayerIds, seats],
  );

  const parsedSelectedSeats = useMemo(
    () =>
      selectedSeats.map((seat) => ({
        ...seat,
        parsedScore: parseScore(seat.score),
      })),
    [selectedSeats],
  );

  const filledSeats = useMemo(
    () => parsedSelectedSeats.filter((seat) => seat.parsedScore !== null),
    [parsedSelectedSeats],
  );

  const totalScore = useMemo(() => {
    return parsedSelectedSeats.reduce((sum, seat) => sum + (seat.parsedScore ?? 0) * 100, 0);
  }, [parsedSelectedSeats]);

  const remainingScore = 100000 - totalScore;

  useEffect(() => {
    const clearAutoFlags = () =>
      setSeats((prev) => {
        let changed = false;
        const next = prev.map((seat) => {
          if (!seat.isAuto) {
            return seat;
          }
          changed = true;
          return { ...seat, isAuto: false };
        });
        return changed ? next : prev;
      });

    if (!autoFillEnabled || seatPlayerIds.length !== 4) {
      clearAutoFlags();
      return;
    }
    const emptySeats = parsedSelectedSeats.filter(
      (seat) => seat.parsedScore === null && seat.score.trim() === "",
    );
    const filled = parsedSelectedSeats.filter((seat) => seat.parsedScore !== null);
    if (emptySeats.length === 1 && filled.length === 3) {
      const total = filled.reduce((sum, seat) => sum + (seat.parsedScore ?? 0), 0);
      const remaining = 1000 - total;
      const targetId = emptySeats[0].playerId;
      setSeats((prev) => {
        let changed = false;
        const nextScore = Number.isFinite(remaining) ? String(remaining) : "";
        const next = prev.map((seat) => {
          if (seat.playerId !== targetId) {
            if (seat.isAuto) {
              changed = true;
              return { ...seat, isAuto: false };
            }
            return seat;
          }
          if (seat.score === nextScore && seat.isAuto) {
            return seat;
          }
          changed = true;
          return { ...seat, score: nextScore, isAuto: true };
        });
        return changed ? next : prev;
      });
      return;
    }
    clearAutoFlags();
  }, [autoFillEnabled, parsedSelectedSeats, seatPlayerIds]);

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

  const handleScoreChange = (playerId: string, value: string) => {
    setSeats((prev) =>
      prev.map((seat) =>
        seat.playerId === playerId ? { ...seat, score: value, isAuto: false } : seat,
      ),
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-400">空欄は抜け番</span>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={autoFillEnabled}
            onChange={(event) => setAutoFillEnabled(event.target.checked)}
          />
          最後の1人を自動計算
        </label>
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
          <div key={seat.playerId} className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>{seat.name}</span>
                {seat.isAuto ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    自動
                  </span>
                ) : null}
              </div>
            </div>
            <div
              className={`flex items-center overflow-hidden rounded-2xl border border-slate-200 text-base ${
                seat.isAuto ? "bg-amber-50" : "bg-white/80"
              }`}
            >
              <input
                type="number"
                step={1}
                inputMode="numeric"
                pattern="[0-9]*"
                className="min-h-[44px] w-full bg-transparent px-3 py-2 text-base outline-none"
                value={seat.score}
                onChange={(event) => handleScoreChange(seat.playerId, event.target.value)}
              />
              <span className="border-l border-slate-200 px-3 py-2 text-slate-500">00</span>
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            <span>合計: {totalScore} 点</span>
            <span
              className={`font-semibold ${
                remainingScore === 0
                  ? "text-emerald-600"
                  : remainingScore > 0
                    ? "text-amber-600"
                    : "text-rose-600"
              }`}
            >
              残り: {remainingScore} 点
              {remainingScore > 0 ? "（不足）" : remainingScore < 0 ? "（超過）" : ""}
            </span>
          </div>
          {validationMessage && !error ? (
            <span className="text-slate-400">{validationMessage}</span>
          ) : null}
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
              validationMessage
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            }`}
            disabled={Boolean(validationMessage)}
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
