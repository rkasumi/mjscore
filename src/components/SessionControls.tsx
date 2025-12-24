type Props = {
  hasSession: boolean;
  onCreate: () => void;
  onResetHands: () => void;
};

export const SessionControls = ({ hasSession, onCreate, onResetHands }: Props) => {
  return (
    <div className="flex flex-wrap gap-3">
      {!hasSession ? (
        <button
          type="button"
          className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-200"
          onClick={onCreate}
        >
          卓を開始
        </button>
      ) : null}
      {hasSession ? (
        <button
          type="button"
          className="rounded-2xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200"
          onClick={onResetHands}
        >
          新規卓（履歴リセット）
        </button>
      ) : null}
    </div>
  );
};
