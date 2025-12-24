import { promises as fs } from "node:fs";
import path from "node:path";

import type { Session } from "../shared/types.js";

export type SessionEnvelope = {
  version: number;
  updatedAt: string;
  session: Session | null;
};

const dataDir = process.env.DATA_DIR ?? "/data";
const filePath = path.join(dataDir, "session.json");

const defaultEnvelope = (): SessionEnvelope => ({
  version: 0,
  updatedAt: new Date().toISOString(),
  session: null,
});

const ensureDir = async () => {
  await fs.mkdir(dataDir, { recursive: true });
};

export const readEnvelope = async (): Promise<SessionEnvelope> => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as SessionEnvelope;
  } catch {
    const envelope = defaultEnvelope();
    await writeEnvelope(envelope);
    return envelope;
  }
};

export const writeEnvelope = async (envelope: SessionEnvelope): Promise<void> => {
  await ensureDir();
  await fs.writeFile(filePath, JSON.stringify(envelope, null, 2), "utf-8");
};
