import type { SessionMeta } from "../lib/localStorage";
import type { SyncState } from "../lib/useSessionStore";

type Props = {
  syncState: SyncState;
  lastError: string | null;
  meta: SessionMeta | null;
  displayMode?: boolean;
  snapshotMode?: boolean;
  snapshotError?: string | null;
  onRetrySync?: () => void;
};

export const SyncStatus = ({
  syncState,
  lastError,
  meta,
  displayMode = false,
  snapshotMode = false,
  snapshotError = null,
  onRetrySync,
}: Props) => {
  const formatTimestamp = (value: number): string =>
    value > 0 ? new Date(value).toLocaleString() : "-";
  const hasError = Boolean(lastError || meta?.lastSyncError);
  return (
    <div
      className={`flex flex-wrap items-center gap-3 text-slate-400 ${
        displayMode ? "text-sm" : "text-xs"
      }`}
    >
      {snapshotMode ? (
        <>
          <span>共有スナップショット表示</span>
          {snapshotError ? <span className="text-rose-600">{snapshotError}</span> : null}
        </>
      ) : (
        <>
          <span>同期: {syncState === "syncing" ? "送信中" : "待機"}</span>
          {meta?.dirty ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              未送信
            </span>
          ) : null}
          {meta ? <span>version {meta.version}</span> : null}
          {meta ? (
            <span>
              更新 {meta.updatedAt ? new Date(meta.updatedAt).toLocaleString() : "-"}
            </span>
          ) : null}
          {meta ? <span>Last sync {formatTimestamp(meta.lastSyncSuccessAt)}</span> : null}
          {meta ? <span>Last local {formatTimestamp(meta.lastLocalChangeAt)}</span> : null}
          {hasError ? (
            <span className="text-rose-600">
              {lastError ?? meta?.lastSyncError?.message ?? "Sync failed"}
            </span>
          ) : null}
          {hasError && onRetrySync ? (
            <button
              type="button"
              className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-200"
              onClick={onRetrySync}
            >
              再送
            </button>
          ) : null}
        </>
      )}
    </div>
  );
};
