type Props = {
  hasSession: boolean;
  createDisabled?: boolean;
  onCreate: () => void;
  onFinalize: () => void;
  onResetHands: () => void;
};

export const SessionControls = ({
  hasSession,
  createDisabled = false,
  onCreate,
  onFinalize,
  onResetHands,
}: Props) => {
  return (
    <div className="flex flex-wrap gap-3">
      {!hasSession ? (
        <button
          type="button"
          className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
            createDisabled
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
          }`}
          onClick={onCreate}
          disabled={createDisabled}
        >
          卓を開始
        </button>
      ) : null}
      {hasSession ? (
        <button
          type="button"
          className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-200"
          onClick={() => {
            if (window.confirm("現在の卓を確定して履歴へ保存しますか？")) {
              onFinalize();
            }
          }}
        >
          現在の卓を確定
        </button>
      ) : null}
      {hasSession ? (
        <button
          type="button"
          className="rounded-2xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200"
          onClick={() => {
            if (window.confirm("現在の卓を確定して、新しい卓を開始しますか？")) {
              onResetHands();
            }
          }}
        >
          現在の卓を確定して新規卓
        </button>
      ) : null}
    </div>
  );
};
