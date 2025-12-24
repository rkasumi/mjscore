type Props = {
  note?: string;
};

export const ReverseCondition = ({ note }: Props) => {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="section-title">逆転条件</h2>
        <span className="text-xs text-slate-400">TODO</span>
      </div>
      <p className="mt-4 text-sm text-slate-400">
        逆転条件の計算は今後実装予定です。{note}
      </p>
    </div>
  );
};
