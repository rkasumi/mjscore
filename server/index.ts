import express from "express";
import cors from "cors";

import { readEnvelope, SessionConflictError, writeEnvelope } from "./storage.js";

const app = express();
const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (corsOrigins.length > 0) {
  app.use(cors({ origin: corsOrigins }));
}
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/session", async (_req, res) => {
  try {
    const envelope = await readEnvelope();
    res.json(envelope);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/session", async (req, res) => {
  const body = req.body as { baseVersion?: unknown; session?: unknown };
  if (!body.session || !Number.isInteger(body.baseVersion) || Number(body.baseVersion) < 0) {
    res.status(400).json({ error: "session and baseVersion are required" });
    return;
  }

  try {
    const next = await writeEnvelope(body.session, Number(body.baseVersion));
    res.json(next);
  } catch (error) {
    if (error instanceof SessionConflictError) {
      res.status(409).json({ error: error.message, current: error.current });
      return;
    }
    if (error instanceof Error && error.message === "Invalid session payload") {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`session-api listening on ${port}`);
});
