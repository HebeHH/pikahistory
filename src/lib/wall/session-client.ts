"use client";

import { Realtime, type Message, type TokenRequest } from "ably";

import {
  WallCameraSchema,
  WallPresenceDataSchema,
  WallRoomSnapshotSchema,
  WallScreenSchema,
  WallSessionBootstrapSchema,
  type CreateWallRoomInput,
  type JoinWallRoomInput,
  type UpdateWallCameraInput,
  type UpdateWallScreenInput,
  type WallCamera,
  type WallCredential,
  type WallPresenceData,
  type WallRealtimeDescriptor,
  type WallScreen,
  type WallSessionBootstrap,
} from "@/contracts/wall-session.schema";

type ApiEnvelope<T> = { apiVersion: "v1"; data: T };
type ApiErrorEnvelope = {
  apiVersion: "v1";
  error: { code: string; message: string; issues?: unknown };
};

export class WallSessionClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
    this.name = "WallSessionClientError";
  }
}

async function requestWallApi<T>(
  url: string,
  init: RequestInit,
  parse: (input: unknown) => T,
) {
  const response = await fetch(url, init);
  const body = (await response.json()) as ApiEnvelope<unknown> | ApiErrorEnvelope;

  if (!response.ok || !("data" in body)) {
    const error = "error" in body ? body.error : undefined;
    throw new WallSessionClientError(
      response.status,
      error?.code ?? "wall_request_failed",
      error?.message ?? "Wall session request failed.",
      error?.issues,
    );
  }

  return parse(body.data);
}

function jsonRequest(method: string, body?: unknown, credential?: string) {
  return {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(credential === undefined
        ? {}
        : { authorization: `Bearer ${credential}` }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  } satisfies RequestInit;
}

export function measureWallViewport() {
  return {
    width: Math.round(window.innerWidth),
    height: Math.round(window.innerHeight),
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

export function createWallRoom(input: CreateWallRoomInput) {
  return requestWallApi(
    "/api/v1/wall/rooms",
    jsonRequest("POST", input),
    (data) => WallSessionBootstrapSchema.parse(data),
  );
}

export function joinWallRoom(roomCode: string, input: JoinWallRoomInput) {
  return requestWallApi(
    `/api/v1/wall/rooms/${encodeURIComponent(roomCode)}/join`,
    jsonRequest("POST", input),
    (data) => WallSessionBootstrapSchema.parse(data),
  );
}

export function recoverWallRoom(roomCode: string, credential: string) {
  return requestWallApi(
    `/api/v1/wall/rooms/${encodeURIComponent(roomCode)}`,
    jsonRequest("GET", undefined, credential),
    (data) => WallRoomSnapshotSchema.parse(data),
  );
}

export function updateWallScreen(
  roomCode: string,
  screenId: string,
  credential: string,
  input: UpdateWallScreenInput,
) {
  return requestWallApi(
    `/api/v1/wall/rooms/${encodeURIComponent(roomCode)}/screens/${encodeURIComponent(screenId)}`,
    jsonRequest("PATCH", input, credential),
    (data) => {
      const result = data as { screen?: unknown; room?: unknown };
      return {
        screen: WallScreenSchema.parse(result.screen),
        room: WallRoomSnapshotSchema.parse(result.room),
      };
    },
  );
}

export function persistWallCamera(
  roomCode: string,
  credential: string,
  input: UpdateWallCameraInput,
) {
  return requestWallApi(
    `/api/v1/wall/rooms/${encodeURIComponent(roomCode)}/camera`,
    jsonRequest("POST", input, credential),
    (data) => WallCameraSchema.parse(data),
  );
}

async function requestRealtimeToken(
  realtime: WallRealtimeDescriptor,
  credential: string,
) {
  return requestWallApi(
    realtime.authUrl,
    jsonRequest("POST", undefined, credential),
    (data) => data as TokenRequest,
  );
}

export type WallRealtimeConnection = {
  client: Realtime;
  enterPresence(data: WallPresenceData): Promise<void>;
  updatePresence(data: WallPresenceData): Promise<void>;
  publishCamera(camera: WallCamera): Promise<void>;
  publishScreenUpdate(screen: WallScreen): Promise<void>;
  subscribeToCamera(listener: (camera: WallCamera) => void): Promise<() => void>;
  subscribeToScreenUpdates(
    listener: (screen: WallScreen) => void,
  ): Promise<() => void>;
  subscribeToPresence(listener: () => void): Promise<() => void>;
  getPresence(): Promise<WallPresenceData[]>;
  close(): void;
};

/**
 * Connect to the two least-privilege room channels described by the backend.
 * Followers receive credentials that cannot publish to the camera channel.
 */
export function connectWallRealtime(
  realtime: WallRealtimeDescriptor,
  credential: WallCredential,
): WallRealtimeConnection {
  const client = new Realtime({
    autoConnect: true,
    authCallback: (_params, callback) => {
      requestRealtimeToken(realtime, credential.token)
        .then((tokenRequest) => callback(null, tokenRequest))
        .catch((error: unknown) =>
          callback(
            error instanceof Error
              ? error.message
              : "Could not authorize realtime connection",
            null,
          ),
        );
    },
  });
  const cameraChannel = client.channels.get(realtime.cameraChannel);
  const presenceChannel = client.channels.get(realtime.presenceChannel);

  return {
    client,
    async enterPresence(data) {
      await presenceChannel.presence.enter(data);
    },
    async updatePresence(data) {
      await presenceChannel.presence.update(data);
    },
    async publishCamera(camera) {
      await cameraChannel.publish(realtime.cameraEvent, camera);
    },
    async publishScreenUpdate(screen) {
      await cameraChannel.publish(realtime.screenEvent, screen);
    },
    async subscribeToCamera(listener) {
      const onMessage = (message: Message) => {
        const parsed = WallCameraSchema.safeParse(message.data);
        if (parsed.success) listener(parsed.data);
      };
      await cameraChannel.subscribe(realtime.cameraEvent, onMessage);
      return () => {
        cameraChannel.unsubscribe(realtime.cameraEvent, onMessage);
      };
    },
    async subscribeToScreenUpdates(listener) {
      const onMessage = (message: Message) => {
        const parsed = WallScreenSchema.safeParse(message.data);
        if (parsed.success) listener(parsed.data);
      };
      await cameraChannel.subscribe(realtime.screenEvent, onMessage);
      return () => {
        cameraChannel.unsubscribe(realtime.screenEvent, onMessage);
      };
    },
    async subscribeToPresence(listener) {
      const onPresenceChange = () => listener();
      await presenceChannel.presence.subscribe(onPresenceChange);
      return () => {
        presenceChannel.presence.unsubscribe(onPresenceChange);
      };
    },
    async getPresence() {
      const members = await presenceChannel.presence.get();
      return members.flatMap((member) => {
        const parsed = WallPresenceDataSchema.safeParse(member.data);
        return parsed.success && member.clientId === parsed.data.screenId
          ? [parsed.data]
          : [];
      });
    },
    close() {
      client.close();
    },
  };
}

export type { WallSessionBootstrap };
