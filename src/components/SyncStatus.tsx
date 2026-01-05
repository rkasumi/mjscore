import type { SessionMeta } from "../lib/localStorage";
import type { SyncState } from "../lib/useSessionStore";

type Props = {
  syncState: SyncState;
  lastError: string | null;
  meta: SessionMeta | null;
  displayMode?: boolean;
  snapshotMode?: boolean;
  snapshotError?: string | null;
};

export const SyncStatus = ({
  syncState,
  lastError,
  meta,
  displayMode = false,
  snapshotMode = false,
  snapshotError = null,
}: Props) => {
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
          {meta ? <span>version {meta.version}</span> : null}
          {meta ? <span>更新 {new Date(meta.updatedAt).toLocaleString()}</span> : null}
          {lastError ? <span className="text-rose-600">{lastError}</span> : null}
        </>
      )}
    </div>
  );
};
