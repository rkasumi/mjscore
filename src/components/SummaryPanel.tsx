import { Fragment, useMemo, useState } from "react";

import type { Session } from "../../shared/types";
import type { SessionAggregate } from "../lib/aggregation";
import { calculateHandResults } from "../lib/scoring";

type Props = {
  aggregate: SessionAggregate | null;
  session: Session | null;
};

type HandDetail = {
  handIndex: number;
  score: number | null;
  point: number | null;
  rank: number | null;
};

const formatScore = (score: number): string => `${score.toLocaleString()}点`;

export const SummaryPanel = ({ aggregate, session }: Props) => {
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

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title text-2xl sm:text-3xl">トータル成績</h2>
        <span className="text-xs text-slate-500">半荘数 {aggregate?.handsCount ?? 0}</span>
      </div>
      {!aggregate || aggregate.players.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">プレイヤーが登録されていません。</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-sm md:min-w-[420px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3">順位</th>
                <th className="py-2 pr-3">名前</th>
                <th className="py-2 pr-3">合計ポイント</th>
                <th className="py-2 pr-3 text-center">平均順位</th>
                <th className="py-2 text-center">半荘</th>
              </tr>
            </thead>
            <tbody>
              {aggregate.players.map((player) => {
                const isOpen = openPlayerId === player.playerId;
                const details = handDetails.get(player.playerId) ?? [];

                return (
                  <Fragment key={player.playerId}>
                    <tr
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setOpenPlayerId((prev) => (prev === player.playerId ? null : player.playerId))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          setOpenPlayerId((prev) =>
                            prev === player.playerId ? null : player.playerId,
                          );
                        }
                      }}
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
                      <td className="py-2 pr-3 text-center text-slate-600">
                        {player.averageRank?.toFixed(1) ?? "-"}
                      </td>
                      <td className="py-2 text-center text-slate-600">{player.hands}</td>
                    </tr>
                    {isOpen ? (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={5} className="p-3">
                          {details.length === 0 ? (
                            <p className="text-xs text-slate-500">まだ半荘がありません。</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-slate-500">
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
