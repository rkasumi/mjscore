import { useEffect, useMemo, useState } from "react";

import type { Hand, HandSeat, Session } from "../shared/types";
import { GraphPanel } from "./components/GraphPanel";
import { HandForm } from "./components/HandForm";
import { HandHistory } from "./components/HandHistory";
import { PlayerManager } from "./components/PlayerManager";
import { ReverseCondition } from "./components/ReverseCondition";
import { SessionControls } from "./components/SessionControls";
import { SummaryPanel } from "./components/SummaryPanel";
import { SyncStatus } from "./components/SyncStatus";
import { buildSessionAggregate } from "./lib/aggregation";
import { createId } from "./lib/id";
import { useSessionStore } from "./lib/useSessionStore";

const FIXED_NAMES = ["プレイヤー1", "プレイヤー2"] as const;

const createSession = (): Session => ({
  id: createId(),
  createdAt: new Date().toISOString(),
  players: FIXED_NAMES.map((name) => ({ id: createId(), name })),
  hands: [],
});

const ensureFixedPlayers = (session: Session): Session => {
  const nextPlayers = [...session.players];
  let changed = false;

  FIXED_NAMES.forEach((name, index) => {
    const player = nextPlayers[index];
    if (!player) {
      nextPlayers.splice(index, 0, { id: createId(), name });
      changed = true;
      return;
    }
    if (player.name !== name) {
      nextPlayers[index] = { ...player, name };
      changed = true;
    }
  });

  return changed ? { ...session, players: nextPlayers } : session;
};

const isFixedIndex = (index: number): boolean => index < FIXED_NAMES.length;

const updateHand = (hands: Hand[], nextHand: Hand): Hand[] =>
  hands.map((hand) => (hand.id === nextHand.id ? nextHand : hand));

const removeHand = (hands: Hand[], handId: string): Hand[] =>
  hands.filter((hand) => hand.id !== handId);

const canRemovePlayer = (session: Session, playerId: string): boolean =>
  !session.hands.some((hand) => hand.seats.some((seat) => seat.playerId === playerId));

const App = () => {
  const { session, saveSession, syncState, lastError, meta } = useSessionStore();
  const [editingHandId, setEditingHandId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"controls" | "handInput" | "reverse" | null>(
    null,
  );

  const normalizedSession = useMemo(
    () => (session ? ensureFixedPlayers(session) : null),
    [session],
  );
  const editingHand =
    normalizedSession?.hands.find((hand) => hand.id === editingHandId) ?? null;
  const aggregate = useMemo(
    () => (normalizedSession ? buildSessionAggregate(normalizedSession) : null),
    [normalizedSession],
  );

  // normalizedSession computed above for consistent usage
  useEffect(() => {
    if (session && normalizedSession && normalizedSession !== session) {
      saveSession(normalizedSession);
    }
  }, [normalizedSession, saveSession, session]);

  const handleCreateSession = () => {
    saveSession(createSession());
  };

  const handleResetHands = () => {
    if (!session) {
      return;
    }
    const next = { ...session, id: createId(), createdAt: new Date().toISOString(), hands: [] };
    saveSession(next);
    setEditingHandId(null);
  };

  const handleAddPlayer = (name: string) => {
    if (!normalizedSession || normalizedSession.players.length >= 6) {
      return;
    }
    const next = {
      ...normalizedSession,
      players: [...normalizedSession.players, { id: createId(), name }],
    };
    saveSession(next);
  };

  const handleRenamePlayer = (id: string, name: string) => {
    if (!normalizedSession) {
      return;
    }
    const index = normalizedSession.players.findIndex((player) => player.id === id);
    if (index !== -1 && isFixedIndex(index)) {
      return;
    }
    const next = {
      ...normalizedSession,
      players: normalizedSession.players.map((player) =>
        player.id === id ? { ...player, name } : player,
      ),
    };
    saveSession(next);
  };

  const handleRemovePlayer = (id: string) => {
    if (!normalizedSession) {
      return;
    }
    const index = normalizedSession.players.findIndex((player) => player.id === id);
    if (index !== -1 && isFixedIndex(index)) {
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

  return (
    <div className="min-h-screen px-4 pb-32 pt-10 text-slate-900 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="space-y-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl">麻雀スコア管理</h1>
          </div>
          <div className="glow-divider h-px w-full" />
          <SyncStatus syncState={syncState} lastError={lastError} meta={meta} />
        </header>

        {!normalizedSession ? (
          <div className="card p-6 text-sm text-slate-400">
            卓を開始するとプレイヤー登録と半荘入力ができます。
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <GraphPanel players={normalizedSession?.players ?? []} aggregate={aggregate} />
          <SummaryPanel aggregate={aggregate} session={normalizedSession} />
        </div>

        {normalizedSession ? (
          <HandHistory
            players={normalizedSession.players}
            hands={normalizedSession.hands}
            onEdit={(handId) => setEditingHandId(handId)}
            onDelete={handleDeleteHand}
          />
        ) : (
          <div className="card p-6 text-sm text-slate-400">
            卓を開始すると半荘履歴が表示されます。
          </div>
        )}
      </div>
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
              onClick={() =>
                setActivePanel((prev) => (prev === "handInput" ? null : "handInput"))
              }
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
              onClick={() =>
                setActivePanel((prev) => (prev === "reverse" ? null : "reverse"))
              }
            >
              逆転条件
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
              onClick={() =>
                setActivePanel((prev) => (prev === "controls" ? null : "controls"))
              }
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
          />
          <div className="absolute inset-x-0 bottom-16 mx-auto w-full max-w-5xl px-4 md:px-10">
            <div className="card max-h-[75vh] overflow-auto p-0">
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:px-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg text-slate-900">
                    {activePanel === "controls"
                      ? "卓管理"
                      : activePanel === "handInput"
                        ? "半荘入力"
                        : "逆転条件"}
                  </h3>
                  <button
                    type="button"
                    className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                    onClick={() => setActivePanel(null)}
                  >
                    閉じる
                  </button>
                </div>
              </div>
              <div className="space-y-5 px-5 py-4 md:px-6 md:py-5">
                {activePanel === "controls" ? (
                  <>
                    {normalizedSession ? (
                      <PlayerManager
                        players={normalizedSession.players}
                        hands={normalizedSession.hands}
                        onAdd={handleAddPlayer}
                        onRename={handleRenamePlayer}
                        onRemove={handleRemovePlayer}
                      />
                    ) : (
                      <div className="card p-6 text-sm text-slate-500">
                        卓を開始するとプレイヤー管理が有効になります。
                      </div>
                    )}
                    <SessionControls
                      hasSession={Boolean(normalizedSession)}
                      onCreate={handleCreateSession}
                      onResetHands={handleResetHands}
                    />
                  </>
                ) : null}
                {activePanel === "handInput" ? (
                  normalizedSession ? (
                    <HandForm
                      players={normalizedSession.players}
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
                  <ReverseCondition note="計算ロジックはlibに追加予定です。" />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default App;
