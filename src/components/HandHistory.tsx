import type { Hand, Player } from "../../shared/types";
import { calculateHandResults } from "../lib/scoring";

const formatScore = (score: number): string => `${score.toLocaleString()}点`;

const formatPoint = (point: number): string => `${point.toFixed(1)} pt`;

const findName = (players: Player[], id: string): string =>
  players.find((player) => player.id === id)?.name ?? "不明";

type Props = {
  players: Player[];
  hands: Hand[];
  onEdit: (handId: string) => void;
  onDelete: (handId: string) => void;
};

type OrderedSeat = {
  rank: number;
  name: string;
  score: number;
  point: number;
};

const buildOrderedSeats = (players: Player[], hand: Hand): OrderedSeat[] => {
  const results = calculateHandResults(hand.seats);
  const pointMap = new Map(results.map((result) => [result.playerId, result]));

  return hand.seats
    .map((seat) => {
      const result = pointMap.get(seat.playerId);
      return {
        rank: result?.rank ?? 4,
        name: findName(players, seat.playerId),
        score: seat.score,
        point: result?.totalPoint ?? 0,
      };
    })
    .sort((a, b) => a.rank - b.rank);
};

export const HandHistory = ({ players, hands, onEdit, onDelete }: Props) => {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="section-title">半荘ごと</h2>
        <span className="text-xs text-slate-500">{hands.length} 半荘</span>
      </div>
      <div className="mt-4">
        {hands.length === 0 ? (
          <p className="text-sm text-slate-500">まだ半荘が登録されていません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3">半荘</th>
                  <th className="py-2 pr-3">1位</th>
                  <th className="py-2 pr-3">2位</th>
                  <th className="py-2 pr-3">3位</th>
                  <th className="py-2 pr-3">4位</th>
                  <th className="py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {hands.map((hand, index) => {
                  const ordered = buildOrderedSeats(players, hand);
                  return (
                    <tr key={hand.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-500">{index + 1}</td>
                      {ordered.map((seat) => (
                        <td key={`${hand.id}-${seat.rank}`} className="py-2 pr-3">
                          <div className="text-slate-900">{seat.name}</div>
                          <div className="text-xs text-slate-500">
                            {formatScore(seat.score)} / {formatPoint(seat.point)}
                          </div>
                        </td>
                      ))}
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200"
                            onClick={() => onEdit(hand.id)}
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-200"
                            onClick={() => {
                              const confirmed = window.confirm("この半荘履歴を削除しますか？");
                              if (confirmed) {
                                onDelete(hand.id);
                              }
                            }}
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
