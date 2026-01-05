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

type UseSessionStoreOptions = {
  initialSession?: Session | null;
  disableSync?: boolean;
  disablePersistence?: boolean;
};

export const useSessionStore = (options: UseSessionStoreOptions = {}) => {
  const { initialSession: initialSessionOverride, disableSync = false, disablePersistence = false } =
    options;
  const initialSession = initialSessionOverride ?? (disablePersistence ? null : loadLocalSession());
  const initialMeta = disablePersistence ? null : loadLocalMeta();
  const [session, setSession] = useState<Session | null>(initialSession);
  const [meta, setMeta] = useState<SessionMeta | null>(initialMeta);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const sync = useMemo(() => new HttpPollingSessionSync(apiBaseUrl), [apiBaseUrl]);
  const versionRef = useRef<number | null>(meta?.version ?? null);

  const applyEnvelope = useCallback(
    (envelope: SessionEnvelope) => {
      if (!envelope.session) {
        return;
      }
      const nextMeta = { version: envelope.version, updatedAt: envelope.updatedAt };
      versionRef.current = envelope.version;
      setSession(envelope.session);
      setMeta(nextMeta);
      if (!disablePersistence) {
        saveLocalSession(envelope.session);
        saveLocalMeta(nextMeta);
      }
    },
    [disablePersistence],
  );

  const saveSession = useCallback(
    async (next: Session) => {
      setSession(next);
      if (!disablePersistence) {
        saveLocalSession(next);
      }
      if (disableSync) {
        return;
      }
      setSyncState("syncing");
      setLastError(null);

      try {
        await sync.save(next);
        const envelope = sync.getLastEnvelope();
        if (envelope) {
          const nextMeta = { version: envelope.version, updatedAt: envelope.updatedAt };
          versionRef.current = envelope.version;
          setMeta(nextMeta);
          if (!disablePersistence) {
            saveLocalMeta(nextMeta);
          }
        }
        setSyncState("idle");
      } catch (error) {
        setSyncState("error");
        setLastError(error instanceof Error ? error.message : "Sync failed");
      }
    },
    [disablePersistence, disableSync, sync],
  );

  useEffect(() => {
    if (disableSync) {
      return;
    }
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
  }, [applyEnvelope, disableSync, sync]);

  useEffect(() => {
    if (disableSync) {
      return;
    }
    return sync.startPolling((envelope) => {
      if (shouldApplyEnvelope(envelope, versionRef.current)) {
        applyEnvelope(envelope);
      }
    });
  }, [applyEnvelope, disableSync, sync]);

  return {
    session,
    setSession,
    saveSession,
    syncState,
    lastError,
    meta,
  };
};
