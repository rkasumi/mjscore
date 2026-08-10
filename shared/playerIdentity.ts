import type { Player } from "./types.js";

export const normalizePlayerName = (value: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP");

export const findPlayerByName = (
  players: readonly Player[],
  name: string,
): Player | undefined => {
  const normalizedName = normalizePlayerName(name);
  return players.find((player) => normalizePlayerName(player.name) === normalizedName);
};
