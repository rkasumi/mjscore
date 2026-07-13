import { useEffect, useMemo, useState } from "react";

import type { Session } from "../../shared/types";
import { buildReverseTickerItems, calculatePaceEstimate } from "../lib/displayInsights";

type Props = {
  session: Session;
  seatPlayerIds: string[];
};

export const DisplayInsights = ({ session, seatPlayerIds }: Props) => {
  const tickerItems = useMemo(
    () => buildReverseTickerItems(session, seatPlayerIds),
    [seatPlayerIds, session],
  );
  const [tickerIndex, setTickerIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const pace = useMemo(() => calculatePaceEstimate(session.hands, now), [now, session.hands]);

  useEffect(() => {
    setTickerIndex(0);
    if (tickerItems.length <= 1) return;
    const timer = window.setInterval(
      () => setTickerIndex((current) => (current + 1) % tickerItems.length),
      10000,
    );
    return () => window.clearInterval(timer);
  }, [tickerItems]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const ticker = tickerItems[tickerIndex] ?? null;
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span className="mr-2 font-semibold">逆転条件</span>
        {ticker ?? "次局の参加者を4人選ぶと逆転条件を表示します。"}
      </div>
      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        {pace ? (
          <>
            <span className="font-semibold">半荘ペース</span> 約{pace.medianMinutes}分・次回終了予測 {" "}
            {pace.predictedEndAt.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </>
        ) : (
          <><span className="font-semibold">半荘ペース</span> データ不足</>
        )}
      </div>
    </div>
  );
};
