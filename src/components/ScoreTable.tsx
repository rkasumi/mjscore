import { useMemo, useState } from "react";

const FU_VALUES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
const HAN_VALUES = [1, 2, 3, 4];

const ceilTo100 = (value: number): number => Math.ceil(value / 100) * 100;

const calculateBase = (fu: number, han: number): number => fu * 2 ** (han + 2);

const isMangan = (fu: number, han: number): boolean =>
  han >= 5 || calculateBase(fu, han) >= 2000 || (fu === 30 && han === 4);

const formatNumber = (value: number): string => value.toLocaleString();

const buildChildCell = (
  fu: number,
  han: number,
): { ron: number; tsumo: [number, number] } => {
  if (isMangan(fu, han)) {
    return { ron: 8000, tsumo: [2000, 4000] };
  }
  const base = calculateBase(fu, han);
  const ron = ceilTo100(base * 4);
  const tsumoChild = ceilTo100(base * 1);
  const tsumoParent = ceilTo100(base * 2);
  return { ron, tsumo: [tsumoChild, tsumoParent] };
};

const buildParentCell = (fu: number, han: number): { ron: number; tsumo: number } => {
  if (isMangan(fu, han)) {
    return { ron: 12000, tsumo: 4000 };
  }
  const base = calculateBase(fu, han);
  const ron = ceilTo100(base * 6);
  const tsumo = ceilTo100(base * 2);
  return { ron, tsumo };
};

export const ScoreTable = () => {
  const [mode, setMode] = useState<"child" | "parent" | "fu">("child");
  const table = useMemo(() => {
    return FU_VALUES.map((fu) => {
      const cells = HAN_VALUES.map((han) =>
        mode === "child" ? buildChildCell(fu, han) : buildParentCell(fu, han),
      );
      return { fu, cells };
    });
  }, [mode]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            mode === "child"
              ? "bg-emerald-500 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          onClick={() => setMode("child")}
        >
          子
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            mode === "parent"
              ? "bg-emerald-500 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          onClick={() => setMode("parent")}
        >
          親
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            mode === "fu"
              ? "bg-emerald-500 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          onClick={() => setMode("fu")}
        >
          符計算
        </button>
      </div>
      {mode === "fu" ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span className="font-semibold text-slate-800">基本符</span>
              <span className="text-base font-semibold text-slate-900">20符</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span className="font-semibold text-slate-800">ツモ</span>
                <span className="text-base font-semibold text-slate-900">+2符</span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span className="font-semibold text-slate-800">面前ロン</span>
                <span className="text-base font-semibold text-slate-900">+10符</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span className="font-semibold text-slate-800">
                  単騎/ペンチャン/カンチャン
                </span>
                <span className="text-base font-semibold text-slate-900">+2符</span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span className="font-semibold text-slate-800">雀頭が役牌</span>
                <span className="text-base font-semibold text-slate-900">+2符</span>
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-slate-500">
                  <th className="px-3 py-2">項目</th>
                  <th className="px-3 py-2 text-center">1、9、字牌</th>
                  <th className="px-3 py-2 text-center">2〜8</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                    明刻
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 text-center text-slate-700">
                    4符
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 text-center text-slate-700">
                    2符
                  </td>
                </tr>
                <tr>
                  <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                    暗刻
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 text-center text-slate-700">
                    8符
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 text-center text-slate-700">
                    4符
                  </td>
                </tr>
                <tr>
                  <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                    明槓
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 text-center text-slate-700">
                    16符
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 text-center text-slate-700">
                    8符
                  </td>
                </tr>
                <tr>
                  <td className="border-t border-slate-200 px-3 py-2 text-slate-700">
                    暗槓
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 text-center text-slate-700">
                    32符
                  </td>
                  <td className="border-t border-slate-200 px-3 py-2 text-center text-slate-700">
                    16符
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80">
          <table className="w-full min-w-[360px] text-xs md:min-w-[520px]">
            <thead>
              <tr className="bg-slate-100 text-left text-slate-500">
                <th className="px-3 py-2 text-center">符/翻</th>
                {HAN_VALUES.map((han) => (
                  <th key={han} className="px-3 py-2 text-center">
                    {han}翻
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.fu}>
                  <td className="border-t border-slate-200 px-3 py-2 text-center text-slate-600">
                    {row.fu}符
                  </td>
                  {row.cells.map((cell, index) => (
                    <td
                      key={`${row.fu}-${index}`}
                      className="border-t border-slate-200 px-3 py-2 text-center text-slate-700"
                    >
                      {row.fu === 20 && HAN_VALUES[index] === 1 ? (
                        <div className="text-sm font-semibold text-slate-900">ピンフツモ</div>
                      ) : row.fu === 25 && HAN_VALUES[index] === 1 ? (
                        <div className="text-sm font-semibold text-slate-900">チートイツ</div>
                      ) : isMangan(row.fu, HAN_VALUES[index]) ? (
                        <div className="text-sm font-semibold text-slate-900">満貫</div>
                      ) : (
                        <>
                          {row.fu === 20 ? null : (
                            <div className="text-sm font-semibold text-slate-900">
                              {formatNumber(cell.ron)}
                            </div>
                          )}
                          {"tsumo" in cell ? (
                            Array.isArray(cell.tsumo) ? (
                              <div
                                className={`${
                                  row.fu === 20
                                    ? "text-sm font-semibold text-slate-900"
                                    : "text-[11px] text-slate-500"
                                }`}
                              >
                                {row.fu === 20
                                  ? `${formatNumber(cell.tsumo[0])}/${formatNumber(
                                      cell.tsumo[1],
                                    )}`
                                  : `(${formatNumber(cell.tsumo[0])}/${formatNumber(
                                      cell.tsumo[1],
                                    )})`}
                              </div>
                            ) : (
                              <div
                                className={`${
                                  row.fu === 20
                                    ? "text-sm font-semibold text-slate-900"
                                    : "text-[11px] text-slate-500"
                                }`}
                              >
                                {row.fu === 20
                                  ? `${formatNumber(cell.tsumo)}オール`
                                  : `(${formatNumber(cell.tsumo)}オール)`}
                              </div>
                            )
                          ) : null}
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
