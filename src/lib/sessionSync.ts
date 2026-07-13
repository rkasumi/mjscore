import type { Session, SessionEnvelope } from "../../shared/types";
import { parseSessionEnvelope } from "../../shared/sessionValidation";

export type { SessionEnvelope } from "../../shared/types";

export class SessionSyncConflictError extends Error {
  constructor(readonly current: SessionEnvelope) {
    super("Session version conflict");
    this.name = "SessionSyncConflictError";
  }
}

export interface SessionSync {
  load(): Promise<Session | null>;
  save(session: Session, baseVersion: number): Promise<void>;
}

export class HttpPollingSessionSync implements SessionSync {
  private lastEnvelope: SessionEnvelope | null = null;
  private fetchImpl: typeof fetch;

  constructor(
    private baseUrl: string,
    fetchImpl: typeof fetch = fetch,
  ) {
    const target = typeof window !== "undefined" && fetchImpl === fetch ? window.fetch : fetchImpl;
    // Bind to avoid "Illegal invocation" errors in some browsers when fetch is called unbound.
    this.fetchImpl = target.bind(typeof window !== "undefined" ? window : globalThis);
  }

  getLastEnvelope(): SessionEnvelope | null {
    return this.lastEnvelope;
  }

  async load(): Promise<Session | null> {
    const envelope = await this.fetchEnvelope();
    this.lastEnvelope = envelope;
    return envelope.session;
  }

  async save(session: Session, baseVersion: number): Promise<void> {
    const envelope = await this.postSession(session, baseVersion);
    this.lastEnvelope = envelope;
  }

  startPolling(
    onUpdate: (envelope: SessionEnvelope) => void,
    intervalMs = 5000,
  ): () => void {
    let cancelled = false;

    const tick = async () => {
      try {
        const envelope = await this.fetchEnvelope();
        if (!cancelled) {
          onUpdate(envelope);
        }
      } catch {
        // Ignore polling failures to avoid UI disruption.
      }
    };

    const timer = window.setInterval(tick, intervalMs);
    void tick();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }

  private async fetchEnvelope(): Promise<SessionEnvelope> {
    const response = await this.fetchImpl(`${this.baseUrl}/session`, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error("Failed to load session");
    }
    return parseSessionEnvelope(await response.json());
  }

  private async postSession(session: Session, baseVersion: number): Promise<SessionEnvelope> {
    const response = await this.fetchImpl(`${this.baseUrl}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ baseVersion, session }),
    });
    if (response.status === 409) {
      const payload = (await response.json()) as { current?: unknown };
      if (payload.current) {
        throw new SessionSyncConflictError(parseSessionEnvelope(payload.current));
      }
    }
    if (!response.ok) {
      throw new Error("Failed to save session");
    }
    return parseSessionEnvelope(await response.json());
  }
}
