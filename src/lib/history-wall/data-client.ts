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
    const response = await fetch(`${BASE}/${encodeURIComponent(record.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: record.notes,
        ...(record.details === undefined ? {} : { details: record.details }),
      }),
    });
    if (response.ok) return { record, persisted: true };
    // 404/405 = endpoint not live yet; anything else is a real error.
    if (response.status !== 404 && response.status !== 405) {
      throw new Error(await readError(response));
    }
  } catch (error) {
    if (error instanceof Error && !/Failed to fetch/i.test(error.message)) throw error;
  }
  // Fallback: keep the edit locally so the demo flows until PATCH ships.
  return { record, persisted: false };
}
