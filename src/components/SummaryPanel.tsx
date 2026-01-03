import { Fragment, useMemo, useState } from "react";

import type { Session } from "../../shared/types";
import { buildSessionAggregate, type SessionAggregate } from "../lib/aggregation";
import { calculateHandResults } from "../lib/scoring";

type Props = {
  aggregate: SessionAggregate | null;
  session: Session | null;
  displayMode?: boolean;
};

type HandDetail = {
  handIndex: number;
  score: number | null;
  point: number | null;
  rank: number | null;
};

const formatScore = (score: number): string => `${score.toLocaleString()}点`;

export const SummaryPanel = ({ aggregate, session, displayMode = false }: Props) => {
  const tableTextClass = displayMode ? "text-base" : "text-sm";
  const headerTextClass = displayMode ? "text-sm" : "text-xs";
  const isInteractive = !displayMode;
  const extraColumnClass = displayMode ? "" : "hidden lg:table-cell";
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null);
  const sumPositive =
    aggregate?.players.reduce((sum, player) => sum + Math.max(player.totalPoint, 0), 0) ?? 0;
  const sumNegative =
    aggregate?.players.reduce((sum, player) => sum + Math.abs(Math.min(player.totalPoint, 0)), 0) ??
    0;

  const getRatio = (value: number): number => {
    if (value >= 0) {
      return sumPositive > 0 ? (value / sumPositive) * 100 : 0;
    }
    return sumNegative > 0 ? (Math.abs(value) / sumNegative) * 100 : 0;
  };

  const handDetails = useMemo(() => {
    if (!session) {
      return new Map<string, HandDetail[]>();
    }
    const detailMap = new Map<string, HandDetail[]>();
    session.players.forEach((player) => {
      detailMap.set(player.id, []);
    });

    session.hands.forEach((hand, index) => {
      const results = calculateHandResults(hand.seats);
      const resultMap = new Map(results.map((result) => [result.playerId, result]));

      session.players.forEach((player) => {
        const result = resultMap.get(player.id);
        const seat = hand.seats.find((item) => item.playerId === player.id) ?? null;
        const list = detailMap.get(player.id);
        if (!list) {
          return;
        }
        list.push({
          handIndex: index + 1,
          score: seat?.score ?? null,
          point: result?.totalPoint ?? null,
          rank: result?.rank ?? null,
        });
      });
    });

    return detailMap;
  }, [session]);

  const lastHandMetrics = useMemo(() => {
    if (!session || !aggregate || session.hands.length === 0) {
      return {
        lastHandPointMap: new Map<string, number>(),
        rankDeltaMap: new Map<string, number>(),
        leaderTotal: 0,
      };
    }
    const lastHand = session.hands[session.hands.length - 1];
    const lastResults = calculateHandResults(lastHand.seats);
    const lastHandPointMap = new Map<string, number>(
      lastResults.map((result) => [result.playerId, result.totalPoint]),
    );
    const leaderTotal = aggregate.players[0]?.totalPoint ?? 0;
    const rankDeltaMap = new Map<string, number>();
    if (session.hands.length >= 2) {
      const prevSession = { ...session, hands: session.hands.slice(0, -1) };
      const prevAggregate = buildSessionAggregate(prevSession);
      prevAggregate.players.forEach((player) => {
        const currentRank = aggregate.players.find(
          (current) => current.playerId === player.playerId,
        )?.rank;
        if (currentRank) {
          rankDeltaMap.set(player.playerId, player.rank - currentRank);
        }
      });
    }
    return { lastHandPointMap, rankDeltaMap, leaderTotal };
  }, [aggregate, session]);

  return (
    <div className={`card ${displayMode ? "p-4" : "p-4 sm:p-6"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`section-title ${displayMode ? "text-3xl md:text-4xl" : "text-2xl sm:text-3xl"}`}>
          トータル成績
        </h2>
        <span className={`${displayMode ? "text-sm" : "text-xs"} text-slate-500`}>
          半荘数 {aggregate?.handsCount ?? 0}
        </span>
      </div>
      {!aggregate || aggregate.players.length === 0 ? (
        <p className={`mt-4 ${tableTextClass} text-slate-500`}>
          プレイヤーが登録されていません。
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className={`w-full min-w-[320px] border-collapse ${tableTextClass} md:min-w-[420px]`}>
            <thead>
              <tr className={`border-b border-slate-200 text-left ${headerTextClass} text-slate-500`}>
                <th className="py-2 pr-3">順位</th>
                <th className="py-2 pr-3">名前</th>
                <th className="py-2 pr-3">合計ポイント</th>
                <th className={`py-2 pr-3 text-center ${extraColumnClass}`}>首位差</th>
                <th className={`py-2 pr-3 text-center ${extraColumnClass}`}>直近</th>
                <th className={`py-2 pr-3 text-center ${extraColumnClass}`}>変動</th>
                <th className="py-2 pr-3 text-center">平均順位</th>
                <th className="py-2 text-center">半荘</th>
              </tr>
            </thead>
            <tbody>
              {aggregate.players.map((player) => {
                const isOpen = openPlayerId === player.playerId;
                const details = handDetails.get(player.playerId) ?? [];
                const leaderGap = lastHandMetrics.leaderTotal - player.totalPoint;
                const lastDelta = lastHandMetrics.lastHandPointMap.get(player.playerId) ?? null;
                const rankDelta = lastHandMetrics.rankDeltaMap.get(player.playerId) ?? 0;
                const rankDeltaLabel =
                  rankDelta === 0
                    ? "-"
                    : rankDelta > 0
                      ? `▲${rankDelta}`
                      : `▼${Math.abs(rankDelta)}`;
                const lastDeltaLabel =
                  lastDelta === null ? "-" : `${lastDelta >= 0 ? "+" : ""}${lastDelta.toFixed(1)}`;
                const lastDeltaClass =
                  lastDelta === null
                    ? "text-slate-400"
                    : lastDelta >= 0
                      ? "text-emerald-600"
                      : "text-rose-600";
                const rankDeltaClass =
                  rankDelta === 0
                    ? "text-slate-400"
                    : rankDelta > 0
                      ? "text-emerald-600"
                      : "text-rose-600";

                return (
                  <Fragment key={player.playerId}>
                    <tr
                      className={`border-b border-slate-100 transition ${
                        isInteractive ? "hover:bg-slate-50" : ""
                      }`}
                      role={isInteractive ? "button" : undefined}
                      tabIndex={isInteractive ? 0 : -1}
                      onClick={
                        isInteractive
                          ? () =>
                              setOpenPlayerId((prev) =>
                                prev === player.playerId ? null : player.playerId,
                              )
                          : undefined
                      }
                      onKeyDown={
                        isInteractive
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                setOpenPlayerId((prev) =>
                                  prev === player.playerId ? null : player.playerId,
                                );
                              }
                            }
                          : undefined
                      }
                    >
                      <td className="py-2 pr-3 text-slate-500">{player.rank}位</td>
                      <td className="py-2 pr-3 text-slate-900">{player.name}</td>
                      <td className="py-2 pr-3 text-slate-700">
                        {player.totalPoint.toFixed(1)} pt
                        <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${getRatio(player.totalPoint)}%`,
                              backgroundColor:
                                player.totalPoint >= 0
                                  ? "rgba(92,220,92,0.2)"
                                  : "rgba(255,102,102,0.2)",
                            }}
                          />
                        </div>
                      </td>
                      <td className={`py-2 pr-3 text-center text-slate-600 ${extraColumnClass}`}>
                        {leaderGap <= 0 ? "-" : `-${leaderGap.toFixed(1)}`}
                      </td>
                      <td className={`py-2 pr-3 text-center ${lastDeltaClass} ${extraColumnClass}`}>
                        {lastDeltaLabel}
                      </td>
                      <td className={`py-2 pr-3 text-center ${rankDeltaClass} ${extraColumnClass}`}>
                        {rankDeltaLabel}
                      </td>
                      <td className="py-2 pr-3 text-center text-slate-600">
                        {player.averageRank?.toFixed(1) ?? "-"}
                      </td>
                      <td className="py-2 text-center text-slate-600">{player.hands}</td>
                    </tr>
                    {isOpen && isInteractive ? (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={5} className="p-3">
                          {details.length === 0 ? (
                            <p className={`${displayMode ? "text-sm" : "text-xs"} text-slate-500`}>
                              まだ半荘がありません。
                            </p>
                          ) : (
                            <table className={`w-full ${displayMode ? "text-sm" : "text-xs"}`}>
                              <thead>
                                <tr className={`text-left ${headerTextClass} text-slate-500`}>
                                  <th className="py-1 pr-3">半荘</th>
                                  <th className="py-1 pr-3">点数</th>
                                  <th className="py-1 pr-3">ポイント</th>
                                  <th className="py-1">順位</th>
                                </tr>
                              </thead>
                              <tbody>
                                {details.map((detail) => (
                                  <tr key={`${player.playerId}-${detail.handIndex}`}>
                                    <td className="py-1 pr-3 text-slate-500">
                                      {detail.handIndex}
                                    </td>
                                    <td className="py-1 pr-3 text-slate-700">
                                      {detail.score === null ? "-" : formatScore(detail.score)}
                                    </td>
                                    <td className="py-1 pr-3 text-slate-700">
                                      {detail.point === null ? "-" : `${detail.point.toFixed(1)} pt`}
                                    </td>
                                    <td className="py-1 text-slate-600">
                                      {detail.rank === null ? "-" : `${detail.rank}位`}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
