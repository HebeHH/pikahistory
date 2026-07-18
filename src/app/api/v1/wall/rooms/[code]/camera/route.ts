import { UpdateWallCameraSchema } from "@/contracts/wall-session.schema";
import { apiData } from "@/lib/api/v1";
import {
  parseWallBody,
  parseWallRoomCode,
  readWallCredential,
  wallApiError,
} from "@/lib/api/wall";
import { saveWallCamera } from "@/lib/db/wall-sessions";

export const dynamic = "force-dynamic";

/** Persist a recoverable camera snapshot. Realtime frames bypass this route. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const code = parseWallRoomCode((await params).code);
    const credential = readWallCredential(request);
    const input = await parseWallBody(request, UpdateWallCameraSchema);
    return apiData(await saveWallCamera(code, credential, input));
  } catch (error) {
    return wallApiError(error, "save camera snapshot");
  }
}
