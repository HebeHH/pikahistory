import { persistRecordNotes } from "@/app/actions/history-records";
import type { HistoryWallRecord } from "@/contracts/history-wall.types";

/**
 * Thin client over the History Wall REST API (`/api/v1`).
 *
 * Record identity/history fields are append-only. PATCH persists only the
 * authorable notes/details fields and the UI keeps other edits local.
 */

const BASE = "/api/v1/records";

type Envelope<T> = { apiVersion: string; data?: T; error?: { code: string; message: string } };

export interface SaveResult {
  record: HistoryWallRecord;
  persisted: boolean; // false => kept locally because the endpoint isn't live yet
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Envelope<unknown>;
    return body.error?.message ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

/** Create a brand-new civilization / person / event / era. */
export async function addRecord(record: HistoryWallRecord): Promise<SaveResult> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!response.ok) throw new Error(await readError(response));
  return { record, persisted: true };
}

/** Update the authorable note fields of an existing record. */
export async function updateRecord(record: HistoryWallRecord): Promise<SaveResult> {
  try {
    await persistRecordNotes({
      id: record.id,
      notes: record.notes,
      ...(record.details === undefined ? {} : { details: record.details }),
    });
    return { record, persisted: true };
  } catch (error) {
    if (
      error instanceof Error &&
      !/Failed to fetch|Record writes are disabled/i.test(error.message)
    ) {
      throw error;
    }
  }
  // Keep the edit locally if the server is offline or authoring is disabled.
  return { record, persisted: false };
}
