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

const createEmptyMeta = (): SessionMeta => ({
  version: 0,
  updatedAt: "",
  dirty: false,
  lastLocalChangeAt: 0,
  lastSyncSuccessAt: 0,
  lastSyncError: null,
});

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
  const [meta, setMeta] = useState<SessionMeta | null>(initialMeta ?? createEmptyMeta());
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [lostChanges, setLostChanges] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const sync = useMemo(() => new HttpPollingSessionSync(apiBaseUrl), [apiBaseUrl]);
  const versionRef = useRef<number | null>(meta?.version ?? null);
  const metaRef = useRef<SessionMeta | null>(meta);

  const updateMeta = useCallback(
    (nextMeta: SessionMeta) => {
      metaRef.current = nextMeta;
      setMeta(nextMeta);
      if (!disablePersistence) {
        saveLocalMeta(nextMeta);
      }
    },
    [disablePersistence],
  );

  const applyEnvelope = useCallback(
    (envelope: SessionEnvelope, source: "poll" | "post" | "load") => {
      if (!envelope.session) {
        return;
      }
      const now = Date.now();
      const prevMeta = metaRef.current ?? createEmptyMeta();
      const nextMeta: SessionMeta = {
        ...prevMeta,
        version: envelope.version,
        updatedAt: envelope.updatedAt,
        dirty: source === "poll" ? false : prevMeta.dirty,
        lastSyncSuccessAt: now,
        lastSyncError: null,
      };
      versionRef.current = envelope.version;
      setSession(envelope.session);
      if (source === "poll" && prevMeta.dirty) {
        setLostChanges(true);
      }
      updateMeta(nextMeta);
      if (!disablePersistence) {
        saveLocalSession(envelope.session);
      }
    },
    [disablePersistence, updateMeta],
  );

  const saveSession = useCallback(
    async (next: Session) => {
      const now = Date.now();
      const baseMeta = metaRef.current ?? createEmptyMeta();
      updateMeta({
        ...baseMeta,
        dirty: true,
        lastLocalChangeAt: now,
      });
      const currentMeta = metaRef.current ?? createEmptyMeta();
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
          applyEnvelope(envelope, "post");
        } else {
          const successMeta: SessionMeta = {
            ...currentMeta,
            dirty: false,
            lastSyncSuccessAt: Date.now(),
            lastSyncError: null,
          };
          updateMeta(successMeta);
        }
        setSyncState("idle");
      } catch (error) {
        setSyncState("error");
        const message = error instanceof Error ? error.message : "Sync failed";
        setLastError(message);
        updateMeta({
          ...currentMeta,
          dirty: true,
          lastSyncError: { message, at: Date.now() },
        });
      }
    },
    [applyEnvelope, disablePersistence, disableSync, sync, updateMeta],
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
          applyEnvelope(envelope, "load");
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
        applyEnvelope(envelope, "poll");
      }
    });
  }, [applyEnvelope, disableSync, sync]);

  const retrySync = useCallback(async () => {
    if (disableSync || !session) {
      return;
    }
    setSyncState("syncing");
    setLastError(null);
    const prevMeta = metaRef.current ?? createEmptyMeta();
    try {
      await sync.save(session);
      const envelope = sync.getLastEnvelope();
      if (envelope) {
        applyEnvelope(envelope, "post");
      } else {
        updateMeta({
          ...prevMeta,
          dirty: false,
          lastSyncSuccessAt: Date.now(),
          lastSyncError: null,
        });
      }
      setSyncState("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      setSyncState("error");
      setLastError(message);
      updateMeta({
        ...prevMeta,
        dirty: true,
        lastSyncError: { message, at: Date.now() },
      });
    }
  }, [applyEnvelope, disableSync, session, sync, updateMeta]);

  return {
    session,
    setSession,
    saveSession,
    syncState,
    lastError,
    meta,
    lostChanges,
    setLostChanges,
    retrySync,
  };
};
