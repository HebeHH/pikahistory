import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import type {
  HistoryWallRecord,
  RecordNotesPatch,
} from "@/contracts/history-wall.types";
import {
  HISTORY_WALL_SCHEMA_VERSION,
  HistoryWallRecordSchema,
  RecordNotesPatchSchema,
} from "@/contracts/history-wall.schema";

import { getDb } from "./client";
import { historyRecords } from "./schema";

export type RecordListDetail = "summary" | "full";

export type HistoryRecordSummary = {
  id: string;
  type: HistoryWallRecord["type"];
  title: string;
  startYear: number;
  endYear?: number;
  civilizationId?: string;
  civilizationIds?: string[];
  interactionType?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredHistoryRecord = HistoryWallRecord & {
  createdAt: string;
  updatedAt: string;
};

function parseStoredRecord(payload: unknown) {
  return HistoryWallRecordSchema.parse(payload);
}

/** Raised when any record points at a missing/non-civilization record. */
export class CivilizationReferenceError extends Error {
  constructor(public readonly civilizationId: string) {
    super(`Unknown civilization ID: ${civilizationId}`);
    this.name = "CivilizationReferenceError";
  }
}

function getCivilizationId(record: HistoryWallRecord) {
  return record.type === "event" || record.type === "era"
    ? record.civilizationId
    : undefined;
}

function getReferencedCivilizationIds(record: HistoryWallRecord) {
  if (record.type === "person") {
    return record.civilizationIds;
  }

  if (record.type === "era") {
    return [record.civilizationId];
  }

  if (record.type !== "event") {
    return [];
  }

  if (record.interaction) {
    return record.interaction.participants.map(
      (participant) => participant.civilizationId,
    );
  }

  return record.civilizationId ? [record.civilizationId] : [];
}

/** Return every record, ordered from earliest start year to latest. */
export async function listHistoryRecords(
  detail: "summary",
): Promise<HistoryRecordSummary[]>;
export async function listHistoryRecords(
  detail: "full",
): Promise<StoredHistoryRecord[]>;
export async function listHistoryRecords(
  detail: RecordListDetail,
): Promise<HistoryRecordSummary[] | StoredHistoryRecord[]> {
  const db = getDb();

  if (detail === "full") {
    const rows = await db
      .select({
        payload: historyRecords.payload,
        createdAt: historyRecords.createdAt,
        updatedAt: historyRecords.updatedAt,
      })
      .from(historyRecords)
      .orderBy(
        asc(historyRecords.startYear),
        asc(historyRecords.createdAt),
        asc(historyRecords.id),
      );

    return rows.map(({ payload, createdAt, updatedAt }) => ({
      ...parseStoredRecord(payload),
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    }));
  }

  const rows = await db
    .select({
      id: historyRecords.id,
      type: historyRecords.type,
      title: historyRecords.title,
      startYear: historyRecords.startYear,
      endYear: historyRecords.endYear,
      civilizationId: historyRecords.civilizationId,
      payload: historyRecords.payload,
      createdAt: historyRecords.createdAt,
      updatedAt: historyRecords.updatedAt,
    })
    .from(historyRecords)
    .orderBy(
      asc(historyRecords.startYear),
      asc(historyRecords.createdAt),
      asc(historyRecords.id),
    );

  return rows.map((row) => {
    const payload = parseStoredRecord(row.payload);

    return {
      id: row.id,
      type: row.type,
      title: row.title,
      startYear: row.startYear,
      ...(row.endYear === null ? {} : { endYear: row.endYear }),
      ...(row.civilizationId === null
        ? {}
        : { civilizationId: row.civilizationId }),
      ...(payload.type === "event" && payload.interaction
        ? {
            civilizationIds: payload.interaction.participants.map(
              (participant) => participant.civilizationId,
            ),
            interactionType: payload.interaction.type,
          }
        : {}),
      ...(payload.type === "person" && payload.civilizationIds.length > 0
        ? { civilizationIds: payload.civilizationIds }
        : {}),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

/** Get one complete canonical record by its stable public ID. */
export async function getHistoryRecord(
  id: string,
): Promise<StoredHistoryRecord | null> {
  const [row] = await getDb()
    .select({
      payload: historyRecords.payload,
      createdAt: historyRecords.createdAt,
      updatedAt: historyRecords.updatedAt,
    })
    .from(historyRecords)
    .where(eq(historyRecords.id, id))
    .limit(1);

  return row
    ? {
        ...parseStoredRecord(row.payload),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    : null;
}

/** Insert exactly once. Duplicate IDs are intentionally never overwritten. */
export async function addHistoryRecord(input: unknown) {
  // Validate here as well as at the HTTP boundary so scripts and future server
  // actions cannot accidentally persist a merely type-asserted payload.
  const record = HistoryWallRecordSchema.parse(input);
  const db = getDb();
  const civilizationId = getCivilizationId(record);
  const referencedCivilizationIds = getReferencedCivilizationIds(record);

  if (referencedCivilizationIds.length > 0) {
    const civilizations = await db
      .select({ id: historyRecords.id, type: historyRecords.type })
      .from(historyRecords)
      .where(inArray(historyRecords.id, referencedCivilizationIds));

    const foundCivilizationIds = new Set(
      civilizations
        .filter((candidate) => candidate.type === "civilization")
        .map((candidate) => candidate.id),
    );
    const missingCivilizationId = referencedCivilizationIds.find(
      (candidate) => !foundCivilizationIds.has(candidate),
    );

    if (missingCivilizationId) {
      throw new CivilizationReferenceError(missingCivilizationId);
    }
  }

  const [created] = await db
    .insert(historyRecords)
    .values({
      id: record.id,
      type: record.type,
      schemaVersion: HISTORY_WALL_SCHEMA_VERSION,
      title: record.title,
      startYear: record.span.startYear,
      endYear: record.span.endYear,
      civilizationId,
      payload: record,
    })
    .returning({
      payload: historyRecords.payload,
      createdAt: historyRecords.createdAt,
      updatedAt: historyRecords.updatedAt,
    });

  return {
    ...created.payload,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  } satisfies StoredHistoryRecord;
}

/** Update authorable note fields without permitting identity/date mutations. */
export async function updateHistoryRecordNotes(
  id: string,
  input: RecordNotesPatch,
): Promise<StoredHistoryRecord | null> {
  const patch = RecordNotesPatchSchema.parse(input);
  const db = getDb();
  const [existing] = await db
    .select({ payload: historyRecords.payload })
    .from(historyRecords)
    .where(eq(historyRecords.id, id))
    .limit(1);

  if (!existing) return null;

  const payload: Record<string, unknown> = { ...parseStoredRecord(existing.payload) };
  if (patch.notes !== undefined) payload.notes = patch.notes;
  if (patch.details === null) {
    delete payload.details;
  } else if (patch.details !== undefined) {
    payload.details = patch.details;
  }

  const validatedPayload = HistoryWallRecordSchema.parse(payload);
  const [updated] = await db
    .update(historyRecords)
    .set({ payload: validatedPayload, updatedAt: new Date() })
    .where(eq(historyRecords.id, id))
    .returning({
      payload: historyRecords.payload,
      createdAt: historyRecords.createdAt,
      updatedAt: historyRecords.updatedAt,
    });

  return {
    ...parseStoredRecord(updated.payload),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/** Neon/Postgres unique-constraint code, including wrapped driver errors. */
export function isDuplicateIdError(error: unknown): boolean {
  let current: unknown = error;

  while (current && typeof current === "object") {
    if ("code" in current && current.code === "23505") {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}
