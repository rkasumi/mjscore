import type { SessionMeta } from "../lib/localStorage";
import type { SyncState } from "../lib/useSessionStore";

type Props = {
  syncState: SyncState;
  lastError: string | null;
  meta: SessionMeta | null;
};

export const SyncStatus = ({ syncState, lastError, meta }: Props) => {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
      <span>同期: {syncState === "syncing" ? "送信中" : "待機"}</span>
      {meta ? <span>version {meta.version}</span> : null}
      {meta ? <span>更新 {new Date(meta.updatedAt).toLocaleString()}</span> : null}
      {lastError ? <span className="text-rose-600">{lastError}</span> : null}
    </div>
  );
};
