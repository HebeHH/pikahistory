import { z } from "zod";

export const WALL_ROOM_CODE_LENGTH = 8;
export const WALL_MIN_ZOOM = 0.05;
export const WALL_MAX_ZOOM = 16;

export const WallRoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);

export const WallViewportSchema = z
  .object({
    width: z.number().int().min(240).max(16_384),
    height: z.number().int().min(200).max(16_384),
    devicePixelRatio: z.number().min(0.5).max(8),
  })
  .strict();

export const WallCameraPositionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    zoom: z.number().min(WALL_MIN_ZOOM).max(WALL_MAX_ZOOM),
  })
  .strict();

export const WallCameraSchema = WallCameraPositionSchema.extend({
  revision: z.number().int().nonnegative(),
  updatedBy: z.string().uuid(),
  updatedAt: z.string().datetime(),
}).strict();

export const CreateWallRoomSchema = z
  .object({
    viewport: WallViewportSchema,
    screenOrder: z.number().int().min(0).max(31).default(0),
    initialCamera: WallCameraPositionSchema.default({
      x: -3200,
      y: 0,
      zoom: 0.35,
    }),
  })
  .strict();

export const JoinWallRoomSchema = z
  .object({
    viewport: WallViewportSchema,
    screenOrder: z.number().int().min(0).max(31).optional(),
  })
  .strict();

export const UpdateWallScreenSchema = z
  .object({
    viewport: WallViewportSchema.optional(),
    screenOrder: z.number().int().min(0).max(31).optional(),
  })
  .strict()
  .refine(
    (input) => input.viewport !== undefined || input.screenOrder !== undefined,
    "Provide viewport or screenOrder.",
  );

export const UpdateWallCameraSchema = WallCameraPositionSchema.extend({
  revision: z.number().int().positive(),
}).strict();

export const WallScreenRoleSchema = z.enum(["controller", "display"]);

export const WallScreenSchema = z
  .object({
    id: z.string().uuid(),
    role: WallScreenRoleSchema,
    screenOrder: z.number().int().min(0).max(31),
    viewport: WallViewportSchema,
    lastSeenAt: z.string().datetime(),
  })
  .strict();

export const WallRoomSnapshotSchema = z
  .object({
    roomCode: WallRoomCodeSchema,
    ownerScreenId: z.string().uuid(),
    expiresAt: z.string().datetime(),
    camera: WallCameraSchema,
    screens: z.array(WallScreenSchema),
  })
  .strict();

export const WallCredentialSchema = z
  .object({
    screenId: z.string().uuid(),
    token: z.string().min(32),
    role: WallScreenRoleSchema,
  })
  .strict();

export const WallRealtimeDescriptorSchema = z
  .object({
    provider: z.literal("ably"),
    authUrl: z.string(),
    cameraChannel: z.string(),
    presenceChannel: z.string(),
    cameraEvent: z.literal("camera.changed"),
    screenEvent: z.literal("screen.changed"),
  })
  .strict();

export const WallSessionBootstrapSchema = z
  .object({
    credential: WallCredentialSchema,
    room: WallRoomSnapshotSchema,
    realtime: WallRealtimeDescriptorSchema,
  })
  .strict();

export const WallPresenceDataSchema = z
  .object({
    screenId: z.string().uuid(),
    role: WallScreenRoleSchema,
    screenOrder: z.number().int().min(0).max(31),
    viewport: WallViewportSchema,
  })
  .strict();

export type WallViewport = z.infer<typeof WallViewportSchema>;
export type WallCameraPosition = z.infer<typeof WallCameraPositionSchema>;
export type WallCamera = z.infer<typeof WallCameraSchema>;
export type CreateWallRoomInput = z.infer<typeof CreateWallRoomSchema>;
export type JoinWallRoomInput = z.infer<typeof JoinWallRoomSchema>;
export type UpdateWallScreenInput = z.infer<typeof UpdateWallScreenSchema>;
export type UpdateWallCameraInput = z.infer<typeof UpdateWallCameraSchema>;
export type WallScreenRole = z.infer<typeof WallScreenRoleSchema>;
export type WallScreen = z.infer<typeof WallScreenSchema>;
export type WallRoomSnapshot = z.infer<typeof WallRoomSnapshotSchema>;
export type WallCredential = z.infer<typeof WallCredentialSchema>;
export type WallRealtimeDescriptor = z.infer<
  typeof WallRealtimeDescriptorSchema
>;
export type WallSessionBootstrap = z.infer<typeof WallSessionBootstrapSchema>;
export type WallPresenceData = z.infer<typeof WallPresenceDataSchema>;
