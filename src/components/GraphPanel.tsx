import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
} from "recharts";

import type { Player } from "../../shared/types";
import type { SessionAggregate } from "../lib/aggregation";

type Props = {
  players: Player[];
  aggregate: SessionAggregate | null;
  displayMode?: boolean;
};

const COLORS = [
  "#0ea5e9",
  "#84cc16",
  "#dc2626",
  "#facc15",
  "#111827",
  "#f97316",
];

const getPlayerColor = (index: number): string => COLORS[index] ?? "#dc2626";

export const GraphPanel = ({ players, aggregate, displayMode = false }: Props) => {
  const [mode, setMode] = useState<"cumulative" | "hand">("cumulative");

  const series = useMemo(() => {
    if (!aggregate) {
      return [];
    }
    const currentMode = displayMode ? "cumulative" : mode;
    return currentMode === "cumulative" ? aggregate.cumulativeSeries : aggregate.handSeries;
  }, [aggregate, displayMode, mode]);

  const yAxis = useMemo(() => {
    if (!series.length) {
      return { ticks: [], domain: [0, 50] as [number, number] };
    }
    const step = 50;
    let min = 0;
    let max = 0;
    for (const point of series) {
      for (const player of players) {
        const value = Number(point[player.id] ?? 0);
        if (value < min) {
          min = value;
        }
        if (value > max) {
          max = value;
        }
      }
    }
    const minTick = Math.floor(min / step) * step;
    const maxTick = Math.ceil(max / step) * step;
    const start = minTick === maxTick ? minTick - step : minTick;
    const end = minTick === maxTick ? maxTick + step : maxTick;
    const ticks: number[] = [];
    for (let value = start; value <= end; value += step) {
      ticks.push(value);
    }
    return { ticks, domain: [start, end] as [number, number] };
  }, [players, series]);

  const isEmpty = !aggregate || aggregate.handsCount === 0;

  return (
    <div className={`card ${displayMode ? "p-4" : "p-4 sm:p-6"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`section-title ${displayMode ? "text-3xl md:text-4xl" : ""}`}>
          成績グラフ
        </h2>
        {!displayMode ? (
          <div className="flex gap-2 rounded-2xl bg-slate-100 p-1 text-xs">
            <button
              type="button"
              className={`rounded-2xl px-3 py-1.5 transition ${
                mode === "cumulative"
                  ? "bg-rose-600 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setMode("cumulative")}
            >
              累積pt
            </button>
            <button
              type="button"
              className={`rounded-2xl px-3 py-1.5 transition ${
                mode === "hand"
                  ? "bg-rose-600 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setMode("hand")}
            >
              半荘pt
            </button>
          </div>
        ) : null}
      </div>
      {isEmpty ? (
        <p className="mt-4 text-sm text-slate-400">半荘を入力するとグラフが表示されます。</p>
      ) : (
        <div className={`mt-6 ${displayMode ? "h-64" : "h-80"}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ left: 12, right: 24, top: 10, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="handIndex" stroke="#94a3b8" domain={[0, "dataMax"]} />
              <YAxis stroke="#94a3b8" ticks={yAxis.ticks} domain={yAxis.domain} />
              <Tooltip contentStyle={{ background: "#ffffff", borderColor: "#e2e8f0" }} />
              <Legend />
              {series
                .filter((point) => point.handIndex > 0)
                .map((point) => (
                  <ReferenceLine
                    key={`hand-${point.handIndex}`}
                    x={point.handIndex}
                    stroke="#e5e7eb"
                    strokeWidth={1}
                  />
                ))}
              {players.map((player, index) => (
                <Line
                  key={player.id}
                  type="linear"
                  dataKey={player.id}
                  name={player.name}
                  stroke={getPlayerColor(index)}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
