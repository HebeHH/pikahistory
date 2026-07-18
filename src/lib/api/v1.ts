import { z } from "zod";

export const API_VERSION = "v1" as const;
export const MAX_RECORD_BODY_BYTES = 128 * 1024;

export const RecordListQuerySchema = z
  .object({
    detail: z.enum(["summary", "full"]).default("summary"),
  })
  .strict();

export function apiData<T>(data: T, init?: ResponseInit) {
  return Response.json(
    {
      apiVersion: API_VERSION,
      data,
    },
    init,
  );
}

export function apiList<T>(data: T[], detail: "summary" | "full") {
  return Response.json({
    apiVersion: API_VERSION,
    detail,
    count: data.length,
    data,
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  issues?: unknown,
) {
  return Response.json(
    {
      apiVersion: API_VERSION,
      error: {
        code,
        message,
        ...(issues === undefined ? {} : { issues }),
      },
    },
    { status },
  );
}

export class RequestBodyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

/** Read JSON without allowing an unbounded request to be buffered in memory. */
export async function readBoundedJson(
  request: Request,
  maxBytes = MAX_RECORD_BODY_BYTES,
): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > maxBytes) {
    throw new RequestBodyError(
      413,
      "payload_too_large",
      `Request body must be at most ${maxBytes} bytes.`,
    );
  }

  if (!request.body) {
    throw new RequestBodyError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new RequestBodyError(
        413,
        "payload_too_large",
        `Request body must be at most ${maxBytes} bytes.`,
      );
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestBodyError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

/** Authoring endpoints are server-to-server until user accounts exist. */
export function authorizeRecordWrite(request: Request) {
  const secret = process.env.HISTORY_WALL_WRITE_SECRET;

  if (!secret) {
    return apiError(
      503,
      "record_writes_disabled",
      "Set HISTORY_WALL_WRITE_SECRET before using record write endpoints.",
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return apiError(401, "unauthorized", "A valid authoring bearer token is required.");
  }

  return null;
}
