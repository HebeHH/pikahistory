import type { ZodType } from "zod";

import { WallRoomCodeSchema } from "@/contracts/wall-session.schema";

import { RequestBodyError, apiError, readBoundedJson } from "./v1";
import { WallSessionError } from "../db/wall-sessions";

const MAX_WALL_BODY_BYTES = 16 * 1024;

export function parseWallRoomCode(value: string) {
  const parsed = WallRoomCodeSchema.safeParse(value);
  if (!parsed.success) {
    throw new WallSessionError(
      400,
      "invalid_room_code",
      "Wall room codes contain eight unambiguous letters or numbers.",
    );
  }
  return parsed.data;
}

export function readWallCredential(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new WallSessionError(
      401,
      "wall_credential_required",
      "A wall screen bearer credential is required.",
    );
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (token.length < 32) {
    throw new WallSessionError(
      401,
      "invalid_wall_credential",
      "The wall screen credential is invalid.",
    );
  }
  return token;
}

export async function parseWallBody<T>(request: Request, schema: ZodType<T>) {
  const input = await readBoundedJson(request, MAX_WALL_BODY_BYTES);
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new WallSessionError(
      422,
      "invalid_wall_request",
      "Request does not match the wall session contract.",
      parsed.error.issues,
    );
  }
  return parsed.data;
}

export function wallApiError(error: unknown, operation: string) {
  if (error instanceof WallSessionError) {
    return apiError(
      error.status,
      error.code,
      error.message,
      error.details,
    );
  }

  if (error instanceof RequestBodyError) {
    return apiError(error.status, error.code, error.message);
  }

  console.error(`Wall session operation failed: ${operation}`, error);
  return apiError(500, "wall_session_error", "Wall session operation failed.");
}
