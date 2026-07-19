import { useEffect, useMemo, useState } from "react";

import type { Session } from "../../shared/types";
import {
  buildDisplayReverseCards,
  calculatePaceEstimate,
  type DisplayConditionMode,
  type DisplayReverseCard,
} from "../lib/displayInsights";

type Props = {
  session: Session;
  seatPlayerIds: string[];
};

export const DisplayInsights = ({ session, seatPlayerIds }: Props) => {
  const [conditionMode, setConditionMode] =
    useState<DisplayConditionMode>("first");
  const cards = useMemo(
    () => buildDisplayReverseCards(session, seatPlayerIds, conditionMode),
    [conditionMode, seatPlayerIds, session],
  );
  const [now, setNow] = useState(() => new Date());
  const pace = useMemo(() => calculatePaceEstimate(session.hands, now), [now, session.hands]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setConditionMode((current) =>
          current === "first" ? "rank-up" : "first",
        ),
      10000,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex shrink-0 items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-2xl text-slate-900">逆転条件</h2>
          <div
            role="tablist"
            aria-label="逆転条件の表示"
            className="inline-flex rounded-full bg-slate-100 p-1"
          >
            {(
              [
                ["first", "1位条件"],
                ["rank-up", "着順アップ条件"],
              ] as const
            ).map(([mode, label]) => {
              const active = conditionMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    active
                      ? mode === "first"
                        ? "bg-amber-200 text-amber-950 shadow-sm"
                        : "bg-emerald-200 text-emerald-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                  onClick={() => setConditionMode(mode)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          <span className="font-semibold">半荘ペース</span>{" "}
          {pace ? (
            <>
              約{pace.medianMinutes}分・終了予測{" "}
              {pace.predictedEndAt.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </>
          ) : (
            "データ不足"
          )}
        </div>
      </header>
      {seatPlayerIds.length !== 4 ? (
        <div className="grid flex-1 place-items-center rounded-xl bg-slate-50 text-slate-500">
          次局の参加者を4人選ぶと逆転条件を表示します。
        </div>
      ) : (
        <div
          aria-live="polite"
          className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3"
        >
          {cards.map((card) => (
            <ReverseConditionCard key={card.playerId} card={card} />
          ))}
        </div>
      )}
    </section>
  );
};

const ReverseConditionCard = ({ card }: { card: DisplayReverseCard }) => (
  <article
    aria-label={`${card.playerName}の逆転条件`}
    className={`grid min-h-0 grid-cols-[minmax(8rem,0.8fr)_auto_minmax(0,1.8fr)] items-center gap-3 overflow-hidden rounded-2xl border p-3 ${
      card.available
        ? card.targetRank === 1
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
        : "border-slate-200 bg-slate-50"
    }`}
  >
    <div className="min-w-0">
      <h3 className="truncate font-display text-[clamp(1.15rem,1.6vw,1.5rem)] text-slate-900">
        {card.playerName}
      </h3>
      <p className="text-xs text-slate-500">現在 総合{card.currentRank}位</p>
      <span
        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
          card.available
            ? card.targetRank === 1
              ? "bg-amber-200/80 text-amber-950"
              : "bg-emerald-200/80 text-emerald-950"
            : "bg-slate-200 text-slate-600"
        }`}
      >
        {card.targetLabel}
      </span>
    </div>
    {card.ownPlacement ? (
      <>
        <div className="text-center">
          <span className="block text-[10px] font-semibold text-slate-500">次局</span>
          <strong className="whitespace-nowrap text-[clamp(1.25rem,2vw,1.9rem)] leading-tight text-slate-950">
            {card.ownPlacement}
          </strong>
        </div>
        <div className="flex min-w-0 flex-wrap content-center gap-1.5">
          {card.requirements.map((requirement) => (
            <div
              key={`${requirement.label}-${requirement.value ?? ""}`}
              className="flex min-w-0 items-baseline gap-2 rounded-lg bg-white/80 px-2.5 py-1.5"
            >
              <span className="text-[clamp(0.8rem,1.1vw,1rem)] font-semibold text-slate-700">
                {requirement.label}
              </span>
              {requirement.value ? (
                <strong className="whitespace-nowrap text-[clamp(0.95rem,1.45vw,1.3rem)] text-slate-950">
                  {requirement.value}
                </strong>
              ) : null}
            </div>
          ))}
          {card.requirements.length === 0 ? (
            <div className="rounded-lg bg-white/80 px-3 py-1.5 text-sm text-slate-600">
              点差条件なし
            </div>
          ) : null}
        </div>
      </>
    ) : (
      <div className="col-span-2 grid place-content-center gap-1 text-center">
        <strong className="text-[clamp(1rem,1.6vw,1.4rem)] text-slate-600">
          {card.statusMessage ?? "条件を計算できません"}
        </strong>
        {card.gapToNextRank !== null ? (
          <span className="text-sm text-slate-500">
            直上との差 {card.gapToNextRank.toFixed(1)}pt
          </span>
        ) : null}
      </div>
    )}
  </article>
);
