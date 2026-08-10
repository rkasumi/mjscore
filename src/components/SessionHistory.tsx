import { useCallback, useEffect, useState } from "react";

import type { SessionDetail, SessionEnvelope, SessionSummary } from "../../shared/types";
import {
  fetchSessionDetail,
  fetchSessionHistory,
  reopenStoredSession,
  voidStoredSession,
} from "../lib/sessionHistory";
import { HandHistory } from "./HandHistory";
import { SnapshotShare } from "./SnapshotShare";

type Props = {
  currentSessionId: string | null;
  currentVersion: number | null;
  onEnvelope: (envelope: SessionEnvelope) => void;
  onReopened: () => void;
};

const statusLabel = (status: SessionSummary["status"]): string => {
  if (status === "active") return "入力中";
  if (status === "finalized") return "確定済み";
  return "無効";
};

export const SessionHistory = ({
  currentSessionId,
  currentVersion,
  onEnvelope,
  onReopened,
}: Props) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await fetchSessionHistory());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "履歴の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const selectSession = async (id: string) => {
    setError(null);
    try {
      setDetail(await fetchSessionDetail(id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "履歴の取得に失敗しました。");
    }
  };

  const reopen = async () => {
    if (!detail || currentVersion === null) return;
    if (
      currentSessionId &&
      currentSessionId !== detail.session.id &&
      !window.confirm("現在入力中の卓を確定し、この履歴を再開しますか？")
    ) {
      return;
    }
    setMutating(true);
    setError(null);
    try {
      const envelope = await reopenStoredSession(detail.session.id, currentVersion);
      onEnvelope(envelope);
      onReopened();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : "卓の再開に失敗しました。",
      );
    } finally {
      setMutating(false);
    }
  };

  const voidSession = async () => {
    if (!detail || currentVersion === null || detail.summary.status !== "finalized") return;
    if (!window.confirm("この卓を集計対象外にしますか？結果データは削除されません。")) return;
    setMutating(true);
    setError(null);
    try {
      const envelope = await voidStoredSession(detail.session.id, currentVersion);
      onEnvelope(envelope);
      setDetail(null);
      await loadHistory();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : "卓の無効化に失敗しました。",
      );
    } finally {
      setMutating(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
      {loading ? <p className="text-sm text-slate-400">履歴を読み込んでいます。</p> : null}
      {!loading && sessions.length === 0 ? (
        <p className="text-sm text-slate-400">保存済みの卓はありません。</p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <div className="space-y-2">
          {sessions.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                detail?.session.id === item.id
                  ? "border-amber-300 bg-amber-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
              onClick={() => void selectSession(item.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {item.day ?? item.createdAt.slice(0, 10)}
                  {item.label ? ` / ${item.label}` : ""}
                </span>
                <span className="text-[10px] text-slate-500">{statusLabel(item.status)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {item.handsCount}半荘・{item.playerNames.join(" / ")}
              </div>
            </button>
          ))}
        </div>

        {detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-base font-semibold text-slate-800">
                  {detail.summary.day ?? detail.session.createdAt.slice(0, 10)}
                  {detail.summary.label ? ` / ${detail.summary.label}` : ""}
                </div>
                <div className="text-xs text-slate-500">
                  {statusLabel(detail.summary.status)}・{detail.summary.handsCount}半荘
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.summary.status !== "active" && detail.summary.status !== "voided" ? (
                  <button
                    type="button"
                    className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                    disabled={mutating || currentVersion === null}
                    onClick={() => void reopen()}
                  >
                    この卓を再開
                  </button>
                ) : null}
                {detail.summary.status === "finalized" ? (
                  <button
                    type="button"
                    className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-50"
                    disabled={mutating || currentVersion === null}
                    onClick={() => void voidSession()}
                  >
                    集計対象外にする
                  </button>
                ) : null}
              </div>
            </div>
            <SnapshotShare session={detail.session} status={detail.summary.status} />
            <HandHistory
              players={detail.session.players}
              hands={detail.session.hands}
              onEdit={() => undefined}
              onDelete={() => undefined}
              readOnly
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-400">
            卓を選ぶと詳細を表示します。
          </div>
        )}
      </div>
    </div>
  );
};
