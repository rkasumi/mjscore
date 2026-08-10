import type { Session } from "../../shared/types";
import { buildSessionAggregate } from "./aggregation";

const formatPoint = (point: number): string => `${point >= 0 ? "+" : ""}${point.toFixed(1)}pt`;

export const buildResultShareText = (session: Session, shareUrl?: string): string => {
  const aggregate = buildSessionAggregate(session);
  const heading = `${session.day ?? session.createdAt.slice(0, 10)}${
    session.label ? ` ${session.label}` : ""
  } 麻雀結果（${aggregate.handsCount}半荘）`;
  const ranking = aggregate.players.map(
    (player) => `${player.rank}位 ${player.name} ${formatPoint(player.totalPoint)}`,
  );
  return [heading, "", ...ranking, ...(shareUrl ? ["", `共有: ${shareUrl}`] : [])].join("\n");
};
