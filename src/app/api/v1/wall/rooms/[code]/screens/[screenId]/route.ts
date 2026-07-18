import { z } from "zod";

import { UpdateWallScreenSchema } from "@/contracts/wall-session.schema";
import { apiData } from "@/lib/api/v1";
import {
  parseWallBody,
  parseWallRoomCode,
  readWallCredential,
  wallApiError,
} from "@/lib/api/wall";
import { WallSessionError, updateWallScreen } from "@/lib/db/wall-sessions";

export const dynamic = "force-dynamic";

/** Update dimensions/order. Displays edit themselves; the controller may arrange all. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string; screenId: string }> },
) {
  try {
    const rawParams = await params;
    const code = parseWallRoomCode(rawParams.code);
    const screenId = z.string().uuid().safeParse(rawParams.screenId);
    if (!screenId.success) {
      throw new WallSessionError(
        400,
        "invalid_screen_id",
        "Wall screen ID is invalid.",
      );
    }

    const credential = readWallCredential(request);
    const input = await parseWallBody(request, UpdateWallScreenSchema);
    return apiData(
      await updateWallScreen(code, screenId.data, credential, input),
    );
  } catch (error) {
    return wallApiError(error, "update screen");
  }
}
