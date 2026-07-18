import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
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
  "event",
  "era",
]);

export const historyRecords = pgTable(
  "history_records",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    type: historyRecordType("type").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    title: varchar("title", { length: 200 }).notNull(),
    startYear: integer("start_year").notNull(),
    endYear: integer("end_year"),
    civilizationId: varchar("civilization_id", { length: 100 }).references(
      (): AnyPgColumn => historyRecords.id,
      { onDelete: "restrict", onUpdate: "restrict" },
    ),
    payload: jsonb("payload").$type<HistoryWallRecord>().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("history_records_type_idx").on(table.type),
    index("history_records_start_year_idx").on(table.startYear),
    index("history_records_civilization_id_idx").on(table.civilizationId),
    check("history_records_schema_version_check", sql`${table.schemaVersion} = 1`),
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
        or ${table.type} = 'event'
        or (${table.type} = 'era' and ${table.civilizationId} is not null)`,
    ),
    check(
      "history_records_payload_type_check",
      sql`${table.payload}->>'type' = ${table.type}::text`,
    ),
  ],
);

export type HistoryRecordRow = typeof historyRecords.$inferSelect;
export type NewHistoryRecordRow = typeof historyRecords.$inferInsert;
