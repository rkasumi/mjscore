import { useEffect, useMemo, useState } from "react";

import type { Hand, Player } from "../../shared/types";
import {
  buildParticipationCounts,
  buildSeatMap,
  isValidSeatMap,
  pickPlayersByMinCount,
  seatMapToOrderedIds,
  type SeatMap,
} from "../lib/seatPicker";
import {
  loadSeatPickerFixedSeats,
  loadSeatPickerManualSelected,
  loadSeatPickerMode,
  loadSeatPickerSeatMap,
  saveSeatPickerFixedSeats,
  saveSeatPickerManualSelected,
  saveSeatPickerMode,
  saveSeatPickerSeatMap,
  type SeatPickerMode,
} from "../lib/localStorage";

type Props = {
  sessionId: string;
  players: Player[];
  hands: Hand[];
  forcedSeatMap?: SeatMap | null;
  forcedPlayerIds?: string[] | null;
  onSeatMapChange: (seatMap: SeatMap | null, selectedPlayerIds: string[]) => void;
};

export const SeatPicker = ({
  sessionId,
  players,
  hands,
  forcedSeatMap = null,
  forcedPlayerIds = null,
  onSeatMapChange,
}: Props) => {
  const isFour = players.length === 4;
  const isFivePlus = players.length >= 5;
  const validIds = useMemo(() => new Set(players.map((player) => player.id)), [players]);
  const counts = useMemo(() => buildParticipationCounts(hands), [hands]);

  const [mode, setMode] = useState<SeatPickerMode>("auto");
  const [manualSelected, setManualSelected] = useState<string[]>([]);
  const [fixedSeats, setFixedSeats] = useState<SeatMap | null>(null);
  const [autoSelected, setAutoSelected] = useState<string[]>([]);
  const [autoSeatMap, setAutoSeatMap] = useState<SeatMap | null>(null);
  const [manualSeatMap, setManualSeatMap] = useState<SeatMap | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const storedMode = loadSeatPickerMode(sessionId);
    const storedManual = loadSeatPickerManualSelected(sessionId);
    const storedFixed = loadSeatPickerFixedSeats(sessionId);
    const storedSeatMap = loadSeatPickerSeatMap(sessionId);
    setMode(storedMode ?? "auto");
    setManualSelected(storedManual);
    setFixedSeats(storedFixed ?? storedSeatMap);
    setAutoSelected([]);
    setAutoSeatMap(null);
    setManualSeatMap(null);
    setModalOpen(false);
    if (storedSeatMap && isValidSeatMap(storedSeatMap, validIds)) {
      const ordered = seatMapToOrderedIds(storedSeatMap);
      if ((storedMode ?? "auto") === "manual") {
        setManualSelected(ordered);
        setManualSeatMap(storedSeatMap);
      } else {
        setAutoSelected(ordered);
        setAutoSeatMap(storedSeatMap);
      }
    }
  }, [sessionId, validIds]);

  useEffect(() => {
    const nextManual = manualSelected.filter((id) => validIds.has(id));
    if (nextManual.length !== manualSelected.length) {
      setManualSelected(nextManual);
    }
    const nextAuto = autoSelected.filter((id) => validIds.has(id));
    if (nextAuto.length !== autoSelected.length) {
      setAutoSelected(nextAuto);
    }
  }, [autoSelected, manualSelected, validIds]);

  useEffect(() => {
    if (!isFour) {
      return;
    }
    if (fixedSeats !== null && !isValidSeatMap(fixedSeats, validIds)) {
      setFixedSeats(null);
      saveSeatPickerFixedSeats(sessionId, null);
    }
  }, [fixedSeats, isFour, sessionId, validIds]);

  useEffect(() => {
    if (!isFivePlus) {
      return;
    }
    saveSeatPickerMode(sessionId, mode);
  }, [isFivePlus, mode, sessionId]);

  useEffect(() => {
    if (!isFivePlus) {
      return;
    }
    saveSeatPickerManualSelected(sessionId, manualSelected);
  }, [isFivePlus, manualSelected, sessionId]);

  useEffect(() => {
    if (manualSelected.length !== 4) {
      setManualSeatMap(null);
    }
  }, [manualSelected]);

  const resolvedForcedSeatMap = useMemo(() => {
    if (!forcedSeatMap || !forcedPlayerIds || forcedPlayerIds.length !== 4) {
      return null;
    }
    const allValid = forcedPlayerIds.every((id) => validIds.has(id));
    return allValid ? forcedSeatMap : null;
  }, [forcedPlayerIds, forcedSeatMap, validIds]);

  const activeSeatMap = useMemo(() => {
    if (resolvedForcedSeatMap) {
      return resolvedForcedSeatMap;
    }
    if (isFour) {
      return fixedSeats;
    }
    if (mode === "auto") {
      return autoSeatMap;
    }
    return manualSeatMap;
  }, [autoSeatMap, fixedSeats, isFour, manualSeatMap, mode, resolvedForcedSeatMap]);

  const activeSelectedIds = useMemo(() => {
    if (resolvedForcedSeatMap && forcedPlayerIds) {
      return forcedPlayerIds;
    }
    if (isFour) {
      return players.map((player) => player.id);
    }
    return mode === "auto" ? autoSelected : manualSelected;
  }, [autoSelected, forcedPlayerIds, isFour, manualSelected, mode, players, resolvedForcedSeatMap]);

  useEffect(() => {
    if (resolvedForcedSeatMap) {
      return;
    }
    if (activeSeatMap && isValidSeatMap(activeSeatMap, validIds)) {
      saveSeatPickerSeatMap(sessionId, activeSeatMap);
    }
  }, [activeSeatMap, resolvedForcedSeatMap, sessionId, validIds]);

  useEffect(() => {
    onSeatMapChange(activeSeatMap, activeSelectedIds);
  }, [activeSeatMap, activeSelectedIds, onSeatMapChange]);

  const handleShuffleFixed = () => {
    const next = buildSeatMap(players.map((player) => player.id));
    setFixedSeats(next);
    saveSeatPickerFixedSeats(sessionId, next);
  };

  const handleAutoDraw = () => {
    const selected = pickPlayersByMinCount(players, counts, 4);
    const nextSeatMap = buildSeatMap(selected);
    setAutoSelected(selected);
    setAutoSeatMap(nextSeatMap);
    setModalOpen(false);
  };

  const handleManualShuffle = () => {
    if (manualSelected.length !== 4) {
      return;
    }
    setManualSeatMap(buildSeatMap(manualSelected));
    setModalOpen(false);
  };

  const handleManualConfirm = () => {
    if (manualSelected.length !== 4) {
      return;
    }
    setManualSeatMap(buildSeatMap(manualSelected));
    setModalOpen(false);
  };

  if (players.length < 4) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-500">
        プレイヤーを4人以上登録してください。
      </div>
    );
  }

  if (resolvedForcedSeatMap) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
          disabled
        >
          席替え
        </button>
        <span className="text-xs text-slate-400">編集中のため席替えはできません。</span>
      </div>
    );
  }

  if (isFour) {
    const hasFixed = Boolean(activeSeatMap);
    return (
      <button
        type="button"
        className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
          hasFixed
            ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
        }`}
        onClick={handleShuffleFixed}
      >
        {hasFixed ? "席替え" : "席を決める"}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-200"
        onClick={() => setModalOpen(true)}
      >
        {activeSeatMap ? "席替え" : "席を決める"}
      </button>
      {modalOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
            aria-label="close overlay"
          />
          <div className="absolute inset-x-0 top-16 mx-auto w-full max-w-lg px-4">
            <div className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">席決め</div>
                <button
                  type="button"
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  onClick={() => setModalOpen(false)}
                >
                  閉じる
                </button>
              </div>
              <div className="mt-3 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      mode === "auto"
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    onClick={() => setMode("auto")}
                  >
                    自動選出
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      mode === "manual"
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    onClick={() => setMode("manual")}
                  >
                    手動選択
                  </button>
                </div>

                {mode === "auto" ? (
                  <div className="space-y-3">
                    {!autoSeatMap ? (
                      <div className="text-xs text-slate-500">
                        参加回数が少ない人を優先して4人を選出します。
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-200"
                      onClick={handleAutoDraw}
                    >
                      {autoSeatMap ? "引き直し" : "自動で選出して席を決める"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {players.map((player) => {
                        const active = manualSelected.includes(player.id);
                        return (
                          <button
                            key={player.id}
                            type="button"
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              active
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                            onClick={() => {
                              setManualSelected((prev) => {
                                if (prev.includes(player.id)) {
                                  return prev.filter((id) => id !== player.id);
                                }
                                if (prev.length >= 4) {
                                  return prev;
                                }
                                return [...prev, player.id];
                              });
                            }}
                          >
                            {player.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400">
                      参加者を4人ちょうど選択してください（{manualSelected.length}/4）。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                          manualSelected.length === 4
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "cursor-not-allowed bg-slate-100 text-slate-400"
                        }`}
                        onClick={handleManualConfirm}
                        disabled={manualSelected.length !== 4}
                      >
                        席を決める
                      </button>
                      {manualSeatMap ? (
                        <button
                          type="button"
                          className="rounded-2xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200"
                          onClick={handleManualShuffle}
                        >
                          席替え
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
