import type { Session } from "../../shared/types";

export type SessionEnvelope = {
  version: number;
  updatedAt: string;
  session: Session | null;
};

export interface SessionSync {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
}

export class HttpPollingSessionSync implements SessionSync {
  private lastEnvelope: SessionEnvelope | null = null;

  constructor(
    private baseUrl: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  getLastEnvelope(): SessionEnvelope | null {
    return this.lastEnvelope;
  }

  async load(): Promise<Session | null> {
    const envelope = await this.fetchEnvelope();
    this.lastEnvelope = envelope;
    return envelope.session;
  }

  async save(session: Session): Promise<void> {
    const envelope = await this.postSession(session);
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
    return (await response.json()) as SessionEnvelope;
  }

  private async postSession(session: Session): Promise<SessionEnvelope> {
    const response = await this.fetchImpl(`${this.baseUrl}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session }),
    });
    if (!response.ok) {
      throw new Error("Failed to save session");
    }
    return (await response.json()) as SessionEnvelope;
  }
}
