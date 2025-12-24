import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Session } from "../../shared/types";
import {
  loadLocalMeta,
  loadLocalSession,
  saveLocalMeta,
  saveLocalSession,
  type SessionMeta,
} from "./localStorage";
import { HttpPollingSessionSync, type SessionEnvelope } from "./sessionSync";

export type SyncState = "idle" | "syncing" | "error";

const shouldApplyEnvelope = (
  envelope: SessionEnvelope,
  currentVersion: number | null,
): boolean => {
  if (!envelope.session) {
    return false;
  }
  if (currentVersion === null) {
    return true;
  }
  return envelope.version > currentVersion;
};

export const useSessionStore = () => {
  const initialSession = loadLocalSession();
  const initialMeta = loadLocalMeta();
  const [session, setSession] = useState<Session | null>(initialSession);
  const [meta, setMeta] = useState<SessionMeta | null>(initialMeta);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const sync = useMemo(() => new HttpPollingSessionSync(apiBaseUrl), [apiBaseUrl]);
  const versionRef = useRef<number | null>(meta?.version ?? null);

  const applyEnvelope = useCallback((envelope: SessionEnvelope) => {
    if (!envelope.session) {
      return;
    }
    const nextMeta = { version: envelope.version, updatedAt: envelope.updatedAt };
    versionRef.current = envelope.version;
    setSession(envelope.session);
    setMeta(nextMeta);
    saveLocalSession(envelope.session);
    saveLocalMeta(nextMeta);
  }, []);

  const saveSession = useCallback(
    async (next: Session) => {
      setSession(next);
      saveLocalSession(next);
      setSyncState("syncing");
      setLastError(null);

      try {
        await sync.save(next);
        const envelope = sync.getLastEnvelope();
        if (envelope) {
          const nextMeta = { version: envelope.version, updatedAt: envelope.updatedAt };
          versionRef.current = envelope.version;
          setMeta(nextMeta);
          saveLocalMeta(nextMeta);
        }
        setSyncState("idle");
      } catch (error) {
        setSyncState("error");
        setLastError(error instanceof Error ? error.message : "Sync failed");
      }
    },
    [sync],
  );

  useEffect(() => {
    const loadRemote = async () => {
      try {
        const remoteSession = await sync.load();
        const envelope = sync.getLastEnvelope();
        if (remoteSession && envelope && shouldApplyEnvelope(envelope, versionRef.current)) {
          applyEnvelope(envelope);
        }
      } catch {
        // Ignore remote load failure.
      }
    };

    void loadRemote();
  }, [applyEnvelope, sync]);

  useEffect(() => {
    return sync.startPolling((envelope) => {
      if (shouldApplyEnvelope(envelope, versionRef.current)) {
        applyEnvelope(envelope);
      }
    });
  }, [applyEnvelope, sync]);

  return {
    session,
    setSession,
    saveSession,
    syncState,
    lastError,
    meta,
  };
};
