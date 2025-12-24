import { useState } from "react";

import type { Player } from "../../shared/types";
import type { BaseOnlyCondition } from "../lib/reversal";

type Props = {
  players: Player[];
  seatPlayerIds: string[];
  onToggleSeat: (playerId: string) => void;
  baseOnlyConditions: BaseOnlyCondition[];
  note?: string;
};

const NOTE_TEXT =
  "同点が起きると順位点が平均配分され、条件が変わる場合があります。";

const formatScore = (value: number): string => `${value.toLocaleString()}点以上`;
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

const groupBaseOnly = (conditions: BaseOnlyCondition[]): Map<string, BaseOnlyCondition> => {
  const map = new Map<string, BaseOnlyCondition>();
  conditions.forEach((condition) => {
    map.set(condition.playerId, condition);
  });
  return map;
};

const BaseOnlyTable = ({
  condition,
  playerId,
  seatPlayerIds,
  playerMap,
}: {
  condition: BaseOnlyCondition | undefined;
  playerId: string;
  seatPlayerIds: string[];
  playerMap: Map<string, Player>;
}) => {
  if (!condition) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">素点条件（順位点無視）</h3>
      </div>
      <div className="mt-3 overflow-visible rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 text-left text-slate-500">
              <th className="px-2 py-1">相手</th>
              <th className="px-2 py-1">点差条件</th>
            </tr>
          </thead>
          <tbody>
            {seatPlayerIds
              .filter((seatId) => seatId !== playerId)
              .map((targetId) => {
                const targetName = playerMap.get(targetId)?.name ?? "不明";
                const gap = condition.needGaps.find((item) => item.targetId === targetId);
                return (
                  <tr key={`${playerId}-${targetId}-base`}>
                    <td className="border-t border-slate-200 px-2 py-1 text-slate-600">
                      {targetName}
                    </td>
                    <td className="border-t border-slate-200 px-2 py-1 text-slate-700">
                      {gap ? (
                        <GapValue value={gap.gap} />
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            <tr>
              <td className="border-t border-slate-200 px-2 py-1 text-slate-600">
                非参加者含む
              </td>
              <td className="border-t border-slate-200 px-2 py-1 text-slate-700">
                {condition.needScoreMin ? (
                  <>
                    得点が{" "}
                    <span className="font-semibold text-slate-900">
                      {formatScore(condition.needScoreMin)}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

type OverallFirstRow = {
  targetId: string | null;
  rank: number;
  gap: number | null;
};

type OverallFirstTable = {
  playerRank: number;
  rows: OverallFirstRow[];
};

const RANK_POINTS = [50, 10, -10, -30];

const bonusForRank = (rank: number): number => RANK_POINTS[rank - 1] ?? 0;

const buildOverallFirstTables = ({
  baseCondition,
  desiredRank,
  rankSlots,
}: {
  baseCondition: BaseOnlyCondition | undefined;
  desiredRank: number;
  rankSlots: number[];
}): OverallFirstTable[] => {
  if (!baseCondition || baseCondition.needGaps.length === 0) {
    return [];
  }

  const orderedBaseTargets = [...baseCondition.needGaps].sort((a, b) => a.gap - b.gap);
  const targetIds = orderedBaseTargets.map((item) => item.targetId);
  const isEasy = targetIds.length < 3;
  const bonusP = bonusForRank(desiredRank);

  const orderedTargets = isEasy
    ? orderedBaseTargets
    : [...orderedBaseTargets].sort((a, b) => b.gap - a.gap);

  const rankPriority = [...rankSlots].sort(
    (a, b) => bonusForRank(a) - bonusForRank(b),
  );

  const assigned = new Map<number, string>();
  if (isEasy) {
    rankSlots.forEach((rank, index) => {
      const target = orderedTargets[index];
      if (target) {
        assigned.set(rank, target.targetId);
      }
    });
  } else {
    rankPriority.forEach((rank, index) => {
      const target = orderedTargets[index];
      if (target) {
        assigned.set(rank, target.targetId);
      }
    });
  }

  const baseGapMap = new Map(orderedBaseTargets.map((item) => [item.targetId, item.gap]));
  const rows = rankSlots.map((rank) => {
    const targetId = assigned.get(rank) ?? null;
    if (!targetId) {
      return { targetId: null, rank, gap: null };
    }
    const baseGap = baseGapMap.get(targetId) ?? 0;
    const bonusQ = bonusForRank(rank);
    const adjustedGap = baseGap - 1000 * (bonusP - bonusQ);
    return {
      targetId,
      rank,
      gap: adjustedGap > 0 ? adjustedGap : null,
    };
  });

  return [{ playerRank: desiredRank, rows }];
};

export const ReverseCondition = ({
  players,
  seatPlayerIds,
  onToggleSeat,
  baseOnlyConditions,
  note,
}: Props) => {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const seatPlayers = seatPlayerIds
    .map((playerId) => playerMap.get(playerId))
    .filter((player): player is Player => Boolean(player));
  const baseOnlyMap = groupBaseOnly(baseOnlyConditions);

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
          {seatPlayers.map((player) => (
            <div key={player.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">{player.name}</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <BaseOnlyTable
                  condition={baseOnlyMap.get(player.id)}
                  playerId={player.id}
                  seatPlayerIds={seatPlayerIds}
                  playerMap={playerMap}
                />
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">総合1位条件</h3>
                  </div>
                  {(() => {
                    const rank1Tables = buildOverallFirstTables({
                      baseCondition: baseOnlyMap.get(player.id),
                      desiredRank: 1,
                      rankSlots: [2, 3, 4],
                    });
                    const tables = [...rank1Tables];
                    if (tables.length === 0) {
                      return <div className="mt-3 text-xs text-slate-400">-</div>;
                    }
                    return (
                      <div className="mt-3 space-y-3">
                        {tables.map((table, index) => (
                          <div
                            key={`${player.id}-overall-${index}`}
                            className="overflow-visible rounded-lg border border-slate-200 bg-white"
                          >
                            <div className="border-b border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-500">
                              あなた: {table.playerRank}着
                            </div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-slate-500">
                                  <th className="px-2 py-1">順位</th>
                                  <th className="px-2 py-1">プレイヤー</th>
                                  <th className="px-2 py-1">点差</th>
                                </tr>
                              </thead>
                              <tbody>
                                {table.rows.map((row) => {
                                  const name = row.targetId
                                    ? playerMap.get(row.targetId)?.name ?? "不明"
                                    : "-";
                                  return (
                                    <tr key={`${player.id}-${row.targetId}-${row.rank}`}>
                                      <td className="border-t border-slate-200 px-2 py-1 text-slate-600">
                                        {row.rank > 0 ? `${row.rank}着` : "-"}
                                      </td>
                                      <td className="border-t border-slate-200 px-2 py-1 text-slate-700">
                                        {name}
                                      </td>
                                      <td className="border-t border-slate-200 px-2 py-1 text-slate-700">
                                        {row.gap ? <GapValue value={row.gap} /> : "-"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-400">{NOTE_TEXT}</p>
          {note ? <p className="text-xs text-slate-400">{note}</p> : null}
        </div>
      )}
    </div>
  );
};
