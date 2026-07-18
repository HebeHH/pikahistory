import {
  HistoryWallIdSchema,
  RecordNotesPatchSchema,
} from "@/contracts/history-wall.schema";
import {
  RequestBodyError,
  apiData,
  apiError,
  authorizeRecordWrite,
  readBoundedJson,
} from "@/lib/api/v1";
import {
  getHistoryRecord,
  updateHistoryRecordNotes,
} from "@/lib/db/history-records";

export const dynamic = "force-dynamic";

/** GET /api/v1/records/:id always returns the complete stored record. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = HistoryWallIdSchema.safeParse(rawId);

  if (!id.success) {
    return apiError(400, "invalid_id", "Record ID format is invalid.");
  }

  try {
    const record = await getHistoryRecord(id.data);

    if (!record) {
      return apiError(404, "not_found", `No record exists with ID ${id.data}.`);
    }

    return apiData(record);
  } catch (error) {
    console.error("Failed to get history record", error);
    return apiError(500, "database_error", "Could not load history record.");
  }
}

/** PATCH /api/v1/records/:id edits notes/details but never identity or dates. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorizationError = authorizeRecordWrite(request);
  if (authorizationError) return authorizationError;

  const { id: rawId } = await params;
  const id = HistoryWallIdSchema.safeParse(rawId);
  if (!id.success) {
    return apiError(400, "invalid_id", "Record ID format is invalid.");
  }

  let input: unknown;
  try {
    input = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return apiError(error.status, error.code, error.message);
    }
    throw error;
  }

  const patch = RecordNotesPatchSchema.safeParse(input);
  if (!patch.success) {
    return apiError(
      422,
      "invalid_note_patch",
      "Only notes and structured details may be edited.",
      patch.error.issues,
    );
  }

  try {
    const updated = await updateHistoryRecordNotes(id.data, patch.data);
    if (!updated) {
      return apiError(404, "not_found", `No record exists with ID ${id.data}.`);
    }
    return apiData(updated);
  } catch (error) {
    console.error("Failed to update history record notes", error);
    return apiError(500, "database_error", "Could not update history record notes.");
  }
}
