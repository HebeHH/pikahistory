import { z } from "zod";

export const API_VERSION = "v1" as const;

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
