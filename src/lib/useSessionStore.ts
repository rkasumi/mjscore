import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Session } from "../../shared/types";
import {
  clearLocalSession,
  loadLocalMeta,
  loadLocalSession,
  saveLocalMeta,
  saveLocalSession,
  type SessionMeta,
} from "./localStorage";
import {
  HttpPollingSessionSync,
  SessionSyncConflictError,
  type SessionEnvelope,
} from "./sessionSync";

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
  const [conflictEnvelope, setConflictEnvelope] = useState<SessionEnvelope | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const sync = useMemo(() => new HttpPollingSessionSync(apiBaseUrl), [apiBaseUrl]);
  const versionRef = useRef<number | null>(meta?.version ?? null);
  const metaRef = useRef<SessionMeta | null>(meta);
  const latestSessionRef = useRef<Session | null>(initialSession);
  const flushPromiseRef = useRef<Promise<void> | null>(null);
  const conflictRef = useRef(false);

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
    (envelope: SessionEnvelope) => {
      if (!envelope.session) {
        return;
      }
      const now = Date.now();
      const prevMeta = metaRef.current ?? createEmptyMeta();
      const nextMeta: SessionMeta = {
        ...prevMeta,
        version: envelope.version,
        updatedAt: envelope.updatedAt,
        dirty: false,
        lastSyncSuccessAt: now,
        lastSyncError: null,
      };
      versionRef.current = envelope.version;
      setSession(envelope.session);
      latestSessionRef.current = envelope.session;
      updateMeta(nextMeta);
      if (!disablePersistence) {
        saveLocalSession(envelope.session);
      }
    },
    [disablePersistence, updateMeta],
  );

  const flushLatestSession = useCallback(async () => {
    if (disableSync || conflictRef.current) {
      return;
    }
    setSyncState("syncing");
    setLastError(null);

    while (!conflictRef.current) {
      const target = latestSessionRef.current;
      if (!target) {
        break;
      }
      const baseVersion = versionRef.current ?? 0;
      try {
        await sync.save(target, baseVersion);
        const envelope = sync.getLastEnvelope();
        if (!envelope) {
          throw new Error("Sync response was empty");
        }
        versionRef.current = envelope.version;
        const isLatest = latestSessionRef.current === target;
        const currentMeta = metaRef.current ?? createEmptyMeta();
        updateMeta({
          ...currentMeta,
          version: envelope.version,
          updatedAt: envelope.updatedAt,
          dirty: !isLatest,
          lastSyncSuccessAt: Date.now(),
          lastSyncError: null,
        });
        if (isLatest) {
          setSession(envelope.session);
          latestSessionRef.current = envelope.session;
          if (!disablePersistence && envelope.session) {
            saveLocalSession(envelope.session);
          }
          setSyncState("idle");
          return;
        }
      } catch (error) {
        const currentMeta = metaRef.current ?? createEmptyMeta();
        if (error instanceof SessionSyncConflictError) {
          conflictRef.current = true;
          setConflictEnvelope(error.current);
          versionRef.current = error.current.version;
          const message = "他の端末で更新されています。内容を確認してから再同期してください。";
          setLastError(message);
          updateMeta({
            ...currentMeta,
            version: error.current.version,
            updatedAt: error.current.updatedAt,
            dirty: true,
            lastSyncError: { message, at: Date.now() },
          });
        } else {
          const message = error instanceof Error ? error.message : "Sync failed";
          setLastError(message);
          updateMeta({
            ...currentMeta,
            dirty: true,
            lastSyncError: { message, at: Date.now() },
          });
        }
        setSyncState("error");
        return;
      }
    }
  }, [disablePersistence, disableSync, sync, updateMeta]);

  const startFlush = useCallback((): Promise<void> => {
    if (flushPromiseRef.current) {
      return flushPromiseRef.current;
    }
    const promise = flushLatestSession();
    flushPromiseRef.current = promise;
    void promise.finally(() => {
      if (flushPromiseRef.current === promise) {
        flushPromiseRef.current = null;
      }
    });
    return promise;
  }, [flushLatestSession]);

  const saveSession = useCallback(
    async (next: Session) => {
      const now = Date.now();
      const baseMeta = metaRef.current ?? createEmptyMeta();
      latestSessionRef.current = next;
      updateMeta({
        ...baseMeta,
        dirty: true,
        lastLocalChangeAt: now,
      });
      setSession(next);
      if (!disablePersistence) {
        saveLocalSession(next);
      }
      if (!disableSync && !conflictRef.current) {
        await startFlush();
      }
    },
    [disablePersistence, disableSync, startFlush, updateMeta],
  );

  useEffect(() => {
    if (disableSync) {
      return;
    }
    const loadRemote = async () => {
      try {
        const remoteSession = await sync.load();
        const envelope = sync.getLastEnvelope();
        if (
          remoteSession &&
          envelope &&
          !metaRef.current?.dirty &&
          shouldApplyEnvelope(envelope, versionRef.current)
        ) {
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
      if (!metaRef.current?.dirty && shouldApplyEnvelope(envelope, versionRef.current)) {
        applyEnvelope(envelope);
      }
    });
  }, [applyEnvelope, disableSync, sync]);

  const retrySync = useCallback(async () => {
    if (disableSync || !session || conflictRef.current) {
      return;
    }
    latestSessionRef.current = session;
    await startFlush();
  }, [disableSync, session, startFlush]);

  const acceptRemoteConflict = useCallback(() => {
    if (!conflictEnvelope) {
      return;
    }
    conflictRef.current = false;
    setConflictEnvelope(null);
    setLastError(null);
    setSyncState("idle");
    if (conflictEnvelope.session) {
      applyEnvelope(conflictEnvelope);
      return;
    }
    versionRef.current = conflictEnvelope.version;
    latestSessionRef.current = null;
    setSession(null);
    updateMeta({
      ...(metaRef.current ?? createEmptyMeta()),
      version: conflictEnvelope.version,
      updatedAt: conflictEnvelope.updatedAt,
      dirty: false,
      lastSyncSuccessAt: Date.now(),
      lastSyncError: null,
    });
    if (!disablePersistence) {
      clearLocalSession();
    }
  }, [applyEnvelope, conflictEnvelope, disablePersistence, updateMeta]);

  const overwriteRemoteConflict = useCallback(async () => {
    if (!conflictEnvelope || !latestSessionRef.current) {
      return;
    }
    conflictRef.current = false;
    setConflictEnvelope(null);
    await startFlush();
  }, [conflictEnvelope, startFlush]);

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
    conflictEnvelope,
    acceptRemoteConflict,
    overwriteRemoteConflict,
  };
};
