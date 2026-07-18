import { useEffect, useMemo, useRef, useState } from "react";

import type { Session, SessionStatus } from "../../shared/types";
import {
  RESULT_IMAGE_HEIGHT,
  RESULT_IMAGE_WIDTH,
  buildResultImageAltText,
  buildResultImageFilename,
  buildResultImageModel,
  buildResultImagePostText,
  drawResultImage,
  resultImageCanvasToBlob,
} from "../lib/resultImage";

type Props = {
  session: Session;
  status: SessionStatus;
  onClose: () => void;
};

type Notice = {
  tone: "success" | "error";
  message: string;
} | null;

const getParticipatingPlayerIds = (session: Session): Set<string> => {
  const ids = new Set<string>();
  session.hands.forEach((hand) => {
    hand.seats.forEach((seat) => ids.add(seat.playerId));
  });
  return ids;
};

export const ResultImageDialog = ({ session, status, onClose }: Props) => {
  const participatingPlayerIds = useMemo(() => getParticipatingPlayerIds(session), [session]);
  const participatingPlayers = useMemo(
    () => session.players.filter((player) => participatingPlayerIds.has(player.id)),
    [participatingPlayerIds, session.players],
  );
  const [visiblePlayerIds, setVisiblePlayerIds] = useState<Set<string>>(
    () => new Set(participatingPlayers.map((player) => player.id)),
  );
  const [notice, setNotice] = useState<Notice>(null);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const model = useMemo(
    () => buildResultImageModel(session, visiblePlayerIds, status),
    [session, status, visiblePlayerIds],
  );
  const postText = useMemo(() => buildResultImagePostText(model), [model]);
  const altText = useMemo(() => buildResultImageAltText(model), [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (context) {
      drawResultImage(context, model);
    }
  }, [model]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const getBlob = async (): Promise<Blob> => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("画像の生成に失敗しました。");
    return resultImageCanvasToBlob(canvas);
  };

  const runGeneratingAction = async (action: () => Promise<void>) => {
    setGenerating(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "画像の生成に失敗しました。",
      });
    } finally {
      setGenerating(false);
    }
  };

  const download = async () => {
    await runGeneratingAction(async () => {
      const blob = await getBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildResultImageFilename(model);
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice({ tone: "success", message: "PNGを保存しました。" });
    });
  };

  const share = async () => {
    await runGeneratingAction(async () => {
      if (typeof navigator.share !== "function") {
        throw new Error("このブラウザは画像共有に対応していません。PNGを保存してください。");
      }
      const blob = await getBlob();
      const file = new File([blob], buildResultImageFilename(model), { type: "image/png" });
      const shareData: ShareData = {
        files: [file],
        text: postText,
        title: `${model.day} 麻雀結果`,
      };
      if (typeof navigator.canShare === "function" && !navigator.canShare(shareData)) {
        throw new Error("このブラウザは画像ファイルの共有に対応していません。");
      }
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw error;
      }
      setNotice({ tone: "success", message: "共有先を開きました。" });
    });
  };

  const copy = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ tone: "success", message: successMessage });
    } catch {
      setNotice({ tone: "error", message: "コピーに失敗しました。" });
    }
  };

  const setAllNamesVisible = (visible: boolean) => {
    setVisiblePlayerIds(
      visible ? new Set(participatingPlayers.map((player) => player.id)) : new Set(),
    );
  };

  const togglePlayerName = (playerId: string) => {
    setVisiblePlayerIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 h-full w-full cursor-default bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="結果画像プレビューを閉じる"
        tabIndex={-1}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl items-start justify-center px-4 py-6 md:py-10">
        <div
          ref={dialogRef}
          className="relative w-full rounded-3xl border border-slate-200 bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-image-dialog-title"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 md:px-6">
            <div>
              <h3 id="result-image-dialog-title" className="text-lg font-semibold text-slate-900">
                投稿用結果画像
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                4:5・1440×1800pxのPNGとして生成します。
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 hover:bg-slate-200"
              onClick={onClose}
              ref={closeButtonRef}
            >
              閉じる
            </button>
          </div>

          <div className="grid gap-6 p-5 md:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.55fr)]">
            <div className="min-w-0">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                <canvas
                  ref={canvasRef}
                  width={RESULT_IMAGE_WIDTH}
                  height={RESULT_IMAGE_HEIGHT}
                  className="block aspect-[4/5] h-auto w-full"
                  aria-label="投稿用結果画像のプレビュー"
                />
              </div>
            </div>

            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">参加者名の表示</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      OFFにした名前は画像・投稿文・ALTで「匿名A」形式に置き換えます。
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                      onClick={() => setAllNamesVisible(true)}
                    >
                      全員表示
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                      onClick={() => setAllNamesVisible(false)}
                    >
                      全員隠す
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {participatingPlayers.map((player) => {
                    const visible = visiblePlayerIds.has(player.id);
                    return (
                      <label
                        key={player.id}
                        className="flex cursor-pointer items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <span className="min-w-0 truncate pr-3 text-sm text-slate-700">
                          {player.name}
                        </span>
                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          {visible ? "表示" : "匿名"}
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-sky-600"
                            checked={visible}
                            onChange={() => togglePlayerName(player.id)}
                            aria-label={`${player.name}の名前を表示`}
                          />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">画像を保存・共有</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    画像共有が使えない環境ではPNGを保存してXへ添付してください。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                    onClick={() => void download()}
                    disabled={generating}
                  >
                    PNGをダウンロード
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                    onClick={() => void share()}
                    disabled={generating}
                  >
                    画像を共有
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
                    onClick={() => void copy(postText, "投稿文をコピーしました。")}
                  >
                    投稿文をコピー
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-violet-100 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-200"
                    onClick={() => void copy(altText, "ALTテキストをコピーしました。")}
                  >
                    ALTをコピー
                  </button>
                </div>
                {notice ? (
                  <p
                    className={`text-xs ${
                      notice.tone === "success" ? "text-emerald-600" : "text-rose-600"
                    }`}
                    role="status"
                  >
                    {notice.message}
                  </p>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
