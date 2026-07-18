import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { HistoryWallRecord } from "@/contracts/history-wall.types";

/**
 * One append-only table stores every canonical record kind.
 *
 * `payload` is the complete Zod-validated JSON returned by detail endpoints.
 * The duplicated columns are intentional: they make list, sort, uniqueness,
 * and relationship checks cheap without repeatedly querying inside JSONB.
 */
export const historyRecordType = pgEnum("history_record_type", [
  "civilization",
  "person",
  "event",
  "era",
]);

export const historyRecords = pgTable(
  "history_records",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    type: historyRecordType("type").notNull(),
    schemaVersion: integer("schema_version").notNull().default(2),
    title: varchar("title", { length: 200 }).notNull(),
    startYear: integer("start_year").notNull(),
    endYear: integer("end_year"),
    civilizationId: varchar("civilization_id", { length: 100 }),
    /** Generated discriminator makes the composite FK target civilizations only. */
    civilizationType: historyRecordType("civilization_type").generatedAlwaysAs(
      sql`case when civilization_id is null then null else 'civilization'::history_record_type end`,
    ),
    payload: jsonb("payload").$type<HistoryWallRecord>().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("history_records_id_type_unique").on(table.id, table.type),
    foreignKey({
      name: "history_records_civilization_fk",
      columns: [table.civilizationId, table.civilizationType],
      foreignColumns: [table.id, table.type],
    })
      .onDelete("restrict")
      .onUpdate("restrict"),
    index("history_records_type_idx").on(table.type),
    index("history_records_start_year_idx").on(table.startYear),
    index("history_records_civilization_id_idx").on(table.civilizationId),
    check(
      "history_records_schema_version_check",
      sql`${table.schemaVersion} in (1, 2)`,
    ),
    check(
      "history_records_start_year_check",
      sql`${table.startYear} <> 0`,
    ),
    check(
      "history_records_end_year_check",
      sql`${table.endYear} is null or (${table.endYear} <> 0 and ${table.endYear} >= ${table.startYear})`,
    ),
    check(
      "history_records_reference_shape_check",
      sql`(${table.type} = 'civilization' and ${table.civilizationId} is null)
        or (${table.type} = 'person' and ${table.civilizationId} is null)
        or ${table.type} = 'event'
        or (${table.type} = 'era' and ${table.civilizationId} is not null)`,
    ),
    check(
      "history_records_payload_type_check",
      sql`${table.payload}->>'type' is not distinct from ${table.type}::text`,
    ),
    check(
      "history_records_payload_identity_check",
      sql`${table.payload}->>'id' is not distinct from ${table.id}
        and ${table.payload}->>'title' is not distinct from ${table.title}`,
    ),
    check(
      "history_records_payload_span_check",
      sql`(${table.payload}->'span'->>'startYear')::integer is not distinct from ${table.startYear}
        and (${table.payload}->'span'->>'endYear')::integer is not distinct from ${table.endYear}`,
    ),
    check(
      "history_records_payload_civilization_check",
      sql`${table.payload}->>'civilizationId' is not distinct from ${table.civilizationId}`,
    ),
  ],
);

export type HistoryRecordRow = typeof historyRecords.$inferSelect;
export type NewHistoryRecordRow = typeof historyRecords.$inferInsert;

export const wallRoomStatus = pgEnum("wall_room_status", ["open", "closed"]);
export const wallScreenRole = pgEnum("wall_screen_role", [
  "controller",
  "display",
]);

/**
 * Durable coordination state for a temporary multi-screen wall session.
 *
 * High-frequency camera frames travel over the realtime provider. This row is
 * the authoritative recoverable snapshot used by new/reconnecting screens.
 */
export const wallRooms = pgTable(
  "wall_rooms",
  {
    id: uuid("id").primaryKey(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    status: wallRoomStatus("status").notNull().default("open"),
    ownerScreenId: uuid("owner_screen_id").notNull(),
    cameraX: doublePrecision("camera_x").notNull(),
    cameraY: doublePrecision("camera_y").notNull(),
    cameraZoom: doublePrecision("camera_zoom").notNull(),
    cameraRevision: integer("camera_revision").notNull().default(0),
    cameraUpdatedBy: uuid("camera_updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" })
      .notNull(),
  },
  (table) => [
    index("wall_rooms_code_idx").on(table.code),
    check("wall_rooms_camera_zoom_check", sql`${table.cameraZoom} between 0.05 and 16`),
    check("wall_rooms_camera_revision_check", sql`${table.cameraRevision} >= 0`),
  ],
);

/** Registered displays. The raw reconnect credential is never persisted. */
export const wallScreens = pgTable(
  "wall_screens",
  {
    id: uuid("id").primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => wallRooms.id, { onDelete: "cascade" }),
    credentialHash: varchar("credential_hash", { length: 64 }).notNull().unique(),
    role: wallScreenRole("role").notNull(),
    screenOrder: integer("screen_order").notNull(),
    viewportWidth: integer("viewport_width").notNull(),
    viewportHeight: integer("viewport_height").notNull(),
    devicePixelRatio: doublePrecision("device_pixel_ratio").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("wall_screens_room_order_unique").on(table.roomId, table.screenOrder),
    index("wall_screens_room_id_idx").on(table.roomId),
    check("wall_screens_order_check", sql`${table.screenOrder} between 0 and 31`),
    check(
      "wall_screens_viewport_width_check",
      sql`${table.viewportWidth} between 240 and 16384`,
    ),
    check(
      "wall_screens_viewport_height_check",
      sql`${table.viewportHeight} between 200 and 16384`,
    ),
    check(
      "wall_screens_pixel_ratio_check",
      sql`${table.devicePixelRatio} between 0.5 and 8`,
    ),
  ],
);

export type WallRoomRow = typeof wallRooms.$inferSelect;
export type WallScreenRow = typeof wallScreens.$inferSelect;
