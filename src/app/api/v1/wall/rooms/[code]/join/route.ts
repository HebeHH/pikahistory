import { JoinWallRoomSchema } from "@/contracts/wall-session.schema";
import { apiData } from "@/lib/api/v1";
import {
  parseWallBody,
  parseWallRoomCode,
  wallApiError,
} from "@/lib/api/wall";
import { joinWallRoom } from "@/lib/db/wall-sessions";

export const dynamic = "force-dynamic";

/** Register a display using the invitation code. No controller rights granted. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const code = parseWallRoomCode((await params).code);
    const input = await parseWallBody(request, JoinWallRoomSchema);
    return apiData(await joinWallRoom(code, input), { status: 201 });
  } catch (error) {
    return wallApiError(error, "join room");
  }
}
