import express from "express";
import cors from "cors";

import { isDateOnly } from "../shared/sessionValidation.js";
import { buildAnalytics } from "./analytics.js";
import {
  getDefaultRepository,
  PlayerIdentityConflictError,
  readEnvelope,
  SessionConflictError,
  writeEnvelope,
} from "./storage.js";

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

app.get("/sessions", (_req, res) => {
  try {
    res.json({ sessions: getDefaultRepository().listSessions() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/sessions/:id", (req, res) => {
  try {
    const detail = getDefaultRepository().readSessionDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/analytics", (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;
  if (
    (from && !isDateOnly(from)) ||
    (to && !isDateOnly(to)) ||
    (from && to && from > to)
  ) {
    res.status(400).json({ error: "Invalid analytics date range" });
    return;
  }
  try {
    const sessions = getDefaultRepository().listFinalizedSessions(from, to);
    res.json(buildAnalytics(sessions, from, to));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/seasons", (_req, res) => {
  try {
    res.json({ seasons: getDefaultRepository().listSeasons() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/players", (_req, res) => {
  try {
    const repository = getDefaultRepository();
    res.json({
      players: repository.listKnownPlayers(),
      knownPlayers: repository.listAllPlayers(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/seasons", (req, res) => {
  const body = req.body as { name?: unknown; startsOn?: unknown; endsOn?: unknown };
  if (
    typeof body.name !== "string" ||
    typeof body.startsOn !== "string" ||
    typeof body.endsOn !== "string"
  ) {
    res.status(400).json({ error: "name, startsOn, and endsOn are required" });
    return;
  }
  try {
    res.status(201).json(getDefaultRepository().createSeason(body.name, body.startsOn, body.endsOn));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid season" });
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
    if (error instanceof PlayerIdentityConflictError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

const handleSessionMutationError = (error: unknown, res: express.Response): void => {
  if (error instanceof SessionConflictError) {
    res.status(409).json({ error: error.message, current: error.current });
    return;
  }
  if (error instanceof Error && error.message.toLowerCase().endsWith("session not found")) {
    res.status(404).json({ error: error.message });
    return;
  }
  if (error instanceof Error && error.message.includes("cannot be")) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
};

app.post("/sessions/:id/reopen", (req, res) => {
  const body = req.body as { baseVersion?: unknown };
  if (!Number.isInteger(body.baseVersion) || Number(body.baseVersion) < 0) {
    res.status(400).json({ error: "baseVersion is required" });
    return;
  }
  try {
    res.json(getDefaultRepository().reopenSession(req.params.id, Number(body.baseVersion)));
  } catch (error) {
    handleSessionMutationError(error, res);
  }
});

app.post("/sessions/:id/finalize", (req, res) => {
  const body = req.body as { baseVersion?: unknown };
  if (!Number.isInteger(body.baseVersion) || Number(body.baseVersion) < 0) {
    res.status(400).json({ error: "baseVersion is required" });
    return;
  }
  try {
    res.json(getDefaultRepository().finalizeActiveSession(req.params.id, Number(body.baseVersion)));
  } catch (error) {
    handleSessionMutationError(error, res);
  }
});

app.post("/sessions/:id/void", (req, res) => {
  const body = req.body as { baseVersion?: unknown };
  if (!Number.isInteger(body.baseVersion) || Number(body.baseVersion) < 0) {
    res.status(400).json({ error: "baseVersion is required" });
    return;
  }
  try {
    res.json(getDefaultRepository().voidSession(req.params.id, Number(body.baseVersion)));
  } catch (error) {
    handleSessionMutationError(error, res);
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`session-api listening on ${port}`);
});
