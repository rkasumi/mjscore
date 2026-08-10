import { useEffect, useMemo, useState } from "react";

import type { Session, SessionStatus } from "../../shared/types";
import { buildResultShareText } from "../lib/shareText";
import { buildSnapshot, encodeSnapshot } from "../lib/snapshot";
import { ResultImageDialog } from "./ResultImageDialog";

type Props = {
  session: Session | null;
  status?: SessionStatus;
};

type CopyState = "idle" | "link-success" | "text-success" | "error";

const buildShareUrl = (session: Session): string => {
  const snapshot = buildSnapshot(session);
  const encoded = encodeSnapshot(snapshot);
  return `${window.location.origin}/share/${encodeURIComponent(encoded)}`;
};

export const SnapshotShare = ({ session, status = "active" }: Props) => {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const shareUrl = useMemo(() => (session ? buildShareUrl(session) : ""), [session]);
  const shareText = useMemo(
    () => (session ? buildResultShareText(session, shareUrl) : ""),
    [session, shareUrl],
  );
  const canCopy = Boolean(session);
  const canCreateImage = Boolean(session && session.hands.length > 0);

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }
    const timer = window.setTimeout(() => setCopyState("idle"), 3000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const copy = async (value: string, successState: CopyState) => {
    if (!canCopy) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(successState);
    } catch {
      setCopyState("error");
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-4">
      <div className="text-sm font-semibold text-slate-800">結果を共有</div>
      <p className="text-xs text-slate-500">
        現在の集計結果をスナップショットURLにして共有できます。
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            canCopy
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
          onClick={() => void copy(shareUrl, "link-success")}
          disabled={!canCopy}
        >
          共有リンクをコピー
        </button>
        <button
          type="button"
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            canCopy
              ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
          onClick={() => void copy(shareText, "text-success")}
          disabled={!canCopy}
        >
          結果テキストをコピー
        </button>
        <button
          type="button"
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            canCreateImage
              ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
          onClick={() => setImageDialogOpen(true)}
          disabled={!canCreateImage}
        >
          投稿用画像を作成
        </button>
        {copyState === "link-success" ? (
          <span className="text-xs text-emerald-600">共有リンクをコピーしました</span>
        ) : null}
        {copyState === "text-success" ? (
          <span className="text-xs text-emerald-600">結果テキストをコピーしました</span>
        ) : null}
        {copyState === "error" ? (
          <span className="text-xs text-rose-600">コピーに失敗しました</span>
        ) : null}
      </div>
      {imageDialogOpen && session ? (
        <ResultImageDialog
          key={session.id}
          session={session}
          status={status}
          onClose={() => setImageDialogOpen(false)}
        />
      ) : null}
    </div>
  );
};
