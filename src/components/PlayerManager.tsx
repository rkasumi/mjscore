import { useMemo, useState } from "react";

import type { Hand, Player } from "../../shared/types";

type DraftSlot = {
  id: string;
  name: string;
};

type Props = {
  players: Player[];
  hands: Hand[];
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
};

const ensureSlots = (count: number): DraftSlot[] =>
  Array.from({ length: count }, (_, index) => ({ id: `slot-${index}`, name: "" }));

export const PlayerManager = ({ players, hands, onAdd, onRename, onRemove }: Props) => {
  const [draftSlots, setDraftSlots] = useState<DraftSlot[]>(ensureSlots(4));
  const [extraName, setExtraName] = useState("");

  const usedPlayers = useMemo(() => {
    const ids = new Set<string>();
    for (const hand of hands) {
      for (const seat of hand.seats) {
        ids.add(seat.playerId);
      }
    }
    return ids;
  }, [hands]);

  const baseSlots = Math.max(4, players.length);
  const slots = ensureSlots(baseSlots);

  const canAddExtra = players.length < 6 && extraName.trim().length > 0;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="section-title">プレイヤー管理</h2>
        <span className="text-xs text-slate-400">最大6人</span>
      </div>
      <div className="mt-4 space-y-3">
        {slots.map((slot, index) => {
          const player = players[index];
          const isFixed = index < 2;
          if (player) {
            const isLocked = usedPlayers.has(player.id);
            return (
              <div
                key={player.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 md:flex-row md:items-center"
              >
                <input
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={player.name}
                  onChange={(event) => onRename(player.id, event.target.value)}
                  disabled={isFixed}
                />
                {!isFixed ? (
                  <button
                    type="button"
                    className={`rounded-xl px-3 py-2 text-sm transition ${
                      isLocked
                        ? "cursor-not-allowed bg-slate-100 text-slate-400"
                        : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                    }`}
                    onClick={() => onRemove(player.id)}
                    disabled={isLocked}
                  >
                    削除
                  </button>
                ) : (
                  <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
                    固定
                  </span>
                )}
                {isLocked && !isFixed ? (
                  <span className="text-xs text-slate-500">履歴に使われています</span>
                ) : null}
              </div>
            );
          }

          const draft = draftSlots[index] ?? slot;
          if (isFixed) {
            return (
              <div
                key={slot.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 md:flex-row md:items-center"
              >
                <input
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={index === 0 ? "プレイヤー1" : "プレイヤー2"}
                  disabled
                />
                <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
                  固定
                </span>
              </div>
            );
          }
          const canAdd = players.length < 6 && draft.name.trim().length > 0;

          return (
            <div
              key={slot.id}
              className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-3 md:flex-row md:items-center"
            >
              <input
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder={`プレイヤー${index + 1}`}
                value={draft.name}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraftSlots((prev) => {
                    const next = [...prev];
                    next[index] = { ...draft, name: value };
                    return next;
                  });
                }}
              />
              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-sm transition ${
                  canAdd
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                }`}
                onClick={() => {
                  if (!canAdd) {
                    return;
                  }
                  onAdd(draft.name.trim());
                  setDraftSlots((prev) => {
                    const next = [...prev];
                    next[index] = { ...draft, name: "" };
                    return next;
                  });
                }}
                disabled={!canAdd}
              >
                登録
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
        <input
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
          placeholder="追加プレイヤー（5人目以降）"
          value={extraName}
          onChange={(event) => setExtraName(event.target.value)}
        />
        <button
          type="button"
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            canAddExtra
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
          onClick={() => {
            if (!canAddExtra) {
              return;
            }
            onAdd(extraName.trim());
            setExtraName("");
          }}
          disabled={!canAddExtra}
        >
          追加
        </button>
      </div>
    </div>
  );
};
