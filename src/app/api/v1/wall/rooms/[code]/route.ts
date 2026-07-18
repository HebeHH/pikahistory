import { apiData } from "@/lib/api/v1";
import {
  parseWallRoomCode,
  readWallCredential,
  wallApiError,
} from "@/lib/api/wall";
import { getAuthenticatedWallRoom } from "@/lib/db/wall-sessions";

export const dynamic = "force-dynamic";

/** Recover the durable room snapshot after a reload or disconnect. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const code = parseWallRoomCode((await params).code);
    const credential = readWallCredential(request);
    return apiData(await getAuthenticatedWallRoom(code, credential));
  } catch (error) {
    return wallApiError(error, "get room snapshot");
  }
}
