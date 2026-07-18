import type { Session, SessionStatus } from "../../shared/types";
import { buildSessionAggregate } from "./aggregation";

export const RESULT_IMAGE_WIDTH = 1440;
export const RESULT_IMAGE_HEIGHT = 1800;
export const RESULT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const PLAYER_COLORS = [
  "#0284c7",
  "#16a34a",
  "#dc2626",
  "#b45309",
  "#7c3aed",
  "#475569",
] as const;
const ANONYMOUS_NAMES = ["匿名A", "匿名B", "匿名C", "匿名D", "匿名E", "匿名F"] as const;
const FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif';

export type ResultImagePlayer = {
  playerId: string;
  displayName: string;
  color: string;
  totalPoint: number;
  averageRank: number | null;
  hands: number;
  rank: number;
};

export type ResultImageGraphPoint = {
  handIndex: number;
  values: Record<string, number>;
};

export type ResultImageModel = {
  day: string;
  label: string;
  status: SessionStatus;
  statusLabel: string;
  handsCount: number;
  players: ResultImagePlayer[];
  graphPlayers: ResultImagePlayer[];
  series: ResultImageGraphPoint[];
};

const getStatusLabel = (status: SessionStatus): string => {
  if (status === "active") return "途中経過";
  if (status === "finalized") return "最終結果";
  return "集計対象外";
};

const getSessionDay = (session: Session): string =>
  session.day ?? session.createdAt.slice(0, 10);

export const buildResultImageModel = (
  session: Session,
  visiblePlayerIds: ReadonlySet<string>,
  status: SessionStatus,
): ResultImageModel => {
  const aggregate = buildSessionAggregate(session);
  const playerAggregateMap = new Map(
    aggregate.players.map((player) => [player.playerId, player]),
  );
  const participatingPlayers = session.players.filter(
    (player) => (playerAggregateMap.get(player.id)?.hands ?? 0) > 0,
  );
  const displayNameMap = new Map(
    participatingPlayers.map((player, index) => [
      player.id,
      visiblePlayerIds.has(player.id)
        ? player.name
        : (ANONYMOUS_NAMES[index] ?? `匿名${index + 1}`),
    ]),
  );
  const colorMap = new Map(
    participatingPlayers.map((player, index) => [
      player.id,
      PLAYER_COLORS[index] ?? "#475569",
    ]),
  );
  const rankedPlayers = aggregate.players
    .filter((player) => player.hands > 0)
    .map((player, index) => ({
      playerId: player.playerId,
      displayName: displayNameMap.get(player.playerId) ?? "匿名",
      color: colorMap.get(player.playerId) ?? "#475569",
      totalPoint: player.totalPoint,
      averageRank: player.averageRank,
      hands: player.hands,
      rank: index + 1,
    }));
  const rankedPlayerMap = new Map(rankedPlayers.map((player) => [player.playerId, player]));
  const graphPlayers = participatingPlayers.flatMap((player) => {
    const rankedPlayer = rankedPlayerMap.get(player.id);
    return rankedPlayer ? [rankedPlayer] : [];
  });

  return {
    day: getSessionDay(session),
    label: session.label?.trim() ?? "",
    status,
    statusLabel: getStatusLabel(status),
    handsCount: aggregate.handsCount,
    players: rankedPlayers,
    graphPlayers,
    series: aggregate.cumulativeSeries.map((point) => ({
      handIndex: point.handIndex,
      values: Object.fromEntries(
        participatingPlayers.map((player) => [player.id, Number(point[player.id] ?? 0)]),
      ),
    })),
  };
};

const formatPoint = (value: number): string =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)}pt`;

const truncateCodePoints = (value: string, maxLength: number): string => {
  const characters = Array.from(value);
  return characters.length <= maxLength
    ? value
    : `${characters.slice(0, Math.max(0, maxLength - 1)).join("")}…`;
};

export const buildResultImagePostText = (model: ResultImageModel): string => {
  const heading = `${model.day}${
    model.label ? ` ${truncateCodePoints(model.label, 20)}` : ""
  } 麻雀結果（${model.handsCount}半荘）`;
  const ranking = model.players.map(
    (player) =>
      `${player.rank}位 ${truncateCodePoints(player.displayName, 12)} ${formatPoint(
        player.totalPoint,
      )}`,
  );
  return truncateCodePoints([heading, "", ...ranking, "", "#麻雀"].join("\n"), 280);
};

export const buildResultImageAltText = (model: ResultImageModel): string => {
  const heading = `${model.day}${
    model.label ? ` ${truncateCodePoints(model.label, 80)}` : ""
  }の麻雀${model.statusLabel}。${model.handsCount}半荘。`;
  const ranking = model.players
    .map(
      (player) =>
        `${player.rank}位 ${truncateCodePoints(
          player.displayName,
          60,
        )} ${formatPoint(player.totalPoint)}、平均順位${
          player.averageRank?.toFixed(1) ?? "-"
        }。`,
    )
    .join("");
  return truncateCodePoints(
    `${heading}${ranking}上部に各参加者の累積ポイント推移グラフ。`,
    1000,
  );
};

const sanitizeFilenamePart = (value: string): string =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 40);

export const buildResultImageFilename = (model: ResultImageModel): string => {
  const label = sanitizeFilenamePart(model.label);
  return `mjscore-${sanitizeFilenamePart(model.day)}${label ? `-${label}` : ""}.png`;
};

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const clampedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + clampedRadius, y);
  context.arcTo(x + width, y, x + width, y + height, clampedRadius);
  context.arcTo(x + width, y + height, x, y + height, clampedRadius);
  context.arcTo(x, y + height, x, y, clampedRadius);
  context.arcTo(x, y, x + width, y, clampedRadius);
  context.closePath();
};

const fillRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
) => {
  context.fillStyle = color;
  drawRoundedRect(context, x, y, width, height, radius);
  context.fill();
};

const strokeRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
) => {
  context.strokeStyle = color;
  drawRoundedRect(context, x, y, width, height, radius);
  context.stroke();
};

const setFont = (
  context: CanvasRenderingContext2D,
  size: number,
  weight: number = 400,
) => {
  context.font = `${weight} ${size}px ${FONT_FAMILY}`;
};

const fitText = (
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string => {
  if (context.measureText(value).width <= maxWidth) return value;
  const characters = Array.from(value);
  while (
    characters.length > 0 &&
    context.measureText(`${characters.join("")}…`).width > maxWidth
  ) {
    characters.pop();
  }
  return `${characters.join("")}…`;
};

const chooseNiceStep = (range: number): number => {
  if (range <= 0) return 10;
  const rawStep = range / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
};

const getYAxis = (model: ResultImageModel): { min: number; max: number; step: number } => {
  const values = model.series.flatMap((point) => Object.values(point.values));
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  if (rawMin === rawMax) {
    return { min: -10, max: 10, step: 5 };
  }
  const step = chooseNiceStep(rawMax - rawMin);
  let min = Math.floor(rawMin / step) * step;
  let max = Math.ceil(rawMax / step) * step;
  if (min === rawMin) min -= step;
  if (max === rawMax) max += step;
  return { min, max, step };
};

const drawHeader = (context: CanvasRenderingContext2D, model: ResultImageModel) => {
  context.fillStyle = "#0f172a";
  context.textAlign = "left";
  context.textBaseline = "middle";
  setFont(context, 42, 650);
  context.fillText(model.day.replaceAll("-", "."), 80, 92);
  setFont(context, 68, 750);
  context.fillText("麻雀結果", 80, 178);

  if (model.label) {
    context.fillStyle = "#475569";
    setFont(context, 34, 500);
    context.fillText(fitText(context, model.label, 560), 390, 180);
  }

  setFont(context, 30, 700);
  const badgeWidth = context.measureText(model.statusLabel).width + 64;
  fillRoundedRect(context, 1360 - badgeWidth, 60, badgeWidth, 66, 33, "#e2e8f0");
  context.fillStyle = "#334155";
  context.textAlign = "center";
  context.fillText(model.statusLabel, 1360 - badgeWidth / 2, 94);

  context.fillStyle = "#64748b";
  setFont(context, 32, 600);
  context.textAlign = "right";
  context.fillText(`${model.handsCount}半荘`, 1360, 190);
};

const drawLegend = (
  context: CanvasRenderingContext2D,
  players: ResultImagePlayer[],
  y: number,
) => {
  const columns = 3;
  const cellWidth = 380;
  players.forEach((player, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 140 + column * cellWidth;
    const itemY = y + row * 58;
    context.strokeStyle = player.color;
    context.lineWidth = 8;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(x, itemY);
    context.lineTo(x + 42, itemY);
    context.stroke();
    context.fillStyle = "#334155";
    context.textAlign = "left";
    setFont(context, 30, 650);
    context.fillText(fitText(context, player.displayName, 270), x + 62, itemY);
  });
};

const drawChart = (context: CanvasRenderingContext2D, model: ResultImageModel) => {
  const cardX = 72;
  const cardY = 270;
  const cardWidth = 1296;
  const cardHeight = 750;
  fillRoundedRect(context, cardX, cardY, cardWidth, cardHeight, 36, "#ffffff");
  context.lineWidth = 2;
  strokeRoundedRect(context, cardX, cardY, cardWidth, cardHeight, 36, "#e2e8f0");

  context.fillStyle = "#0f172a";
  context.textAlign = "left";
  setFont(context, 40, 750);
  context.fillText("累積ポイント推移", 120, 335);
  context.fillStyle = "#64748b";
  context.textAlign = "right";
  setFont(context, 28, 600);
  context.fillText("累積pt", 1320, 335);

  drawLegend(context, model.graphPlayers, 405);

  const plotLeft = 170;
  const plotRight = 1310;
  const legendRows = Math.max(1, Math.ceil(model.graphPlayers.length / 3));
  const plotTop = 470 + (legendRows - 1) * 58;
  const plotBottom = 930;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const yAxis = getYAxis(model);
  const yRange = yAxis.max - yAxis.min;
  const maxHand = Math.max(model.handsCount, 1);
  const mapX = (handIndex: number): number => plotLeft + (handIndex / maxHand) * plotWidth;
  const mapY = (value: number): number =>
    plotBottom - ((value - yAxis.min) / yRange) * plotHeight;

  context.textBaseline = "middle";
  context.lineWidth = 2;
  for (let tick = yAxis.min; tick <= yAxis.max + yAxis.step / 2; tick += yAxis.step) {
    const y = mapY(tick);
    context.strokeStyle = tick === 0 ? "#94a3b8" : "#e2e8f0";
    context.lineWidth = tick === 0 ? 4 : 2;
    context.beginPath();
    context.moveTo(plotLeft, y);
    context.lineTo(plotRight, y);
    context.stroke();
    context.fillStyle = "#64748b";
    context.textAlign = "right";
    setFont(context, 24, 500);
    context.fillText(String(tick), plotLeft - 24, y);
  }

  const xTickStep = Math.max(1, Math.ceil(model.handsCount / 8));
  const xTicks = new Set<number>([0, model.handsCount]);
  for (let hand = xTickStep; hand < model.handsCount; hand += xTickStep) {
    xTicks.add(hand);
  }
  [...xTicks]
    .sort((left, right) => left - right)
    .forEach((hand) => {
      const x = mapX(hand);
      context.fillStyle = "#64748b";
      context.textAlign = "center";
      setFont(context, 24, 500);
      context.fillText(String(hand), x, plotBottom + 38);
    });

  for (const player of model.graphPlayers) {
    context.strokeStyle = player.color;
    context.lineWidth = 7;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    model.series.forEach((point, index) => {
      const x = mapX(point.handIndex);
      const y = mapY(point.values[player.playerId] ?? 0);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  context.fillStyle = "#64748b";
  context.textAlign = "right";
  setFont(context, 24, 600);
  context.fillText("半荘", plotRight, plotBottom + 76);
};

const drawRanking = (context: CanvasRenderingContext2D, model: ResultImageModel) => {
  const cardX = 72;
  const cardY = 1050;
  const cardWidth = 1296;
  const cardHeight = 660;
  fillRoundedRect(context, cardX, cardY, cardWidth, cardHeight, 36, "#ffffff");
  context.lineWidth = 2;
  strokeRoundedRect(context, cardX, cardY, cardWidth, cardHeight, 36, "#e2e8f0");

  context.fillStyle = "#0f172a";
  context.textAlign = "left";
  setFont(context, 40, 750);
  context.fillText("トータル成績", 120, 1115);

  const rowTop = 1165;
  const rowHeight = Math.min(110, 500 / Math.max(model.players.length, 1));
  model.players.forEach((player, index) => {
    const centerY = rowTop + rowHeight * index + rowHeight / 2;
    if (index > 0) {
      context.strokeStyle = "#e2e8f0";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(120, rowTop + rowHeight * index);
      context.lineTo(1320, rowTop + rowHeight * index);
      context.stroke();
    }

    context.fillStyle = "#64748b";
    context.textAlign = "center";
    setFont(context, 31, 700);
    context.fillText(`${player.rank}位`, 175, centerY);

    fillRoundedRect(context, 248, centerY - 14, 28, 28, 8, player.color);
    context.fillStyle = "#0f172a";
    context.textAlign = "left";
    setFont(context, 34, 700);
    context.fillText(fitText(context, player.displayName, 390), 300, centerY);

    context.fillStyle = player.totalPoint >= 0 ? "#047857" : "#be123c";
    context.textAlign = "right";
    setFont(context, 38, 750);
    context.fillText(formatPoint(player.totalPoint), 940, centerY);

    context.fillStyle = "#64748b";
    setFont(context, 27, 600);
    context.fillText(
      `平均 ${player.averageRank?.toFixed(1) ?? "-"}位`,
      1135,
      centerY,
    );
    context.fillText(`${player.hands}半荘`, 1310, centerY);
  });
};

export const drawResultImage = (
  context: CanvasRenderingContext2D,
  model: ResultImageModel,
) => {
  context.save();
  context.clearRect(0, 0, RESULT_IMAGE_WIDTH, RESULT_IMAGE_HEIGHT);
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, RESULT_IMAGE_WIDTH, RESULT_IMAGE_HEIGHT);
  context.textBaseline = "middle";
  drawHeader(context, model);
  drawChart(context, model);
  drawRanking(context, model);

  context.fillStyle = "#64748b";
  context.textAlign = "right";
  setFont(context, 25, 650);
  context.fillText("mjscore", 1360, 1760);
  context.restore();
};

export const resultImageCanvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("画像の生成に失敗しました。"));
        return;
      }
      if (blob.size > RESULT_IMAGE_MAX_BYTES) {
        reject(new Error("画像サイズが5MBを超えました。"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
