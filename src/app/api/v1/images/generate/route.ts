import { ImageGenerationRequestSchema } from "@/contracts/image-generation.schema";
import { apiData, apiError } from "@/lib/api/v1";
import {
  generateEventImage,
  ImageProviderError,
} from "@/lib/images/generate-event-image";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/v1/images/generate — protected because every call costs money. */
export async function POST(request: Request) {
  const secret = process.env.IMAGE_GENERATION_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret) {
    return apiError(
      503,
      "image_generation_disabled",
      "Set IMAGE_GENERATION_SECRET before using this endpoint.",
    );
  }

  if (authorization !== `Bearer ${secret}`) {
    return apiError(401, "unauthorized", "A valid bearer token is required.");
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = ImageGenerationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return apiError(
      422,
      "invalid_image_request",
      "Image request does not match the v1 contract.",
      parsed.error.issues,
    );
  }

  try {
    return apiData(await generateEventImage(parsed.data));
  } catch (error) {
    if (error instanceof ImageProviderError) {
      return apiError(error.status, "image_provider_error", error.message);
    }

    console.error("Failed to generate event image", error);
    return apiError(502, "image_provider_error", "Could not generate an image.");
  }
}
