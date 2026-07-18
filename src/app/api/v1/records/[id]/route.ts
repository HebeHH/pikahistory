import { HistoryWallIdSchema } from "@/contracts/history-wall.schema";
import { apiData, apiError } from "@/lib/api/v1";
import { getHistoryRecord } from "@/lib/db/history-records";

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
