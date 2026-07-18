import { BroadcastChannelTransport } from "./transport-broadcast";
import type { WallRoomTransport } from "./room-types";

/**
 * Single place that decides which transport backs the wall room.
 *
 * Today: BroadcastChannel (same-machine multi-tab prototype, handoff Phase B).
 * TODO(backend): when the managed realtime provider is ready, return that
 * implementation here instead — nothing else in the app needs to change, since
 * everything depends only on the WallRoomTransport interface.
 */
export function createWallTransport(): WallRoomTransport {
  return new BroadcastChannelTransport();
}
