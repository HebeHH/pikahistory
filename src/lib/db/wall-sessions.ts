import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and, asc, count, eq, lt, max } from "drizzle-orm";

import type {
  CreateWallRoomInput,
  JoinWallRoomInput,
  UpdateWallCameraInput,
  UpdateWallScreenInput,
  WallCamera,
  WallRoomSnapshot,
  WallScreen,
  WallSessionBootstrap,
} from "@/contracts/wall-session.schema";

import { getDb } from "./client";
import {
  wallRooms,
  wallScreens,
  type WallRoomRow,
  type WallScreenRow,
} from "./schema";

const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ROOM_LIFETIME_MS = 12 * 60 * 60 * 1000;
const MAX_SCREENS_PER_ROOM = 12;

export class WallSessionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "WallSessionError";
  }
}

export type AuthenticatedWallScreen = {
  room: WallRoomRow;
  screen: WallScreenRow;
};

function createRoomCode() {
  const bytes = randomBytes(8);
  return Array.from(
    bytes,
    (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length],
  ).join("");
}

function createCredential() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashCredential(token) };
}

function hashCredential(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toScreen(row: WallScreenRow): WallScreen {
  return {
    id: row.id,
    role: row.role,
    screenOrder: row.screenOrder,
    viewport: {
      width: row.viewportWidth,
      height: row.viewportHeight,
      devicePixelRatio: row.devicePixelRatio,
    },
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

function toCamera(room: WallRoomRow): WallCamera {
  return {
    x: room.cameraX,
    y: room.cameraY,
    zoom: room.cameraZoom,
    revision: room.cameraRevision,
    updatedBy: room.cameraUpdatedBy,
    updatedAt: room.updatedAt.toISOString(),
  };
}

function assertRoomIsOpen(room: WallRoomRow) {
  if (room.status !== "open" || room.expiresAt.getTime() <= Date.now()) {
    throw new WallSessionError(
      410,
      "room_expired",
      "This wall room has expired or been closed.",
    );
  }
}

function hasPostgresCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

export function wallRealtimeDescriptor(roomCode: string, roomId: string) {
  return {
    provider: "ably" as const,
    authUrl: `/api/v1/wall/rooms/${roomCode}/realtime-token`,
    cameraChannel: `history-wall:${roomId}:camera`,
    presenceChannel: `history-wall:${roomId}:presence`,
    cameraEvent: "camera.changed" as const,
    screenEvent: "screen.changed" as const,
  };
}

async function getRoomByCode(roomCode: string) {
  const [room] = await getDb()
    .select()
    .from(wallRooms)
    .where(eq(wallRooms.code, roomCode))
    .limit(1);

  if (!room) {
    throw new WallSessionError(404, "room_not_found", "Wall room not found.");
  }
  assertRoomIsOpen(room);
  return room;
}

export async function getWallRoomSnapshot(
  room: WallRoomRow,
): Promise<WallRoomSnapshot> {
  const screens = await getDb()
    .select()
    .from(wallScreens)
    .where(eq(wallScreens.roomId, room.id))
    .orderBy(asc(wallScreens.screenOrder), asc(wallScreens.createdAt));

  return {
    roomCode: room.code,
    ownerScreenId: room.ownerScreenId,
    expiresAt: room.expiresAt.toISOString(),
    camera: toCamera(room),
    screens: screens.map(toScreen),
  };
}

export async function createWallRoom(
  input: CreateWallRoomInput,
): Promise<WallSessionBootstrap> {
  const db = getDb();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const roomId = randomUUID();
    const screenId = randomUUID();
    const roomCode = createRoomCode();
    const credential = createCredential();
    const expiresAt = new Date(Date.now() + ROOM_LIFETIME_MS);

    try {
      await db.transaction(async (transaction) => {
        await transaction.insert(wallRooms).values({
          id: roomId,
          code: roomCode,
          ownerScreenId: screenId,
          cameraX: input.initialCamera.x,
          cameraY: input.initialCamera.y,
          cameraZoom: input.initialCamera.zoom,
          cameraRevision: 0,
          cameraUpdatedBy: screenId,
          expiresAt,
        });

        await transaction.insert(wallScreens).values({
          id: screenId,
          roomId,
          credentialHash: credential.hash,
          role: "controller",
          screenOrder: input.screenOrder,
          viewportWidth: input.viewport.width,
          viewportHeight: input.viewport.height,
          devicePixelRatio: input.viewport.devicePixelRatio,
        });
      });

      const room = await getRoomByCode(roomCode);
      return {
        credential: {
          screenId,
          token: credential.token,
          role: "controller",
        },
        room: await getWallRoomSnapshot(room),
        realtime: wallRealtimeDescriptor(roomCode, roomId),
      };
    } catch (error) {
      if (hasPostgresCode(error, "23505") && attempt < 3) continue;
      throw error;
    }
  }

  throw new WallSessionError(
    503,
    "room_code_unavailable",
    "Could not allocate a unique wall room code.",
  );
}

export async function joinWallRoom(
  roomCode: string,
  input: JoinWallRoomInput,
): Promise<WallSessionBootstrap> {
  const db = getDb();
  const room = await getRoomByCode(roomCode);
  const [aggregate] = await db
    .select({ total: count(), highestOrder: max(wallScreens.screenOrder) })
    .from(wallScreens)
    .where(eq(wallScreens.roomId, room.id));

  if (aggregate.total >= MAX_SCREENS_PER_ROOM) {
    throw new WallSessionError(
      409,
      "room_full",
      `A wall room supports at most ${MAX_SCREENS_PER_ROOM} screens.`,
    );
  }

  const screenOrder =
    input.screenOrder ?? Math.min((aggregate.highestOrder ?? -1) + 1, 31);
  const screenId = randomUUID();
  const credential = createCredential();

  try {
    await db.insert(wallScreens).values({
      id: screenId,
      roomId: room.id,
      credentialHash: credential.hash,
      role: "display",
      screenOrder,
      viewportWidth: input.viewport.width,
      viewportHeight: input.viewport.height,
      devicePixelRatio: input.viewport.devicePixelRatio,
    });
  } catch (error) {
    if (hasPostgresCode(error, "23505")) {
      throw new WallSessionError(
        409,
        "screen_order_taken",
        `Screen position ${screenOrder} is already occupied.`,
      );
    }
    throw error;
  }

  return {
    credential: {
      screenId,
      token: credential.token,
      role: "display",
    },
    room: await getWallRoomSnapshot(room),
    realtime: wallRealtimeDescriptor(roomCode, room.id),
  };
}

export async function authenticateWallScreen(
  roomCode: string,
  credentialToken: string,
): Promise<AuthenticatedWallScreen> {
  const credentialHash = hashCredential(credentialToken);
  const [result] = await getDb()
    .select({ room: wallRooms, screen: wallScreens })
    .from(wallScreens)
    .innerJoin(wallRooms, eq(wallScreens.roomId, wallRooms.id))
    .where(
      and(
        eq(wallRooms.code, roomCode),
        eq(wallScreens.credentialHash, credentialHash),
      ),
    )
    .limit(1);

  if (!result) {
    throw new WallSessionError(
      401,
      "invalid_wall_credential",
      "The wall screen credential is invalid.",
    );
  }

  assertRoomIsOpen(result.room);
  const now = new Date();
  await getDb()
    .update(wallScreens)
    .set({ lastSeenAt: now })
    .where(eq(wallScreens.id, result.screen.id));

  return {
    room: result.room,
    screen: { ...result.screen, lastSeenAt: now },
  };
}

export async function getAuthenticatedWallRoom(
  roomCode: string,
  credentialToken: string,
) {
  const authenticated = await authenticateWallScreen(roomCode, credentialToken);
  return getWallRoomSnapshot(authenticated.room);
}

export async function updateWallScreen(
  roomCode: string,
  targetScreenId: string,
  credentialToken: string,
  input: UpdateWallScreenInput,
) {
  const authenticated = await authenticateWallScreen(roomCode, credentialToken);
  const canEdit =
    authenticated.screen.id === targetScreenId ||
    authenticated.screen.role === "controller";

  if (!canEdit) {
    throw new WallSessionError(
      403,
      "screen_update_forbidden",
      "A display may update only its own viewport.",
    );
  }

  const [target] = await getDb()
    .select()
    .from(wallScreens)
    .where(
      and(
        eq(wallScreens.id, targetScreenId),
        eq(wallScreens.roomId, authenticated.room.id),
      ),
    )
    .limit(1);

  if (!target) {
    throw new WallSessionError(404, "screen_not_found", "Wall screen not found.");
  }

  try {
    const [updated] = await getDb()
      .update(wallScreens)
      .set({
        ...(input.screenOrder === undefined
          ? {}
          : { screenOrder: input.screenOrder }),
        ...(input.viewport === undefined
          ? {}
          : {
              viewportWidth: input.viewport.width,
              viewportHeight: input.viewport.height,
              devicePixelRatio: input.viewport.devicePixelRatio,
            }),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
      })
      .where(eq(wallScreens.id, targetScreenId))
      .returning();

    return {
      screen: toScreen(updated),
      room: await getWallRoomSnapshot(authenticated.room),
    };
  } catch (error) {
    if (hasPostgresCode(error, "23505")) {
      throw new WallSessionError(
        409,
        "screen_order_taken",
        "That screen position is already occupied.",
      );
    }
    throw error;
  }
}

export async function saveWallCamera(
  roomCode: string,
  credentialToken: string,
  input: UpdateWallCameraInput,
) {
  const authenticated = await authenticateWallScreen(roomCode, credentialToken);

  if (authenticated.screen.role !== "controller") {
    throw new WallSessionError(
      403,
      "camera_update_forbidden",
      "Only the room controller may update the shared camera.",
    );
  }

  const now = new Date();
  const [updated] = await getDb()
    .update(wallRooms)
    .set({
      cameraX: input.x,
      cameraY: input.y,
      cameraZoom: input.zoom,
      cameraRevision: input.revision,
      cameraUpdatedBy: authenticated.screen.id,
      updatedAt: now,
    })
    .where(
      and(
        eq(wallRooms.id, authenticated.room.id),
        lt(wallRooms.cameraRevision, input.revision),
      ),
    )
    .returning();

  if (!updated) {
    const [current] = await getDb()
      .select()
      .from(wallRooms)
      .where(eq(wallRooms.id, authenticated.room.id))
      .limit(1);

    throw new WallSessionError(
      409,
      "stale_camera_revision",
      "Camera revisions must increase monotonically.",
      { currentCamera: toCamera(current) },
    );
  }

  return toCamera(updated);
}
