import { useCallback, useEffect, useMemo, useState } from "react";

import type { AnalyticsResponse, Season } from "../../shared/types";
import { createSeason, fetchAnalytics, fetchSeasons } from "../lib/analyticsApi";

const formatPoint = (value: number | null): string =>
  value === null ? "-" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
const formatRate = (value: number | null): string =>
  value === null ? "-" : `${(value * 100).toFixed(1)}%`;

export const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [playerAId, setPlayerAId] = useState("");
  const [playerBId, setPlayerBId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (nextFrom: string, nextTo: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAnalytics(nextFrom || null, nextTo || null);
      setAnalytics(result);
      setPlayerAId((current) =>
        result.players.some((player) => player.playerId === current)
          ? current
          : result.players[0]?.playerId ?? "",
      );
      setPlayerBId((current) =>
        result.players.some((player) => player.playerId === current)
          ? current
          : result.players[1]?.playerId ?? result.players[0]?.playerId ?? "",
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "分析結果の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics("", "");
    void fetchSeasons().then(setSeasons).catch(() => undefined);
  }, [loadAnalytics]);

  const applyRange = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    void loadAnalytics(nextFrom, nextTo);
  };

  const applyMonth = () => {
    const match = month.match(/^(\d{4})-(\d{2})$/);
    if (!match) return;
    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    applyRange(`${month}-01`, `${month}-${String(lastDay).padStart(2, "0")}`);
  };

  const saveSeason = async () => {
    if (!seasonName.trim() || !from || !to) return;
    setError(null);
    try {
      const season = await createSeason(seasonName, from, to);
      setSeasons((current) => [season, ...current]);
      setSeasonName("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "シーズンの保存に失敗しました。");
    }
  };

  const selectedRecord = analytics?.records.find((record) => record.playerId === playerAId) ?? null;
  const selectedPair = useMemo(
    () =>
      analytics?.headToHead.find(
        (pair) =>
          (pair.playerAId === playerAId && pair.playerBId === playerBId) ||
          (pair.playerAId === playerBId && pair.playerBId === playerAId),
      ) ?? null,
    [analytics, playerAId, playerBId],
  );
  const selectedA = analytics?.players.find((player) => player.playerId === playerAId) ?? null;
  const selectedB = analytics?.players.find((player) => player.playerId === playerBId) ?? null;
  const aHigher = selectedPair
    ? selectedPair.playerAId === playerAId
      ? selectedPair.playerAHigher
      : selectedPair.playerBHigher
    : 0;
  const bHigher = selectedPair
    ? selectedPair.playerBId === playerBId
      ? selectedPair.playerBHigher
      : selectedPair.playerAHigher
    : 0;

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">
            開始日
            <input
              type="date"
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-500">
            終了日
            <input
              type="date"
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white"
            onClick={() => applyRange(from, to)}
          >
            期間を適用
          </button>
          <button
            type="button"
            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"
            onClick={() => applyRange("", "")}
          >
            全期間
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">
            月間ランキング
            <input
              type="month"
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-700"
            onClick={applyMonth}
          >
            この月を表示
          </button>
          <label className="text-xs text-slate-500">
            保存シーズン
            <select
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              defaultValue=""
              onChange={(event) => {
                const season = seasons.find((item) => item.id === event.target.value);
                if (season) applyRange(season.startsOn, season.endsOn);
              }}
            >
              <option value="">選択してください</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}（{season.startsOn}〜{season.endsOn}）
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
          <label className="min-w-48 flex-1 text-xs text-slate-500">
            現在の期間をシーズンとして保存
            <input
              type="text"
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="例: 2026年前期"
              value={seasonName}
              onChange={(event) => setSeasonName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
            disabled={!seasonName.trim() || !from || !to}
            onClick={() => void saveSeason()}
          >
            シーズンを保存
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-400">集計しています。</p> : null}
      {analytics ? (
        <>
          <div className="text-xs text-slate-500">
            対象: {analytics.sessions}卓・{analytics.hands}半荘（確定済みのみ）
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">順位</th>
                  <th className="px-3 py-2 text-left">プレイヤー</th>
                  <th className="px-3 py-2 text-right">通算pt</th>
                  <th className="px-3 py-2 text-right">半荘</th>
                  <th className="px-3 py-2 text-right">平均pt</th>
                  <th className="px-3 py-2 text-right">平均着順</th>
                  <th className="px-3 py-2 text-right">トップ率</th>
                  <th className="px-3 py-2 text-right">ラス率</th>
                  <th className="px-3 py-2 text-right">着順分布</th>
                </tr>
              </thead>
              <tbody>
                {analytics.players.map((player, index) => (
                  <tr key={player.playerId} className="border-t border-slate-100">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2 font-semibold">{player.name}</td>
                    <td className="px-3 py-2 text-right">{formatPoint(player.totalPoint)}</td>
                    <td className="px-3 py-2 text-right">{player.hands}</td>
                    <td className="px-3 py-2 text-right">{formatPoint(player.averagePoint)}</td>
                    <td className="px-3 py-2 text-right">{player.averageRank?.toFixed(1) ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{formatRate(player.topRate)}</td>
                    <td className="px-3 py-2 text-right">{formatRate(player.lastRate)}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {player.rankCounts.join(" / ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800">直接対決</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={playerAId}
                  onChange={(event) => setPlayerAId(event.target.value)}
                >
                  {analytics.players.map((player) => (
                    <option key={player.playerId} value={player.playerId}>{player.name}</option>
                  ))}
                </select>
                <span className="self-center text-xs text-slate-400">vs</span>
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={playerBId}
                  onChange={(event) => setPlayerBId(event.target.value)}
                >
                  {analytics.players.map((player) => (
                    <option key={player.playerId} value={player.playerId}>{player.name}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4 text-sm text-slate-600">
                {selectedPair && selectedA && selectedB ? (
                  <div className="space-y-1">
                    <div>同卓 {selectedPair.sharedHands}半荘</div>
                    <div>{selectedA.name}が上位 {aHigher}回 / {selectedB.name}が上位 {bHigher}回 / 同順位 {selectedPair.ties}回</div>
                    <div>同卓時pt: {selectedA.name} {formatPoint(selectedPair.playerAId === playerAId ? selectedPair.playerAPoint : selectedPair.playerBPoint)} / {selectedB.name} {formatPoint(selectedPair.playerBId === playerBId ? selectedPair.playerBPoint : selectedPair.playerAPoint)}</div>
                  </div>
                ) : "同卓データがありません。"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800">個人レコード</h4>
              {selectedRecord && selectedA ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <div>最高素点 <strong>{selectedRecord.highestScore?.toLocaleString() ?? "-"}</strong></div>
                  <div>最低素点 <strong>{selectedRecord.lowestScore?.toLocaleString() ?? "-"}</strong></div>
                  <div>最高pt <strong>{formatPoint(selectedRecord.bestPoint)}</strong></div>
                  <div>最低pt <strong>{formatPoint(selectedRecord.worstPoint)}</strong></div>
                  <div>連続トップ <strong>{selectedRecord.longestTopStreak}回</strong></div>
                </div>
              ) : <p className="mt-3 text-sm text-slate-400">データがありません。</p>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
