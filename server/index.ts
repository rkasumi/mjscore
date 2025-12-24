import express from "express";
import cors from "cors";

import type { Session } from "../shared/types.js";
import { readEnvelope, writeEnvelope } from "./storage.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/session", async (_req, res) => {
  try {
    const envelope = await readEnvelope();
    res.json(envelope);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/session", async (req, res) => {
  const body = req.body as { session?: Session };
  if (!body.session) {
    res.status(400).json({ error: "session is required" });
    return;
  }

  try {
    const current = await readEnvelope();
    const next = {
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      session: body.session,
    };
    await writeEnvelope(next);
    res.json(next);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`session-api listening on ${port}`);
});
