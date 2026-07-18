"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { WallCamera } from "./camera";
import { createWallTransport } from "./create-transport";
import type { WallRoomState, WallRoomTransport } from "./room-types";
import { measureViewport, type WallScreen } from "./screen-layout";

/**
 * Headless hook wiring the wall-room transport to React. It owns no visuals —
 * the UI owner reads `camera`, `state`, and `canNavigate` and renders world-space
 * content through the coordinate helpers. Provider choice is hidden inside
 * {@link createWallTransport}.
 */
export interface UseWallRoom {
  state: WallRoomState | null;
  camera: WallCamera | null;
  myScreenId: string | null;
  /** True only for the room controller; followers must not mutate the camera. */
  canNavigate: boolean;
  createRoom: (order?: number) => Promise<string>;
  joinRoom: (roomCode: string, order: number) => Promise<void>;
  publishCamera: (camera: WallCamera) => void;
  disconnect: () => void;
}

export function useWallRoom(): UseWallRoom {
  const transportRef = useRef<WallRoomTransport | null>(null);
  const ownerTokenRef = useRef<string>("");
  const [state, setState] = useState<WallRoomState | null>(null);
  const [myScreenId, setMyScreenId] = useState<string | null>(null);

  const ensureTransport = useCallback((): WallRoomTransport => {
    if (!transportRef.current) {
      const transport = createWallTransport();
      transport.subscribe(setState);
      transportRef.current = transport;
    }
    return transportRef.current;
  }, []);

  const buildScreen = useCallback((order: number): WallScreen => {
    return { id: "", order, connected: true, ...measureViewport() };
  }, []);

  const createRoom = useCallback(
    async (order = 0): Promise<string> => {
      const result = await ensureTransport().createRoom(buildScreen(order));
      ownerTokenRef.current = result.ownerToken;
      setMyScreenId(result.screenId);
      return result.roomCode;
    },
    [ensureTransport, buildScreen],
  );

  const joinRoom = useCallback(
    async (roomCode: string, order: number): Promise<void> => {
      const result = await ensureTransport().joinRoom(roomCode, buildScreen(order));
      setMyScreenId(result.screenId);
    },
    [ensureTransport, buildScreen],
  );

  const publishCamera = useCallback((camera: WallCamera): void => {
    transportRef.current?.publishCamera(camera, ownerTokenRef.current);
  }, []);

  const disconnect = useCallback((): void => {
    transportRef.current?.disconnect();
    transportRef.current = null;
    ownerTokenRef.current = "";
    setState(null);
    setMyScreenId(null);
  }, []);

  // Resend viewport dimensions whenever the window resizes (handoff §3).
  useEffect(() => {
    if (!myScreenId) return;
    const onResize = () => {
      const { viewportWidth, viewportHeight } = measureViewport();
      transportRef.current?.updateViewport({ viewportWidth, viewportHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [myScreenId]);

  // Leave the room cleanly on unmount.
  useEffect(() => () => transportRef.current?.disconnect(), []);

  const canNavigate = state !== null && myScreenId !== null && state.ownerId === myScreenId;

  return { state, camera: state?.camera ?? null, myScreenId, canNavigate, createRoom, joinRoom, publishCamera, disconnect };
}
