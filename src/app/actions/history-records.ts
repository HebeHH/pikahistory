"use server";

import {
  HistoryWallIdSchema,
  RecordNotesPatchSchema,
} from "@/contracts/history-wall.schema";
import { updateHistoryRecordNotes } from "@/lib/db/history-records";

export type PersistNotesInput = {
  id: string;
  notes?: string;
  details?: unknown;
};

/**
 * Same-origin browser bridge for note persistence.
 *
 * Next.js Server Actions reject cross-origin invocations. The authoring secret
 * remains server-only and acts as the deployment-level switch for all writes.
 */
export async function persistRecordNotes(input: PersistNotesInput) {
  if (!process.env.HISTORY_WALL_WRITE_SECRET) {
    throw new Error("Record writes are disabled on this deployment.");
  }

  const id = HistoryWallIdSchema.parse(input.id);
  const patch = RecordNotesPatchSchema.parse({
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.details === undefined ? {} : { details: input.details }),
  });
  const updated = await updateHistoryRecordNotes(id, patch);

  if (!updated) {
    throw new Error(`No record exists with ID ${id}.`);
  }

  return updated;
}
