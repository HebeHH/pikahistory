import { apiData } from "@/lib/api/v1";
import {
  parseWallRoomCode,
  readWallCredential,
  wallApiError,
} from "@/lib/api/wall";
import { authenticateWallScreen } from "@/lib/db/wall-sessions";
import { createWallRealtimeTokenRequest } from "@/lib/realtime/ably-wall";

export const dynamic = "force-dynamic";

/** Issue a short-lived, room-scoped credential with role-based capabilities. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const code = parseWallRoomCode((await params).code);
    const credential = readWallCredential(request);
    const authenticated = await authenticateWallScreen(code, credential);
    return apiData(await createWallRealtimeTokenRequest(authenticated));
  } catch (error) {
    return wallApiError(error, "issue realtime token");
  }
}
