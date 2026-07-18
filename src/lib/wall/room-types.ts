/**
 * Provider-neutral room contracts. See handoff §8.
 *
 * The renderer and coordinate math are proven before choosing the final
 * realtime provider, so all provider-specific code stays behind
 * {@link WallRoomTransport}. Swap the implementation (BroadcastChannel mock →
 * managed WebSocket service) without touching UI or camera logic.
 */
import type { WallCamera } from "./camera";
import type { WallScreen } from "./screen-layout";

export interface WallRoomState {
  roomCode: string;
  ownerId: string;
  camera: WallCamera;
  screens: WallScreen[];
}

export interface CreateRoomResult {
  roomCode: string;
  ownerToken: string;
  screenId: string;
}

export type WallRoomMessage =
  | { type: "room.snapshot"; state: WallRoomState }
  | { type: "screen.joined"; screen: WallScreen }
  | { type: "screen.viewport_changed"; screenId: string; viewportWidth: number; viewportHeight: number }
  | { type: "screen.disconnected"; screenId: string }
  | { type: "screens.reordered"; screens: WallScreen[] }
  | { type: "camera.changed"; camera: WallCamera };

export interface WallRoomTransport {
  createRoom(screen: WallScreen): Promise<CreateRoomResult>;
  joinRoom(roomCode: string, screen: WallScreen): Promise<{ screenId: string }>;
  updateViewport(dimensions: Pick<WallScreen, "viewportWidth" | "viewportHeight">): void;
  reorderScreens(screens: WallScreen[], ownerToken: string): void;
  /** Owner-only; the transport must reject camera writes not carrying a valid owner token. */
  publishCamera(camera: WallCamera, ownerToken: string): void;
  subscribe(listener: (state: WallRoomState) => void): () => void;
  disconnect(): void;
}
