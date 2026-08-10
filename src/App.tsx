import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { findPlayerByName, normalizePlayerName } from "../shared/playerIdentity";
import type { Hand, HandSeat, Player, Session } from "../shared/types";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { DisplayInsights } from "./components/DisplayInsights";
import { GraphPanel } from "./components/GraphPanel";
import { HandForm } from "./components/HandForm";
import { HandHistory } from "./components/HandHistory";
import { PlayerManager } from "./components/PlayerManager";
import { ReverseCondition } from "./components/ReverseCondition";
import { ScoreTable } from "./components/ScoreTable";
import { SessionControls } from "./components/SessionControls";
import { SessionHistory } from "./components/SessionHistory";
import { SimpleFuPage } from "./components/SimpleFuPage";
import { SnapshotShare } from "./components/SnapshotShare";
import { SummaryPanel } from "./components/SummaryPanel";
import { SyncStatus } from "./components/SyncStatus";
import { buildSessionAggregate } from "./lib/aggregation";
import { createId } from "./lib/id";
import { fetchStoredPlayers, finalizeStoredSession } from "./lib/sessionHistory";
import {
  decodeSnapshot,
  getSnapshotPathEncoded,
  snapshotToSession,
  type SnapshotV1,
} from "./lib/snapshot";
import { useSessionStore } from "./lib/useSessionStore";

const FALLBACK_PLAYER_NAMES = ["プレイヤー1", "プレイヤー2", "プレイヤー3", "プレイヤー4"] as const;
const DEFAULT_APP_CONFIG = {
  defaultPlayerNames: [...FALLBACK_PLAYER_NAMES],
  fixedPlayerCount: 0,
};
const CONFIG_PATH = "/config.json";

type AppConfig = {
  defaultPlayerNames: string[];
  fixedPlayerCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readFixedPlayerCount = (value: unknown, max: number): number => {
  if (value === undefined) {
    return max;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
    return max;
  }
  return parsed;
};

const readDefaultPlayerNames = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const names = value
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  if (names.length < 1 || names.length > 6) {
    return null;
  }
  return names;
};

const readAppConfig = (value: unknown): AppConfig => {
  if (!isRecord(value)) {
    return DEFAULT_APP_CONFIG;
  }
  const names = readDefaultPlayerNames(value.defaultPlayerNames);
  if (!names) {
    return DEFAULT_APP_CONFIG;
  }
  return {
    defaultPlayerNames: names,
    fixedPlayerCount: readFixedPlayerCount(value.fixedPlayerCount, names.length),
  };
};
const readSecondsEnv = (value: string | undefined, fallbackSeconds: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackSeconds;
  }
  return parsed;
};
const DISPLAY_REFRESH_INTERVAL_SEC = readSecondsEnv(
  import.meta.env.VITE_DISPLAY_REFRESH_INTERVAL_SEC,
  30 * 60,
);
const DISPLAY_REFRESH_DURATION_SEC = readSecondsEnv(
  import.meta.env.VITE_DISPLAY_REFRESH_DURATION_SEC,
  5,
);

type SnapshotState = {
  encoded: string | null;
  snapshot: SnapshotV1 | null;
  error: string | null;
};

type ActivePanel = "analytics" | "controls" | "handInput" | "history" | "reverse" | "scoreTable";

const getInitialPanel = (): ActivePanel | null => {
  if (window.location.hash === "#score-table" || window.location.hash === "#fu-table") {
    return "scoreTable";
  }
  return null;
};

const toJstDateString = (value: Date): string => {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(value).replace(/\//g, "-");
};

const deriveSessionDay = (session: Session): string => {
  if (session.day) {
    return session.day;
  }
  const parsed = new Date(session.createdAt);
  return toJstDateString(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
};

const createSession = (playerNames: string[]): Session => ({
  id: createId(),
  createdAt: new Date().toISOString(),
  day: toJstDateString(new Date()),
  players: playerNames.map((name) => ({ id: createId(), name })),
  hands: [],
});

const createSessionWithPlayers = (players: Player[]): Session => ({
  id: createId(),
  createdAt: new Date().toISOString(),
  day: toJstDateString(new Date()),
  players: players.map((player) => ({ ...player })),
  hands: [],
});

const updateHand = (hands: Hand[], nextHand: Hand): Hand[] =>
  hands.map((hand) => (hand.id === nextHand.id ? nextHand : hand));

const removeHand = (hands: Hand[], handId: string): Hand[] =>
  hands.filter((hand) => hand.id !== handId);

const canRemovePlayer = (session: Session, playerId: string): boolean =>
  !session.hands.some((hand) => hand.seats.some((seat) => seat.playerId === playerId));

const mergeKnownPlayers = (current: Player[], incoming: readonly Player[]): Player[] => {
  const merged = new Map(current.map((player) => [player.id, player]));
  incoming.forEach((player) => merged.set(player.id, player));
  return [...merged.values()];
};

const parseSnapshotFromLocation = (): SnapshotState => {
  const pathEncoded = getSnapshotPathEncoded(window.location.pathname);
  if (pathEncoded) {
    const { snapshot, error } = decodeSnapshot(pathEncoded);
    return { encoded: pathEncoded, snapshot, error };
  }
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const encoded = params.get("s");
  if (!encoded) {
    return { encoded: null, snapshot: null, error: null };
  }
  const { snapshot, error } = decodeSnapshot(encoded);
  return { encoded, snapshot, error };
};

const ScoreApp = () => {
  const [snapshotState, setSnapshotState] = useState<SnapshotState>(parseSnapshotFromLocation);
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [appConfigLoaded, setAppConfigLoaded] = useState(false);
  useEffect(() => {
    const handleHashChange = () => setSnapshotState(parseSnapshotFromLocation());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const loadConfig = async () => {
      try {
        const response = await fetch(CONFIG_PATH, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          setAppConfig(readAppConfig(await response.json()));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      } finally {
        if (!controller.signal.aborted) {
          setAppConfigLoaded(true);
        }
      }
    };
    void loadConfig();
    return () => controller.abort();
  }, []);
  const snapshotMode = snapshotState.encoded !== null;
  const snapshotSession = useMemo(
    () => (snapshotState.snapshot ? snapshotToSession(snapshotState.snapshot) : null),
    [snapshotState.snapshot],
  );
  const {
    session,
    setSession,
    saveSession,
    syncState,
    lastError,
    meta,
    retrySync,
    conflictEnvelope,
    acceptRemoteConflict,
    overwriteRemoteConflict,
    adoptEnvelope,
  } = useSessionStore({
    initialSession: snapshotMode ? snapshotSession : undefined,
    disableSync: snapshotMode,
    disablePersistence: snapshotMode,
  });
  const [editingHandId, setEditingHandId] = useState<string | null>(null);
  const [storedPlayers, setStoredPlayers] = useState<Player[]>([]);
  const [knownPlayers, setKnownPlayers] = useState<Player[]>([]);
  const [storedPlayersLoaded, setStoredPlayersLoaded] = useState(false);
  const [sessionLabelDraft, setSessionLabelDraft] = useState("");
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(getInitialPanel);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const queryDisplayMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("display") ?? params.get("mode") ?? "";
    return value === "1" || value.toLowerCase() === "true" || value === "display";
  }, []);
  const displayMode = snapshotMode ? false : queryDisplayMode;
  const inviteUrl = import.meta.env.VITE_INVITE_URL ?? "";
  const inviteImageSrc = import.meta.env.VITE_INVITE_IMAGE_SRC ?? "";

  const snapshotError = snapshotMode ? snapshotState.error : null;
  const normalizedSession = useMemo(() => {
    if (!session) {
      return null;
    }
    return session;
  }, [session]);
  const editingHand =
    normalizedSession?.hands.find((hand) => hand.id === editingHandId) ?? null;
  const aggregate = useMemo(
    () => (normalizedSession ? buildSessionAggregate(normalizedSession) : null),
    [normalizedSession],
  );
  const sessionInfo = useMemo(() => {
    if (!normalizedSession) {
      return null;
    }
    const day = deriveSessionDay(normalizedSession);
    const label = normalizedSession.label?.trim() ?? "";
    return { day, label };
  }, [normalizedSession]);
  useEffect(() => {
    setSessionLabelDraft(normalizedSession?.label ?? "");
  }, [normalizedSession?.id, normalizedSession?.label]);
  useEffect(() => {
    if (normalizedSession) {
      setStoredPlayers(normalizedSession.players);
      setKnownPlayers((current) => mergeKnownPlayers(current, normalizedSession.players));
      setStoredPlayersLoaded(true);
    }
  }, [normalizedSession]);
  useEffect(() => {
    if (snapshotMode) {
      return;
    }
    void fetchStoredPlayers()
      .then(({ players, knownPlayers: fetchedKnownPlayers }) => {
        setStoredPlayers((current) => (current.length > 0 ? current : players));
        setKnownPlayers((current) => mergeKnownPlayers(current, fetchedKnownPlayers));
      })
      .catch(() => undefined)
      .finally(() => setStoredPlayersLoaded(true));
  }, [snapshotMode]);
  const defaultSeatIds = useMemo(() => {
    if (!normalizedSession) {
      return [];
    }
    const lastHand = normalizedSession.hands[normalizedSession.hands.length - 1];
    if (lastHand?.seats.length === 4) {
      return lastHand.seats.map((seat) => seat.playerId);
    }
    return normalizedSession.players.slice(0, 4).map((player) => player.id);
  }, [normalizedSession]);
  const [seatPlayerIds, setSeatPlayerIds] = useState<string[]>([]);
  const [displayRefreshActive, setDisplayRefreshActive] = useState(false);

  useEffect(() => {
    if (!normalizedSession) {
      setSeatPlayerIds([]);
      return;
    }
    setSeatPlayerIds((prev) => {
      const validIds = new Set(normalizedSession.players.map((player) => player.id));
      const filtered = prev.filter((id) => validIds.has(id));
      if (filtered.length === 4) {
        return filtered;
      }
      return defaultSeatIds;
    });
  }, [defaultSeatIds, normalizedSession]);

  useEffect(() => {
    if (!displayMode) {
      setDisplayRefreshActive(false);
      return;
    }
    if (DISPLAY_REFRESH_INTERVAL_SEC <= 0 || DISPLAY_REFRESH_DURATION_SEC <= 0) {
      setDisplayRefreshActive(false);
      return;
    }
    let timeoutId: number | null = null;
    const triggerRefresh = () => {
      setDisplayRefreshActive(true);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(
        () => setDisplayRefreshActive(false),
        DISPLAY_REFRESH_DURATION_SEC * 1000,
      );
    };
    const intervalId = window.setInterval(triggerRefresh, DISPLAY_REFRESH_INTERVAL_SEC * 1000);
    return () => {
      window.clearInterval(intervalId);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      setDisplayRefreshActive(false);
    };
  }, [displayMode]);

  const handleToggleSeat = (playerId: string) => {
    setSeatPlayerIds((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, playerId];
    });
  };
  // normalizedSession computed above for consistent usage
  useEffect(() => {
    if (snapshotMode) {
      return;
    }
    if (session && normalizedSession && normalizedSession !== session) {
      saveSession(normalizedSession);
    }
  }, [normalizedSession, saveSession, session, snapshotMode]);

  useEffect(() => {
    if (!snapshotMode) {
      return;
    }
    setSession(snapshotSession);
  }, [setSession, snapshotMode, snapshotSession]);

  const handleCreateSession = () => {
    if (!appConfigLoaded || !storedPlayersLoaded) {
      return;
    }
    saveSession(
      storedPlayers.length > 0
        ? createSessionWithPlayers(storedPlayers)
        : createSession(appConfig.defaultPlayerNames),
    );
  };

  const handleResetHands = () => {
    if (!session) {
      return;
    }
    const next = {
      ...session,
      id: createId(),
      createdAt: new Date().toISOString(),
      day: toJstDateString(new Date()),
      hands: [],
    };
    saveSession(next);
    setEditingHandId(null);
  };

  const handleFinalizeSession = async () => {
    if (!normalizedSession || meta?.version === undefined) return;
    try {
      adoptEnvelope(await finalizeStoredSession(normalizedSession.id, meta.version));
      setActivePanel(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "卓の確定に失敗しました。");
    }
  };

  const handleAddPlayer = (nameValue: string): boolean => {
    if (!normalizedSession || normalizedSession.players.length >= 6) {
      return false;
    }
    const name = nameValue.trim();
    const knownPlayer = findPlayerByName(knownPlayers, name);
    const player = knownPlayer ?? { id: createId(), name };
    if (
      normalizedSession.players.some(
        (current) =>
          current.id === player.id ||
          normalizePlayerName(current.name) === normalizePlayerName(player.name),
      )
    ) {
      return false;
    }
    const next = {
      ...normalizedSession,
      players: [...normalizedSession.players, player],
    };
    setKnownPlayers((current) => mergeKnownPlayers(current, [player]));
    saveSession(next);
    return true;
  };

  const handleReplacePlayer = (id: string, nameValue: string): boolean => {
    if (!normalizedSession) {
      return false;
    }
    const playerIndex = normalizedSession.players.findIndex((player) => player.id === id);
    if (playerIndex >= 0 && playerIndex < appConfig.fixedPlayerCount) {
      return false;
    }
    if (!canRemovePlayer(normalizedSession, id)) {
      return false;
    }
    const currentPlayer = normalizedSession.players[playerIndex];
    if (!currentPlayer) {
      return false;
    }
    const name = nameValue.trim();
    if (normalizePlayerName(currentPlayer.name) === normalizePlayerName(name)) {
      return true;
    }
    const knownPlayer = findPlayerByName(knownPlayers, name);
    const replacement = knownPlayer ?? { id: createId(), name };
    if (
      normalizedSession.players.some(
        (player) =>
          player.id !== id &&
          (player.id === replacement.id ||
            normalizePlayerName(player.name) === normalizePlayerName(replacement.name)),
      )
    ) {
      return false;
    }
    const next = {
      ...normalizedSession,
      players: normalizedSession.players.map((player) =>
        player.id === id ? replacement : player,
      ),
    };
    setKnownPlayers((current) => mergeKnownPlayers(current, [replacement]));
    saveSession(next);
    return true;
  };

  const handleRemovePlayer = (id: string) => {
    if (!normalizedSession) {
      return;
    }
    const playerIndex = normalizedSession.players.findIndex((player) => player.id === id);
    if (playerIndex >= 0 && playerIndex < appConfig.fixedPlayerCount) {
      return;
    }
    if (!canRemovePlayer(normalizedSession, id)) {
      return;
    }
    const next = {
      ...normalizedSession,
      players: normalizedSession.players.filter((player) => player.id !== id),
    };
    saveSession(next);
  };

  const handleUpdateSessionInfo = (next: { day?: string; label?: string }) => {
    if (!normalizedSession) {
      return;
    }
    saveSession({ ...normalizedSession, ...next });
  };

  const handleSaveHand = (seats: HandSeat[], editingId?: string) => {
    if (!normalizedSession) {
      return;
    }
    const now = new Date().toISOString();
    const nextHand: Hand = {
      id: editingId ?? createId(),
      createdAt: editingId
        ? normalizedSession.hands.find((hand) => hand.id === editingId)?.createdAt ?? now
        : now,
      seats,
    };
    const nextHands = editingId
      ? updateHand(normalizedSession.hands, nextHand)
      : [...normalizedSession.hands, nextHand];
    const next = { ...normalizedSession, hands: nextHands };
    saveSession(next);
    setEditingHandId(null);
  };

  const handleDeleteHand = (handId: string) => {
    if (!normalizedSession) {
      return;
    }
    const next = { ...normalizedSession, hands: removeHand(normalizedSession.hands, handId) };
    saveSession(next);
    if (editingHandId === handId) {
      setEditingHandId(null);
    }
  };

  const handleTogglePanel =
    (panel: ActivePanel) =>
    (event: MouseEvent<HTMLElement>) => {
      lastTriggerRef.current = event.currentTarget;
      setActivePanel((prev) => (prev === panel ? null : panel));
    };

  const showPanels = !snapshotError;
  const panelTitleId = activePanel ? `panel-title-${activePanel}` : "panel-title";

  useEffect(() => {
    if (!activePanel) {
      if (lastTriggerRef.current) {
        lastTriggerRef.current.focus();
      }
      return;
    }
    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const getFocusable = (): HTMLElement[] =>
      modalRef.current
        ? Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        : [];
    const focusable = getFocusable();
    const first = closeButtonRef.current ?? focusable[0] ?? null;
    first?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setActivePanel(null);
        return;
      }
      const currentFocusable = getFocusable();
      if (event.key !== "Tab" || currentFocusable.length === 0) {
        return;
      }
      const current = document.activeElement as HTMLElement | null;
      const firstEl = currentFocusable[0];
      const lastEl = currentFocusable[currentFocusable.length - 1];
      if (!firstEl || !lastEl) {
        return;
      }
      if (event.shiftKey) {
        if (current === firstEl || !modalRef.current?.contains(current)) {
          event.preventDefault();
          lastEl.focus();
        }
      } else if (current === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activePanel]);

  return (
    <div
      className={`max-w-[100vw] overflow-x-hidden text-slate-900 ${
        displayMode ? "h-screen overflow-hidden px-6 py-6" : "min-h-screen px-4 pb-32 pt-10 md:px-10"
      }`}
    >
      <div
        className={`mx-auto flex min-w-0 flex-col ${
          displayMode ? "h-full max-w-none gap-4" : "max-w-6xl gap-6"
        }`}
      >
        <header className={displayMode ? "space-y-2" : "space-y-4"}>
          {!displayMode ? (
            <div>
              <h1 className="font-display text-3xl md:text-4xl">
                麻雀スコア管理
                {sessionInfo ? (
                  <span className="ml-2 text-base font-normal text-slate-500">
                    ({sessionInfo.day}
                    {sessionInfo.label ? ` / ${sessionInfo.label}` : ""})
                  </span>
                ) : null}
              </h1>
            </div>
          ) : null}
          {!displayMode ? <div className="glow-divider h-px w-full" /> : null}
          <SyncStatus
            syncState={syncState}
            lastError={lastError}
            meta={meta}
            displayMode={displayMode}
            snapshotMode={snapshotMode}
            snapshotError={snapshotError}
            hasConflict={Boolean(conflictEnvelope)}
            onRetrySync={retrySync}
            onAcceptRemoteConflict={acceptRemoteConflict}
            onOverwriteRemoteConflict={overwriteRemoteConflict}
          />
        </header>
        {displayMode ? (
          <div className="pointer-events-none fixed right-4 top-4 z-40">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm">
              {inviteUrl ? <div className="text-right text-xs text-slate-500">{inviteUrl}</div> : null}
              {inviteImageSrc ? (
                <img
                  src={inviteImageSrc}
                  alt="参加者アクセスQR"
                  className="h-20 w-20 rounded-md border border-slate-200 bg-white"
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {snapshotError ? (
          <div className="card p-6 text-sm text-rose-500">
            共有リンクの形式が不正です。URLを確認してください。
          </div>
        ) : !normalizedSession ? (
          <div className="card p-6 text-sm text-slate-400">
            卓を開始するとプレイヤー登録と半荘入力ができます。
          </div>
        ) : null}

        {showPanels ? (
          <>
            <div
              className={`grid gap-6 ${
                displayMode ? "grid-cols-[0.9fr_1.1fr]" : "lg:grid-cols-[0.9fr_1.1fr]"
              }`}
            >
              <GraphPanel
                players={normalizedSession?.players ?? []}
                aggregate={aggregate}
                displayMode={displayMode}
              />
              <SummaryPanel
                aggregate={aggregate}
                session={normalizedSession}
                displayMode={displayMode}
                hideTrendColumns={snapshotMode}
              />
            </div>

            {displayMode && normalizedSession ? (
              <DisplayInsights session={normalizedSession} seatPlayerIds={seatPlayerIds} />
            ) : null}

            {!displayMode ? (
              normalizedSession ? (
                <HandHistory
                  players={normalizedSession.players}
                  hands={normalizedSession.hands}
                  onEdit={(handId) => setEditingHandId(handId)}
                  onDelete={handleDeleteHand}
                  readOnly={displayMode || snapshotMode}
                  showRecentOnly={displayMode}
                />
              ) : (
                <div className="card p-6 text-sm text-slate-400">
                  卓を開始すると半荘履歴が表示されます。
                </div>
              )
            ) : null}
          </>
        ) : null}
      </div>
      {!displayMode && !snapshotMode ? (
        <>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-10">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    activePanel === "handInput"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={handleTogglePanel("handInput")}
                >
                  半荘入力
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    activePanel === "reverse"
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={handleTogglePanel("reverse")}
                >
                  逆転条件
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    activePanel === "scoreTable"
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={handleTogglePanel("scoreTable")}
                >
                  点数表
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    activePanel === "history"
                      ? "bg-sky-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={handleTogglePanel("history")}
                >
                  結果履歴
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    activePanel === "analytics"
                      ? "bg-violet-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={handleTogglePanel("analytics")}
                >
                  成績分析
                </button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    activePanel === "controls"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={handleTogglePanel("controls")}
                >
                  卓管理
                </button>
              </div>
            </div>
          </div>
          {activePanel ? (
            <div className="fixed inset-0 z-40">
              <button
                type="button"
                className="absolute inset-0 h-full w-full cursor-default bg-slate-900/30 backdrop-blur-sm"
                onClick={() => setActivePanel(null)}
                aria-label="close overlay"
                tabIndex={-1}
                aria-hidden="true"
              />
              <div className="absolute inset-x-0 top-16 mx-auto w-full max-w-5xl px-4 md:px-10">
                <div
                  ref={modalRef}
                  className="card max-h-[85vh] overflow-auto p-0"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={panelTitleId}
                >
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:px-6">
                    <div className="flex items-center justify-between">
                      <h3 id={panelTitleId} className="font-display text-lg text-slate-900">
                        {activePanel === "controls"
                          ? "卓管理"
                          : activePanel === "analytics"
                            ? "成績分析"
                            : activePanel === "handInput"
                              ? "半荘入力"
                              : activePanel === "history"
                                ? "結果履歴"
                                : activePanel === "scoreTable"
                                  ? "点数表"
                                  : "逆転条件"}
                      </h3>
                      <button
                        type="button"
                        className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                        onClick={() => setActivePanel(null)}
                        ref={closeButtonRef}
                      >
                        閉じる
                      </button>
                    </div>
                  </div>
                  <div className="space-y-5 bg-white px-5 py-4 md:px-6 md:py-5">
                    {activePanel === "controls" ? (
                      <>
                        {normalizedSession ? (
                          <PlayerManager
                            players={normalizedSession.players}
                            knownPlayers={knownPlayers}
                            hands={normalizedSession.hands}
                            fixedPlayerCount={appConfig.fixedPlayerCount}
                            onAdd={handleAddPlayer}
                            onReplace={handleReplacePlayer}
                            onRemove={handleRemovePlayer}
                          />
                        ) : (
                          <div className="card p-6 text-sm text-slate-500">
                            卓を開始するとプレイヤー管理が有効になります。
                          </div>
                        )}
                        <SessionControls
                          hasSession={Boolean(normalizedSession)}
                          canFinalize={Boolean(normalizedSession?.hands.length)}
                          createDisabled={!appConfigLoaded || !storedPlayersLoaded}
                          onCreate={handleCreateSession}
                          onFinalize={() => void handleFinalizeSession()}
                          onResetHands={handleResetHands}
                        />
                        {normalizedSession ? (
                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4">
                            <div className="text-sm font-semibold text-slate-800">卓情報</div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="space-y-1 text-xs text-slate-500">
                                日付
                                <input
                                  type="date"
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-700"
                                  value={sessionInfo?.day ?? ""}
                                  onChange={(event) =>
                                    handleUpdateSessionInfo({
                                      day: event.target.value || undefined,
                                    })
                                  }
                                />
                              </label>
                              <label className="space-y-1 text-xs text-slate-500">
                                ラベル
                                <input
                                  type="text"
                                  placeholder="例: 夜 / 自宅 / 第2部"
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-700"
                                  value={sessionLabelDraft}
                                  onChange={(event) => setSessionLabelDraft(event.target.value)}
                                  onBlur={() => {
                                    const label = sessionLabelDraft.trim();
                                    setSessionLabelDraft(label);
                                    if (label !== (normalizedSession.label ?? "")) {
                                      handleUpdateSessionInfo({ label: label || undefined });
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        ) : null}
                        <SnapshotShare session={normalizedSession} />
                      </>
                    ) : null}
                    {activePanel === "handInput" ? (
                      normalizedSession ? (
                        <HandForm
                          session={normalizedSession}
                          editingHand={editingHand}
                          onSave={(seats, editingId) => {
                            handleSaveHand(seats, editingId);
                            if (!editingId) {
                              setActivePanel(null);
                            }
                          }}
                          onCancelEdit={() => setEditingHandId(null)}
                        />
                      ) : (
                        <div className="card p-6 text-sm text-slate-500">
                          卓を開始してから半荘入力を行えます。
                        </div>
                      )
                    ) : null}
                    {activePanel === "reverse" ? (
                      <ReverseCondition
                        players={normalizedSession?.players ?? []}
                        seatPlayerIds={seatPlayerIds}
                        onToggleSeat={handleToggleSeat}
                        session={normalizedSession}
                        aggregate={aggregate}
                        note="同点パターンの列挙は未対応です。"
                      />
                    ) : null}
                    {activePanel === "scoreTable" ? (
                      <ScoreTable
                        initialMode={window.location.hash === "#fu-table" ? "fu" : "child"}
                      />
                    ) : null}
                    {activePanel === "history" ? (
                      <SessionHistory
                        currentSessionId={normalizedSession?.id ?? null}
                        currentVersion={meta?.version ?? null}
                        onEnvelope={adoptEnvelope}
                        onReopened={() => setActivePanel(null)}
                      />
                    ) : null}
                    {activePanel === "analytics" ? <AnalyticsDashboard /> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {displayMode ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed inset-0 z-50 bg-black transition-opacity duration-700 ${
            displayRefreshActive ? "opacity-95" : "opacity-0"
          }`}
        />
      ) : null}
    </div>
  );
};

const App = () => {
  if (window.location.pathname.replace(/\/$/, "") === "/fu") {
    return <SimpleFuPage />;
  }

  return <ScoreApp />;
};

export default App;
