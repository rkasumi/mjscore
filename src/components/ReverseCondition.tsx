import { useMemo, useState } from "react";

import type { Player, Session } from "../../shared/types";
import type { SessionAggregate } from "../lib/aggregation";
import {
  calculateReverseConditions,
  buildNaturalLanguageSummary,
  type ConditionScenario,
} from "../lib/reversal";

type Props = {
  players: Player[];
  seatPlayerIds: string[];
  onToggleSeat: (playerId: string) => void;
  session?: Session | null;
  aggregate?: SessionAggregate | null;
  note?: string;
};

const NOTE_TEXT =
  "同点が起きると順位点が平均配分され、条件が変わる場合があります。同点になるとウマが平均され、条件が前後する可能性があります。";

const TOOLTIP_LINES = [
  "1着：+50,000点",
  "2着：+10,000点",
  "3着：-10,000点",
  "4着：-30,000点",
];

const GapValue = ({ value }: { value: number }) => {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="font-semibold text-slate-900 underline decoration-dotted"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onTouchStart={() => setOpen(true)}
        onTouchEnd={() => setOpen(false)}
      >
        {value.toLocaleString()}点差
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-50 mt-1 w-52 rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white">
          {TOOLTIP_LINES.map((line) => (
            <span key={line} className="block leading-4">
              {line}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
};

const StandingsSummary = ({
  aggregate,
  seatPlayerIds,
}: {
  aggregate: SessionAggregate;
  seatPlayerIds: string[];
}) => {
  const seatSet = new Set(seatPlayerIds);
  const sorted = [...aggregate.players].sort((a, b) => a.rank - b.rank);

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-3">
      <h4 className="mb-2 text-xs font-semibold text-slate-500">現在の順位</h4>
      <div className="space-y-1">
        {sorted.map((player, index) => {
          const isSeated = seatSet.has(player.playerId);
          const prevPlayer = index > 0 ? sorted[index - 1] : null;
          const diff = prevPlayer
            ? player.totalPoint - prevPlayer.totalPoint
            : 0;
          return (
            <div
              key={player.playerId}
              className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${
                isSeated
                  ? "bg-white font-semibold text-slate-800"
                  : "text-slate-400"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 text-right">{player.rank}.</span>
                <span>{player.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span>{player.totalPoint.toFixed(1)}pt</span>
                {index > 0 ? (
                  <span className="text-[10px] text-slate-400">
                    ({diff > 0 ? "+" : ""}
                    {diff.toFixed(1)})
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ConditionSection = ({
  title,
  scenarios,
  playerMap,
}: {
  title: string;
  scenarios: ConditionScenario[];
  playerMap: Map<string, Player>;
}) => {
  if (scenarios.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <div className="mt-2 text-xs text-slate-400">逆転不可</div>
      </div>
    );
  }

  const byRank = new Map<number, ConditionScenario[]>();
  for (const s of scenarios) {
    const list = byRank.get(s.rank) ?? [];
    list.push(s);
    byRank.set(s.rank, list);
  }
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      <p className="mt-1 text-[11px] text-slate-500">
        総合pt = 素点pt + 順位点（同点時は平均配分）
      </p>
      <div className="mt-3 space-y-3">
        {ranks.map((rank) => {
          const rankScenarios = byRank.get(rank) ?? [];
          const best = [...rankScenarios].sort(
            (a, b) => a.difficulty - b.difficulty,
          )[0];
          if (!best) return null;
          return (
            <div
              key={rank}
              className="overflow-visible rounded-lg border border-slate-200 bg-white"
            >
              <div className="border-b border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-500">
                あなた: {rank}着
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-2 py-1">相手</th>
                    <th className="px-2 py-1">点差条件</th>
                  </tr>
                </thead>
                <tbody>
                  {best.needGaps.length === 0 && !best.needScoreMin ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="border-t border-slate-200 px-2 py-1 text-slate-400"
                      >
                        条件なし（確定）
                      </td>
                    </tr>
                  ) : (
                    <>
                      {best.needGaps.map((gap) => {
                        const name =
                          playerMap.get(gap.targetId)?.name ?? "不明";
                        return (
                          <tr key={gap.targetId}>
                            <td className="border-t border-slate-200 px-2 py-1 text-slate-600">
                              {name}
                            </td>
                            <td className="border-t border-slate-200 px-2 py-1 text-slate-700">
                              <GapValue value={gap.gap} />
                            </td>
                          </tr>
                        );
                      })}
                      {best.needScoreMin ? (
                        <tr>
                          <td className="border-t border-slate-200 px-2 py-1 text-slate-600">
                            非参加者含む
                          </td>
                          <td className="border-t border-slate-200 px-2 py-1 text-slate-700">
                            得点が{" "}
                            <span className="font-semibold text-slate-900">
                              {best.needScoreMin.toLocaleString()}点以上
                            </span>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ReverseCondition = ({
  players,
  seatPlayerIds,
  onToggleSeat,
  session,
  aggregate,
  note,
}: Props) => {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const playerNameMap = new Map(
    players.map((player) => [player.id, player.name]),
  );
  const seatPlayers = seatPlayerIds
    .map((playerId) => playerMap.get(playerId))
    .filter((player): player is Player => Boolean(player));

  const reverseResult = useMemo(() => {
    if (!session || seatPlayerIds.length !== 4) return null;
    return calculateReverseConditions(session, seatPlayerIds);
  }, [session, seatPlayerIds]);

  const playerRankMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!aggregate) return map;
    for (const p of aggregate.players) {
      map.set(p.playerId, p.rank);
    }
    return map;
  }, [aggregate]);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
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
      {seatPlayers.length !== 4 ? (
        <p className="text-sm text-slate-400">
          次局の参加者が4人そろっていません。{note}
        </p>
      ) : (
        <div className="space-y-5">
          {aggregate ? (
            <StandingsSummary
              aggregate={aggregate}
              seatPlayerIds={seatPlayerIds}
            />
          ) : null}
          {seatPlayers.map((player) => {
            const overallRank = playerRankMap.get(player.id) ?? 0;
            const isFirst = overallRank === 1;

            const oneUpScenarios =
              reverseResult?.overallOneUpTopN.filter(
                (s) => s.playerId === player.id,
              ) ?? [];
            const toFirstScenarios =
              reverseResult?.overallToFirstTopN.filter(
                (s) => s.playerId === player.id,
              ) ?? [];

            const minRankOneUp = reverseResult?.maxRankOneUp.get(player.id) ?? null;
            const minRankFirst = reverseResult?.maxRankToFirst.get(player.id) ?? null;
            const relevantMinRank = isFirst ? minRankFirst : minRankOneUp;

            const oneUpTargetRank = overallRank > 1 ? overallRank - 1 : null;
            const oneUpSummary =
              oneUpTargetRank !== null
                ? buildNaturalLanguageSummary({
                    scenarios: oneUpScenarios,
                    targetRank: oneUpTargetRank,
                    playerMap: playerNameMap,
                  })
                : null;
            const firstSummary = !isFirst
              ? buildNaturalLanguageSummary({
                  scenarios: toFirstScenarios,
                  targetRank: 1,
                  playerMap: playerNameMap,
                })
              : null;

            return (
              <div key={player.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {player.name}
                  </h3>
                  <span className="text-xs text-slate-400">
                    （現在{overallRank}位）
                  </span>
                  {relevantMinRank !== null ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      最低{relevantMinRank}着が必要
                    </span>
                  ) : !isFirst ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                      逆転不可
                    </span>
                  ) : null}
                </div>

                {oneUpSummary ? (
                  <p
                    className={`text-xs ${
                      oneUpSummary.level === "impossible"
                        ? "text-slate-400"
                        : oneUpSummary.level === "easy"
                          ? "text-emerald-600"
                          : "text-amber-700"
                    }`}
                  >
                    {oneUpSummary.text}
                  </p>
                ) : null}
                {firstSummary && firstSummary.level !== "impossible" ? (
                  <p
                    className={`text-xs ${
                      firstSummary.level === "easy"
                        ? "text-emerald-600"
                        : "text-amber-700"
                    }`}
                  >
                    {firstSummary.text}
                  </p>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  {!isFirst ? (
                    <ConditionSection
                      title={`1つ上の順位条件（→総合${oneUpTargetRank}位へ）`}
                      scenarios={oneUpScenarios}
                      playerMap={playerMap}
                    />
                  ) : null}
                  <ConditionSection
                    title={isFirst ? "総合1位維持条件" : "総合1位条件"}
                    scenarios={toFirstScenarios}
                    playerMap={playerMap}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-400">{NOTE_TEXT}</p>
          {note ? <p className="text-xs text-slate-400">{note}</p> : null}
        </div>
      )}
    </div>
  );
};
