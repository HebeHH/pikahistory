import { HistoryWallRecordSchema } from "@/contracts/history-wall.schema";
import { RecordListQuerySchema, apiError, apiList, apiData } from "@/lib/api/v1";
import {
  CivilizationReferenceError,
  addHistoryRecord,
  isDuplicateIdError,
  listHistoryRecords,
} from "@/lib/db/history-records";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/records
 * GET /api/v1/records?detail=full
 *
 * Returns every civilization, event, and era. Summaries are the default so a
 * list view never downloads every note/media field by accident.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = RecordListQuerySchema.safeParse({
    detail: url.searchParams.get("detail") ?? undefined,
  });

  if (!query.success) {
    return apiError(
      400,
      "invalid_query",
      "detail must be either summary or full.",
      query.error.issues,
    );
  }

  try {
    if (query.data.detail === "full") {
      return apiList(await listHistoryRecords("full"), "full");
    }

    return apiList(await listHistoryRecords("summary"), "summary");
  } catch (error) {
    console.error("Failed to list history records", error);
    return apiError(500, "database_error", "Could not load history records.");
  }
}

/**
 * POST /api/v1/records
 *
 * Appends one civilization, event, or era. There is deliberately no upsert:
 * resubmitting an existing stable ID returns 409 instead of changing history.
 */
export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = HistoryWallRecordSchema.safeParse(input);

  if (!parsed.success) {
    return apiError(
      422,
      "invalid_record",
      "Record does not match the History Wall contract.",
      parsed.error.issues,
    );
  }

  try {
    const created = await addHistoryRecord(parsed.data);

    return apiData(created, {
      status: 201,
      headers: { Location: `/api/v1/records/${created.id}` },
    });
  } catch (error) {
    if (error instanceof CivilizationReferenceError) {
      return apiError(
        422,
        "unknown_civilization",
        `No civilization exists with ID ${error.civilizationId}.`,
      );
    }

    if (isDuplicateIdError(error)) {
      return apiError(
        409,
        "duplicate_id",
        `A record with ID ${parsed.data.id} already exists. Add-only records cannot be overwritten.`,
      );
    }

    console.error("Failed to add history record", error);
    return apiError(500, "database_error", "Could not add history record.");
  }
}
