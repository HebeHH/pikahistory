"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import PikaSprite from "@/components/history-wall/pika-sprite";
import type {
  HistoryWallData,
  HistoryWallRecord,
} from "@/contracts/history-wall.types";
import {
  WallCredentialSchema,
  WallRealtimeDescriptorSchema,
  type WallCamera,
  type WallCredential,
  type WallPresenceData,
  type WallRealtimeDescriptor,
  type WallRoomSnapshot,
  type WallScreen as SessionScreen,
} from "@/contracts/wall-session.schema";
import {
  lerpCamera,
  type WallCamera as RenderCamera,
} from "@/lib/wall/camera";
import type { WallScreen as LayoutScreen } from "@/lib/wall/screen-layout";
import {
  connectWallRealtime,
  createWallRoom,
  joinWallRoom,
  measureWallViewport,
  persistWallCamera,
  recoverWallRoom,
  updateWallScreen,
  WallSessionClientError,
  type WallRealtimeConnection,
} from "@/lib/wall/session-client";

import FixedTimeRuler from "./fixed-time-ruler";
import MultiScreenWorld from "./multi-screen-world";
import ScreenViewport from "./screen-viewport";
import WallRecordPanel from "./wall-record-panel";

const STORAGE_KEY = "pika-history:active-wall-session";
const CAMERA_PUBLISH_INTERVAL_MS = 40;
const CAMERA_PERSIST_DELAY_MS = 260;

type StoredIdentity = {
  roomCode: string;
  credential: WallCredential;
  realtime: WallRealtimeDescriptor;
};

function allRecords(data: HistoryWallData): HistoryWallRecord[] {
  return [
    ...data.civilizations,
    ...data.people,
    ...data.events,
    ...data.eras,
  ];
}

function toLayoutScreen(
  screen: SessionScreen,
  activeScreenIds: Set<string>,
): LayoutScreen {
  return {
    id: screen.id,
    order: screen.screenOrder,
    viewportWidth: screen.viewport.width,
    viewportHeight: screen.viewport.height,
    devicePixelRatio: screen.viewport.devicePixelRatio,
    connected: activeScreenIds.has(screen.id),
  };
}

function mergeScreen(room: WallRoomSnapshot, screen: SessionScreen) {
  const exists = room.screens.some((candidate) => candidate.id === screen.id);
  return {
    ...room,
    screens: exists
      ? room.screens.map((candidate) =>
          candidate.id === screen.id ? screen : candidate,
        )
      : [...room.screens, screen],
  };
}

function readStoredIdentity(): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Record<string, unknown>;
    const credential = WallCredentialSchema.safeParse(candidate.credential);
    const realtime = WallRealtimeDescriptorSchema.safeParse(candidate.realtime);
    if (
      typeof candidate.roomCode !== "string" ||
      !credential.success ||
      !realtime.success
    ) {
      return null;
    }
    return {
      roomCode: candidate.roomCode,
      credential: credential.data,
      realtime: realtime.data,
    };
  } catch {
    return null;
  }
}

function saveIdentity(identity: StoredIdentity) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

function errorMessage(error: unknown) {
  if (error instanceof WallSessionClientError) {
    if (error.code === "realtime_not_configured") {
      return "Realtime is not configured yet. Add ABLY_API_KEY on the server.";
    }
    if (error.code === "room_expired") {
      return "That wall session has expired. Create a fresh room.";
    }
    if (error.code === "screen_order_taken") {
      return "That laptop position is already occupied. Choose another position.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function WallSessionApp({ data }: { data: HistoryWallData }) {
  const records = useMemo(() => allRecords(data), [data]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [room, setRoom] = useState<WallRoomSnapshot | null>(null);
  const [camera, setCamera] = useState<WallCamera | null>(null);
  const [activeScreenIds, setActiveScreenIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [connectionState, setConnectionState] = useState("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinPosition, setJoinPosition] = useState(2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<WallRoomSnapshot | null>(null);
  const cameraRef = useRef<WallCamera | null>(null);
  const targetCameraRef = useRef<WallCamera | null>(null);
  const realtimeRef = useRef<WallRealtimeConnection | null>(null);
  const pendingPublishRef = useRef<WallCamera | null>(null);
  const publishTimerRef = useRef<number | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const lastViewportRef = useRef("");

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    cameraRef.current = camera;
    if (camera && !targetCameraRef.current) targetCameraRef.current = camera;
  }, [camera]);

  const activate = useCallback(
    (nextIdentity: StoredIdentity, nextRoom: WallRoomSnapshot) => {
      saveIdentity(nextIdentity);
      setIdentity(nextIdentity);
      setRoom(nextRoom);
      roomRef.current = nextRoom;
      setCamera(nextRoom.camera);
      cameraRef.current = nextRoom.camera;
      targetCameraRef.current = nextRoom.camera;
      setError(null);
    },
    [],
  );

  useEffect(() => {
    const stored = readStoredIdentity();
    if (!stored) {
      localStorage.removeItem(STORAGE_KEY);
      const timer = window.setTimeout(() => setCheckingSession(false), 0);
      return () => window.clearTimeout(timer);
    }

    recoverWallRoom(stored.roomCode, stored.credential.token)
      .then((snapshot) => activate(stored, snapshot))
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setCheckingSession(false));
  }, [activate]);

  const refreshPresence = useCallback(async (connection: WallRealtimeConnection) => {
    const presence = await connection.getPresence();
    const active = new Set(presence.map((member) => member.screenId));
    setActiveScreenIds(active);
    setRoom((current) => {
      if (!current) return current;
      let next = current;
      for (const member of presence) {
        const existing = next.screens.find(
          (candidate) => candidate.id === member.screenId,
        );
        const screen: SessionScreen = {
          id: member.screenId,
          role: member.role,
          screenOrder: member.screenOrder,
          viewport: member.viewport,
          lastSeenAt: existing?.lastSeenAt ?? new Date().toISOString(),
        };
        next = mergeScreen(next, screen);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!identity) return;

    const connection = connectWallRealtime(
      identity.realtime,
      identity.credential,
    );
    realtimeRef.current = connection;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const markConnected = () => setConnectionState("connected");
    const markDisconnected = () => setConnectionState("reconnecting");
    const markFailed = () => {
      setConnectionState("failed");
      setError(
        "Realtime connection failed. Check ABLY_API_KEY and reconnect this laptop.",
      );
    };
    connection.client.connection.on("connected", markConnected);
    connection.client.connection.on("disconnected", markDisconnected);
    connection.client.connection.on("suspended", markDisconnected);
    connection.client.connection.on("failed", markFailed);

    const start = async () => {
      const unsubscribeCamera = await connection.subscribeToCamera((incoming) => {
        const target = targetCameraRef.current;
        if (!target || incoming.revision > target.revision) {
          targetCameraRef.current = incoming;
        }
      });
      cleanups.push(unsubscribeCamera);

      const unsubscribeScreens = await connection.subscribeToScreenUpdates(
        (screen) => setRoom((current) => (current ? mergeScreen(current, screen) : current)),
      );
      cleanups.push(unsubscribeScreens);

      const unsubscribePresence = await connection.subscribeToPresence(() => {
        void refreshPresence(connection).catch((cause) => {
          if (!cancelled) setError(errorMessage(cause));
        });
      });
      cleanups.push(unsubscribePresence);

      const currentRoom = roomRef.current;
      const localScreen = currentRoom?.screens.find(
        (screen) => screen.id === identity.credential.screenId,
      );
      if (localScreen) {
        const presence: WallPresenceData = {
          screenId: localScreen.id,
          role: localScreen.role,
          screenOrder: localScreen.screenOrder,
          viewport: localScreen.viewport,
        };
        await connection.enterPresence(presence);
      }
      await refreshPresence(connection);
    };

    start().catch((cause) => {
      if (!cancelled) {
        setConnectionState("failed");
        setError(errorMessage(cause));
      }
    });

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
      connection.client.connection.off("connected", markConnected);
      connection.client.connection.off("disconnected", markDisconnected);
      connection.client.connection.off("suspended", markDisconnected);
      connection.client.connection.off("failed", markFailed);
      connection.close();
      if (realtimeRef.current === connection) realtimeRef.current = null;
    };
  }, [identity, refreshPresence]);

  useEffect(() => {
    if (identity?.credential.role !== "display") return;
    let frame = 0;

    const tick = () => {
      const target = targetCameraRef.current;
      setCamera((current) => {
        if (!current || !target || current.revision > target.revision) return current;
        const settled =
          Math.abs(current.x - target.x) < 0.02 &&
          Math.abs(current.y - target.y) < 0.02 &&
          Math.abs(current.zoom - target.zoom) < 0.0001;
        if (settled) return target;
        const next = lerpCamera(current, target, 0.24);
        return { ...next, updatedAt: target.updatedAt };
      });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [identity?.credential.role]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !identity) return;

    const report = () => {
      const viewport = {
        width: Math.max(240, Math.round(node.clientWidth)),
        height: Math.max(200, Math.round(node.clientHeight)),
        devicePixelRatio: window.devicePixelRatio || 1,
      };
      setViewportWidth(viewport.width);
      const signature = JSON.stringify(viewport);
      if (signature === lastViewportRef.current) return;
      lastViewportRef.current = signature;

      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
      }
      resizeTimerRef.current = window.setTimeout(() => {
        updateWallScreen(
          identity.roomCode,
          identity.credential.screenId,
          identity.credential.token,
          { viewport },
        )
          .then(async (result) => {
            setRoom(result.room);
            const connection = realtimeRef.current;
            if (!connection) return;
            await connection.updatePresence({
              screenId: result.screen.id,
              role: result.screen.role,
              screenOrder: result.screen.screenOrder,
              viewport: result.screen.viewport,
            });
            if (identity.credential.role === "controller") {
              await connection.publishScreenUpdate(result.screen);
            }
          })
          .catch((cause) => setError(errorMessage(cause)));
      }, 220);
    };

    const observer = new ResizeObserver(report);
    observer.observe(node);
    report();
    return () => {
      observer.disconnect();
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
      }
    };
  }, [identity]);

  useEffect(
    () => () => {
      if (publishTimerRef.current !== null) {
        window.clearTimeout(publishTimerRef.current);
      }
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    },
    [],
  );

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const bootstrap = await createWallRoom({
        viewport: measureWallViewport(),
        screenOrder: 0,
        initialCamera: { x: -1000, y: 0, zoom: 0.5 },
      });
      activate(
        {
          roomCode: bootstrap.room.roomCode,
          credential: bootstrap.credential,
          realtime: bootstrap.realtime,
        },
        bootstrap.room,
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setBusy(true);
    setError(null);
    try {
      const bootstrap = await joinWallRoom(joinCode.trim().toUpperCase(), {
        viewport: measureWallViewport(),
        screenOrder: Math.max(0, joinPosition - 1),
      });
      activate(
        {
          roomCode: bootstrap.room.roomCode,
          credential: bootstrap.credential,
          realtime: bootstrap.realtime,
        },
        bootstrap.room,
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const handleCameraChange = useCallback(
    (next: RenderCamera) => {
      if (!identity || identity.credential.role !== "controller") return;
      const shared: WallCamera = {
        ...next,
        updatedBy: identity.credential.screenId,
        updatedAt: new Date().toISOString(),
      };
      cameraRef.current = shared;
      targetCameraRef.current = shared;
      setCamera(shared);
      pendingPublishRef.current = shared;

      if (publishTimerRef.current === null) {
        publishTimerRef.current = window.setTimeout(() => {
          publishTimerRef.current = null;
          const pending = pendingPublishRef.current;
          if (!pending) return;
          pendingPublishRef.current = null;
          realtimeRef.current?.publishCamera(pending).catch((cause) => {
            setError(errorMessage(cause));
          });
        }, CAMERA_PUBLISH_INTERVAL_MS);
      }

      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(() => {
        const latest = cameraRef.current;
        if (!latest) return;
        persistWallCamera(identity.roomCode, identity.credential.token, {
          x: latest.x,
          y: latest.y,
          zoom: latest.zoom,
          revision: latest.revision,
        }).catch((cause) => setError(errorMessage(cause)));
      }, CAMERA_PERSIST_DELAY_MS);
    },
    [identity],
  );

  const leaveRoom = () => {
    localStorage.removeItem(STORAGE_KEY);
    if (publishTimerRef.current !== null) {
      window.clearTimeout(publishTimerRef.current);
      publishTimerRef.current = null;
    }
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    pendingPublishRef.current = null;
    setIdentity(null);
    setRoom(null);
    setCamera(null);
    setActiveScreenIds(new Set());
    setSelectedId(null);
    setConnectionState("disconnected");
    setError(null);
    lastViewportRef.current = "";
  };

  if (checkingSession) {
    return <LoadingWall label="Reconnecting your history wall…" />;
  }

  if (!identity || !room || !camera) {
    return (
      <WallLobby
        busy={busy}
        error={error}
        joinCode={joinCode}
        joinPosition={joinPosition}
        onCreate={handleCreate}
        onJoin={handleJoin}
        onJoinCodeChange={setJoinCode}
        onJoinPositionChange={setJoinPosition}
      />
    );
  }

  const layoutScreens = room.screens.map((screen) =>
    toLayoutScreen(screen, activeScreenIds),
  );
  const localScreen = layoutScreens.find(
    (screen) => screen.id === identity.credential.screenId,
  );
  const localSessionScreen = room.screens.find(
    (screen) => screen.id === identity.credential.screenId,
  );
  const canNavigate =
    identity.credential.role === "controller" &&
    identity.credential.screenId === room.ownerScreenId;
  const controllerConnected = activeScreenIds.has(room.ownerScreenId);
  const selected = records.find((record) => record.id === selectedId) ?? null;

  if (!localScreen || !localSessionScreen) {
    return <LoadingWall label="Registering this screen…" />;
  }

  return (
    <main
      style={{
        background: "var(--app-bg)",
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <WallSessionHeader
        activeScreenIds={activeScreenIds}
        canNavigate={canNavigate}
        connectionState={connectionState}
        identity={identity}
        onLeave={leaveRoom}
        room={room}
      />

      {error ? (
        <div
          role="alert"
          style={{
            background: "#fff1df",
            borderBottom: "1px solid #e4c896",
            color: "#76501d",
            fontSize: 12,
            padding: "8px 18px",
            zIndex: 50,
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{ float: "right", fontWeight: 700 }}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div ref={viewportRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <ScreenViewport
          camera={camera}
          canNavigate={canNavigate}
          localScreen={localScreen}
          onCameraChange={handleCameraChange}
          screens={layoutScreens}
        >
          <MultiScreenWorld
            activeId={selectedId}
            data={data}
            onSelect={setSelectedId}
          />
        </ScreenViewport>

        <div
          className="font-mono"
          style={{
            background: canNavigate ? "var(--accent)" : "rgba(251,248,240,.9)",
            border: "1px solid var(--line-4)",
            borderRadius: 999,
            color: canNavigate ? "var(--text)" : "var(--muted)",
            fontSize: 9,
            left: 12,
            letterSpacing: ".12em",
            padding: "5px 9px",
            pointerEvents: "none",
            position: "absolute",
            top: 10,
            zIndex: 24,
          }}
        >
          {canNavigate ? "CONTROLLER" : "FOLLOWER"} · SCREEN{" "}
          {localSessionScreen.screenOrder + 1}
        </div>

        {!controllerConnected && !canNavigate ? (
          <div
            className="font-mono"
            style={{
              background: "rgba(43,38,32,.86)",
              borderRadius: 10,
              color: "white",
              fontSize: 11,
              left: "50%",
              padding: "9px 14px",
              position: "absolute",
              top: 12,
              transform: "translateX(-50%)",
              zIndex: 30,
            }}
          >
            Controller disconnected · wall position frozen
          </div>
        ) : null}

        <FixedTimeRuler
          camera={camera}
          localScreen={localScreen}
          screens={layoutScreens}
          viewportWidth={viewportWidth || localScreen.viewportWidth}
        />

        {selected ? (
          <WallRecordPanel onClose={() => setSelectedId(null)} record={selected} />
        ) : null}
      </div>
    </main>
  );
}

function LoadingWall({ label }: { label: string }) {
  return (
    <main
      style={{
        alignItems: "center",
        background: "var(--app-bg)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: "100dvh",
        justifyContent: "center",
      }}
    >
      <span className="pika-bob">
        <PikaSprite mood="spark" size={72} />
      </span>
      <div className="font-mono" style={{ color: "var(--muted)", fontSize: 12 }}>
        {label}
      </div>
    </main>
  );
}

function WallLobby({
  busy,
  error,
  joinCode,
  joinPosition,
  onCreate,
  onJoin,
  onJoinCodeChange,
  onJoinPositionChange,
}: {
  busy: boolean;
  error: string | null;
  joinCode: string;
  joinPosition: number;
  onCreate: () => void;
  onJoin: () => void;
  onJoinCodeChange: (value: string) => void;
  onJoinPositionChange: (value: number) => void;
}) {
  return (
    <main
      style={{
        background:
          "radial-gradient(circle at 50% 15%, rgba(232,169,12,.16), transparent 34%), var(--app-bg)",
        minHeight: "100dvh",
        padding: "28px 20px 56px",
      }}
    >
      <div style={{ margin: "0 auto", maxWidth: 920 }}>
        <div className="flex items-center justify-between">
          <Link
            className="font-mono flex items-center gap-1"
            href="/"
            style={{ color: "var(--muted)", fontSize: 11 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
              arrow_back
            </span>
            Main history wall
          </Link>
          <div className="font-mono" style={{ color: "var(--faint)", fontSize: 9 }}>
            MULTI-SCREEN MODE
          </div>
        </div>

        <div style={{ margin: "48px auto 34px", maxWidth: 650, textAlign: "center" }}>
          <span className="pika-bob" style={{ display: "inline-block" }}>
            <PikaSprite mood="spark" size={84} />
          </span>
          <h1 className="font-serif" style={{ fontSize: 46, lineHeight: 1, margin: "12px 0" }}>
            Build one enormous history wall
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            Line up your laptops left-to-right. One person controls the shared
            canvas; everyone can open local historical details.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            style={{
              background: "#fff1df",
              border: "1px solid #e4c896",
              borderRadius: 10,
              color: "#76501d",
              fontSize: 12,
              margin: "0 auto 16px",
              maxWidth: 720,
              padding: "10px 14px",
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          }}
        >
          <section
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line-4)",
              borderRadius: 18,
              boxShadow: "0 12px 32px rgba(43,38,32,.09)",
              padding: 26,
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                background: "#f5e5a9",
                borderRadius: "50%",
                height: 48,
                marginBottom: 18,
                width: 48,
              }}
            >
              <span className="material-symbols-outlined filled" style={{ color: "var(--accent-deep)" }}>
                bolt
              </span>
            </div>
            <div className="font-mono" style={{ color: "var(--faint)", fontSize: 9, letterSpacing: ".18em" }}>
              LAPTOP 1 · CONTROLLER
            </div>
            <h2 className="font-serif" style={{ fontSize: 27, margin: "6px 0 10px" }}>
              Start a wall
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginBottom: 22 }}>
              Creates the room code. This laptop becomes the only one that can pan
              and zoom.
            </p>
            <button
              disabled={busy}
              onClick={onCreate}
              style={{
                background: "var(--accent)",
                borderRadius: 999,
                color: "var(--text)",
                cursor: busy ? "wait" : "pointer",
                fontWeight: 700,
                padding: "11px 18px",
                width: "100%",
              }}
              type="button"
            >
              {busy ? "Creating room…" : "Create room code"}
            </button>
          </section>

          <section
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line-4)",
              borderRadius: 18,
              boxShadow: "0 12px 32px rgba(43,38,32,.09)",
              padding: 26,
            }}
          >
            <div className="font-mono" style={{ color: "var(--faint)", fontSize: 9, letterSpacing: ".18em" }}>
              LAPTOP 2+ · FOLLOWER
            </div>
            <h2 className="font-serif" style={{ fontSize: 27, margin: "6px 0 16px" }}>
              Join the wall
            </h2>
            <label className="font-mono" style={{ color: "var(--muted)", display: "block", fontSize: 9, marginBottom: 6 }}>
              EIGHT-CHARACTER ROOM CODE
            </label>
            <input
              autoCapitalize="characters"
              maxLength={8}
              onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
              placeholder="ABCD2345"
              style={{
                background: "var(--app-bg)",
                border: "1px solid var(--line-4)",
                borderRadius: 10,
                fontFamily: "var(--font-mono)",
                fontSize: 19,
                letterSpacing: ".14em",
                marginBottom: 12,
                padding: "11px 13px",
                textTransform: "uppercase",
                width: "100%",
              }}
              value={joinCode}
            />
            <label className="font-mono" style={{ color: "var(--muted)", display: "block", fontSize: 9, marginBottom: 6 }}>
              POSITION FROM THE LEFT
            </label>
            <select
              onChange={(event) => onJoinPositionChange(Number(event.target.value))}
              style={{
                background: "var(--app-bg)",
                border: "1px solid var(--line-4)",
                borderRadius: 10,
                marginBottom: 14,
                padding: "10px 12px",
                width: "100%",
              }}
              value={joinPosition}
            >
              {Array.from({ length: 6 }, (_, index) => index + 1).map((position) => (
                <option key={position} value={position}>
                  Screen {position}
                </option>
              ))}
            </select>
            <button
              disabled={busy || joinCode.trim().length !== 8}
              onClick={onJoin}
              style={{
                background: "var(--text)",
                borderRadius: 999,
                color: "white",
                cursor: busy ? "wait" : "pointer",
                fontWeight: 700,
                opacity: joinCode.trim().length === 8 ? 1 : 0.45,
                padding: "11px 18px",
                width: "100%",
              }}
              type="button"
            >
              {busy ? "Joining room…" : "Join as follower"}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

function WallSessionHeader({
  activeScreenIds,
  canNavigate,
  connectionState,
  identity,
  onLeave,
  room,
}: {
  activeScreenIds: Set<string>;
  canNavigate: boolean;
  connectionState: string;
  identity: StoredIdentity;
  onLeave: () => void;
  room: WallRoomSnapshot;
}) {
  const copyCode = () => navigator.clipboard.writeText(room.roomCode);
  const enterFullscreen = () => document.documentElement.requestFullscreen();

  return (
    <header
      className="flex items-center justify-between"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--line)",
        flex: "0 0 68px",
        gap: 14,
        height: 68,
        padding: "0 16px",
        zIndex: 60,
      }}
    >
      <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
        <div
          className="flex items-center justify-center"
          style={{
            background: "var(--app-bg)",
            border: "2px solid var(--accent)",
            borderRadius: "50%",
            flex: "0 0 38px",
            height: 38,
            width: 38,
          }}
        >
          <span className="material-symbols-outlined filled" style={{ color: "var(--accent)" }}>
            bolt
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="font-serif" style={{ fontSize: 17, fontWeight: 700 }}>
            Pika History Wall
          </div>
          <div className="font-mono" style={{ color: "var(--faint)", fontSize: 8, letterSpacing: ".13em" }}>
            {canNavigate ? "SCROLL TO PAN · CTRL/⌘ + SCROLL TO ZOOM" : "FOLLOWING THE CONTROLLER"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={copyCode}
          style={{
            background: "var(--app-bg)",
            border: "1px solid var(--line-4)",
            borderRadius: 9,
            cursor: "pointer",
            padding: "7px 10px",
          }}
          title="Copy room code"
          type="button"
        >
          <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em" }}>
            {room.roomCode}
          </span>
        </button>

        <div className="flex items-center" style={{ marginLeft: 4 }}>
          {room.screens
            .slice()
            .sort((a, b) => a.screenOrder - b.screenOrder)
            .map((screen) => {
              const connected = activeScreenIds.has(screen.id);
              return (
                <span
                  className="font-mono flex items-center justify-center"
                  key={screen.id}
                  style={{
                    background: screen.id === identity.credential.screenId ? "var(--accent)" : "#e7ead9",
                    border: "2px solid var(--surface)",
                    borderRadius: "50%",
                    color: connected ? "var(--text)" : "var(--faint)",
                    fontSize: 9,
                    height: 27,
                    marginLeft: -5,
                    opacity: connected ? 1 : 0.45,
                    width: 27,
                  }}
                  title={`Screen ${screen.screenOrder + 1}`}
                >
                  {screen.screenOrder + 1}
                </span>
              );
            })}
        </div>

        <span
          className="font-mono"
          style={{
            color: connectionState === "connected" ? "#4d6b53" : "#9a6a35",
            fontSize: 8,
            textTransform: "uppercase",
          }}
        >
          ● {connectionState}
        </span>

        <button aria-label="Enter fullscreen" onClick={enterFullscreen} title="Fullscreen" type="button">
          <span className="material-symbols-outlined" style={{ color: "var(--muted)", fontSize: 20 }}>
            fullscreen
          </span>
        </button>
        <button aria-label="Leave wall" onClick={onLeave} title="Leave wall" type="button">
          <span className="material-symbols-outlined" style={{ color: "var(--muted)", fontSize: 19 }}>
            logout
          </span>
        </button>
      </div>
    </header>
  );
}
