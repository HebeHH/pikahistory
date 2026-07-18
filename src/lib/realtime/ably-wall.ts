import "server-only";

import { Rest } from "ably";

import { WallSessionError } from "@/lib/db/wall-sessions";
import type { AuthenticatedWallScreen } from "@/lib/db/wall-sessions";

const TOKEN_TTL_MS = 60 * 60 * 1000;

function getAblyRestClient() {
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    throw new WallSessionError(
      503,
      "realtime_not_configured",
      "Set ABLY_API_KEY before starting a multi-screen wall.",
    );
  }
  return new Rest({ key });
}

export async function createWallRealtimeTokenRequest({
  room,
  screen,
}: AuthenticatedWallScreen) {
  const cameraChannel = `history-wall:${room.id}:camera`;
  const presenceChannel = `history-wall:${room.id}:presence`;
  const cameraOperations =
    screen.role === "controller"
      ? ["publish", "subscribe"]
      : ["subscribe"];

  return getAblyRestClient().auth.createTokenRequest({
    clientId: screen.id,
    ttl: TOKEN_TTL_MS,
    capability: JSON.stringify({
      [cameraChannel]: cameraOperations,
      [presenceChannel]: ["presence", "subscribe"],
    }),
  });
}
