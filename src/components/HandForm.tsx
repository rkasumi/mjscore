import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NumericFormat } from "react-number-format";

import type { Hand, HandSeat, Player, Session } from "../../shared/types";
import { SeatPicker } from "./SeatPicker";
import {
  buildSeatMapFromOrder,
  seatMapToOrderedIds,
  WIND_LABELS,
  WIND_ORDER,
  type SeatMap,
} from "../lib/seatPicker";

type SeatInput = {
  playerId: string;
  name: string;
  score: string;
};

type Props = {
  session: Session;
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

export const HandForm = ({
  session,
  editingHand,
  onSave,
  onCancelEdit,
}: Props) => {
  const players = session.players;
  const sessionId = session.id;
  const [seats, setSeats] = useState<SeatInput[]>(buildSeats(players, editingHand));
  const [error, setError] = useState<string | null>(null);
  const [autoSuggestEnabled, setAutoSuggestEnabled] = useState(true);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);

  useEffect(() => {
    setSeats(buildSeats(players, editingHand));
    setError(null);
    setAutoSuggestEnabled(true);
  }, [editingHand, players]);

  const editingSeatIds = useMemo(() => {
    if (!editingHand || editingHand.seats.length !== 4) {
      return null;
    }
    return editingHand.seats.map((seat) => seat.playerId);
  }, [editingHand]);
  const forcedSeatMap = useMemo(() => {
    if (!editingSeatIds) {
      return null;
    }
    return buildSeatMapFromOrder(editingSeatIds);
  }, [editingSeatIds]);

  const orderedSeatIds = useMemo(() => seatMapToOrderedIds(seatMap), [seatMap]);
  const selectedSeats = useMemo(() => {
    return orderedSeatIds
      .map((id) => seats.find((seat) => seat.playerId === id) ?? null)
      .filter((seat): seat is SeatInput => Boolean(seat));
  }, [orderedSeatIds, seats]);
  const seatByWind = useMemo(() => {
    if (!seatMap || orderedSeatIds.length !== 4) {
      return null;
    }
    const map = new Map<string, SeatInput>();
    seats.forEach((seat) => map.set(seat.playerId, seat));
    return {
      E: map.get(seatMap.E) ?? null,
      S: map.get(seatMap.S) ?? null,
      W: map.get(seatMap.W) ?? null,
      N: map.get(seatMap.N) ?? null,
    };
  }, [orderedSeatIds.length, seatMap, seats]);

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

  const autoFillCandidate = useMemo(() => {
    if (!autoSuggestEnabled || orderedSeatIds.length !== 4) {
      return null;
    }
    const emptySeats = parsedSelectedSeats.filter(
      (seat) => seat.parsedScore === null && seat.score.trim() === "",
    );
    const filled = parsedSelectedSeats.filter((seat) => seat.parsedScore !== null);
    if (emptySeats.length !== 1 || filled.length !== 3) {
      return null;
    }
    const total = filled.reduce((sum, seat) => sum + (seat.parsedScore ?? 0), 0);
    const remaining = 1000 - total;
    if (!Number.isFinite(remaining) || remaining < 0) {
      return null;
    }
    return { playerId: emptySeats[0].playerId, value: remaining };
  }, [autoSuggestEnabled, orderedSeatIds, parsedSelectedSeats]);

  const validationMessage = useMemo(() => {
    if (players.length < 4) {
      return "プレイヤーを4人以上登録してください。";
    }
    if (orderedSeatIds.length !== 4) {
      return "席を決めてください。";
    }
    const effectiveFilled =
      filledSeats.length + (autoFillCandidate && filledSeats.length === 3 ? 1 : 0);
    if (effectiveFilled !== 4) {
      return "点数が入力されたプレイヤーを4人にしてください。";
    }
    const effectiveTotal = autoFillCandidate
      ? (filledSeats.reduce((sum, seat) => sum + (seat.parsedScore ?? 0), 0) +
          autoFillCandidate.value) *
        100
      : totalScore;
    if (effectiveTotal !== 100000) {
      return "合計点数が100000点になるように入力してください。";
    }
    return null;
  }, [
    autoFillCandidate,
    filledSeats,
    players.length,
    orderedSeatIds,
    totalScore,
  ]);

  const handleScoreChange = (playerId: string, value: string) => {
    if (value !== "" && autoFillCandidate?.playerId === playerId) {
      setAutoSuggestEnabled(false);
    }
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

    const payload = parsedSelectedSeats
      .map((seat) => {
        if (seat.parsedScore !== null) {
          return { playerId: seat.playerId, score: Number(seat.parsedScore) * 100 };
        }
        if (autoFillCandidate && autoFillCandidate.playerId === seat.playerId) {
          return { playerId: seat.playerId, score: autoFillCandidate.value * 100 };
        }
        return null;
      })
      .filter((seat): seat is HandSeat => seat !== null);

    onSave(payload, editingHand?.id);
    if (!editingHand) {
      setSeats(buildSeats(players, null));
    }
    setError(null);
  };

  return (
    <div className="space-y-0.5">
      <SeatPicker
        sessionId={sessionId}
        players={players}
        hands={session.hands}
        forcedSeatMap={forcedSeatMap}
        forcedPlayerIds={editingSeatIds}
        onSeatMapChange={(nextSeatMap) => {
          setSeatMap(nextSeatMap);
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-0.5 pt-2">
        <span className="text-[11px] text-slate-400">空欄は抜け番</span>
        {!autoSuggestEnabled ? (
          <button
            type="button"
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"
            onClick={() => setAutoSuggestEnabled(true)}
          >
            残り候補を再計算
          </button>
        ) : null}
      </div>
      <form className="space-y-1" onSubmit={handleSubmit}>
        {seatByWind ? (
          <div className="grid grid-cols-2 gap-2">
            {(["W", "N", "S", "E"] as const).map((wind) => {
              const seat = seatByWind[wind];
              if (!seat) {
                return null;
              }
              const isFull = wind === "W" || wind === "E";
              const isHalf = wind === "N" || wind === "S";
              return (
                <div
                  key={wind}
                  className={`space-y-0.5 rounded-2xl border border-slate-200 bg-white/80 p-3 ${
                    isFull ? "col-span-2" : ""
                  }`}
                >
                  {isHalf ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                          {WIND_LABELS[wind]}
                        </span>
                        <span className="text-xs leading-snug break-words">{seat.name}</span>
                      </div>
                      <div className="flex w-full items-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-base">
                        <NumericFormat
                          allowNegative
                          decimalScale={0}
                          thousandSeparator={false}
                          valueIsNumericString
                          inputMode="text"
                          className="score-input min-h-[34px] w-full bg-transparent px-2 py-1.5 text-base outline-none"
                          value={seat.score}
                          placeholder={
                            autoFillCandidate && autoFillCandidate.playerId === seat.playerId
                              ? String(autoFillCandidate.value)
                              : ""
                          }
                          onValueChange={(values) =>
                            handleScoreChange(seat.playerId, values.formattedValue)
                          }
                        />
                        <span className="border-l border-slate-200 px-2 py-1 text-slate-500">
                          00
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-w-0 flex-nowrap items-center gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                          {WIND_LABELS[wind]}
                        </span>
                        <span className="min-w-0 truncate text-sm">{seat.name}</span>
                      </div>
                      <div className="flex w-28 items-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-base sm:w-32 md:w-40">
                        <NumericFormat
                          allowNegative
                          decimalScale={0}
                          thousandSeparator={false}
                          valueIsNumericString
                          inputMode="text"
                          className="score-input min-h-[34px] w-full bg-transparent px-2 py-1.5 text-base outline-none"
                          value={seat.score}
                          placeholder={
                            autoFillCandidate && autoFillCandidate.playerId === seat.playerId
                              ? String(autoFillCandidate.value)
                              : ""
                          }
                          onValueChange={(values) =>
                            handleScoreChange(seat.playerId, values.formattedValue)
                          }
                        />
                        <span className="border-l border-slate-200 px-2 py-1 text-slate-500">
                          00
                        </span>
                      </div>
                    </div>
                  )}
                  {autoFillCandidate && autoFillCandidate.playerId === seat.playerId ? (
                    <div className="flex min-h-[12px] flex-wrap items-center gap-1 text-[11px] text-slate-500">
                      <span>残り候補: {autoFillCandidate.value * 100} 点</span>
                      <button
                        type="button"
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200"
                        onClick={() => {
                          setSeats((prev) =>
                            prev.map((item) =>
                              item.playerId === seat.playerId
                                ? { ...item, score: String(autoFillCandidate.value) }
                                : item,
                            ),
                          );
                        }}
                      >
                        残りを入力
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          selectedSeats.map((seat) => {
            const wind = seatMap
              ? WIND_ORDER.find((key) => seatMap[key] === seat.playerId) ?? null
              : null;
            return (
              <div key={seat.playerId} className="space-y-0.5">
                <div className="flex min-w-0 flex-nowrap items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700">
                    {wind ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        {WIND_LABELS[wind]}
                      </span>
                    ) : null}
                    <span className="min-w-0 truncate">{seat.name}</span>
                  </div>
                  <div className="flex w-28 items-center overflow-hidden rounded-2xl border border-slate-200 bg-white/80 text-base sm:w-32 md:w-40">
                    <NumericFormat
                      allowNegative
                      decimalScale={0}
                      thousandSeparator={false}
                      valueIsNumericString
                      inputMode="text"
                      className="score-input min-h-[34px] w-full bg-transparent px-2 py-1.5 text-base outline-none"
                      value={seat.score}
                      placeholder={
                        autoFillCandidate && autoFillCandidate.playerId === seat.playerId
                          ? String(autoFillCandidate.value)
                          : ""
                      }
                      onValueChange={(values) =>
                        handleScoreChange(seat.playerId, values.formattedValue)
                      }
                    />
                    <span className="border-l border-slate-200 px-2 py-1 text-slate-500">00</span>
                  </div>
                </div>
                {autoFillCandidate && autoFillCandidate.playerId === seat.playerId ? (
                  <div className="flex min-h-[12px] flex-wrap items-center gap-1 text-[11px] text-slate-500">
                    <span>残り候補: {autoFillCandidate.value * 100} 点</span>
                    <button
                      type="button"
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200"
                      onClick={() => {
                        setSeats((prev) =>
                          prev.map((item) =>
                            item.playerId === seat.playerId
                              ? { ...item, score: String(autoFillCandidate.value) }
                              : item,
                          ),
                        );
                      }}
                    >
                      残りを入力
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        <div className="flex flex-col gap-0.5 text-[11px] md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
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
        <div className="flex flex-wrap gap-0.5">
          <button
            type="submit"
            className={`rounded-2xl px-3 py-1 text-sm font-semibold ${
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
