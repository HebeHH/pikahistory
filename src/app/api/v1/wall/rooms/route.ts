import { CreateWallRoomSchema } from "@/contracts/wall-session.schema";
import { apiData } from "@/lib/api/v1";
import { parseWallBody, wallApiError } from "@/lib/api/wall";
import { createWallRoom } from "@/lib/db/wall-sessions";

export const dynamic = "force-dynamic";

/** Create a room. The creating screen becomes its only camera controller. */
export async function POST(request: Request) {
  try {
    const input = await parseWallBody(request, CreateWallRoomSchema);
    return apiData(await createWallRoom(input), { status: 201 });
  } catch (error) {
    return wallApiError(error, "create room");
  }
}
