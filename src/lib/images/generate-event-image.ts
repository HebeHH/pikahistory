import "server-only";

import type { ImageGenerationRequest } from "@/contracts/image-generation.schema";

type ImageProvider = "openai" | "gemini";

export type GeneratedEventImage = {
  provider: ImageProvider;
  model: string;
  mimeType: string;
  /** Immediate preview. Upload this to durable storage before saving an event. */
  dataUrl: string;
};

export class ImageProviderError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "ImageProviderError";
  }
}

function chooseProvider(requested: ImageGenerationRequest["provider"]): ImageProvider {
  if (requested === "openai" || requested === "gemini") return requested;

  const configured = process.env.IMAGE_PROVIDER;
  if (configured === "openai" || configured === "gemini") return configured;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";

  throw new ImageProviderError(
    "No image provider is configured. Set GEMINI_API_KEY or OPENAI_API_KEY.",
    503,
  );
}

function buildPrompt(input: ImageGenerationRequest) {
  const style = {
    editorial: "a cinematic editorial-history illustration",
    artifact: "a museum-quality artifact reconstruction on a neutral backdrop",
    map: "a clear historical map illustration without labels or invented borders",
    photorealistic: "a historically plausible photorealistic reconstruction",
  }[input.style];

  return [
    `Create ${style} for a learning timeline.`,
    input.title ? `Event title: ${input.title}.` : "",
    `Historical description: ${input.description}`,
    "Show the event, place, material culture, and clothing accurately where the description supports them.",
    "Do not add captions, logos, watermarks, flags, people, or architecture not supported by the description.",
    "This is educational artwork, not proof that the depicted scene was photographed.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateWithOpenAI(
  input: ImageGenerationRequest,
): Promise<GeneratedEventImage> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ImageProviderError("OPENAI_API_KEY is not configured.", 503);
  }

  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1-mini";
  const size = input.aspectRatio === "1:1" ? "1024x1024" : "1536x1024";
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: buildPrompt(input),
      n: 1,
      quality: "low",
      size,
    }),
  });
  const body = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
    error?: { message?: string };
  };
  const base64 = body.data?.[0]?.b64_json;

  if (!response.ok || !base64) {
    throw new ImageProviderError(
      body.error?.message ?? "OpenAI did not return an image.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }

  return {
    provider: "openai",
    model,
    mimeType: "image/png",
    dataUrl: `data:image/png;base64,${base64}`,
  };
}

async function generateWithGemini(
  input: ImageGenerationRequest,
): Promise<GeneratedEventImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ImageProviderError("GEMINI_API_KEY is not configured.", 503);
  }

  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(input) }] }],
        generationConfig: {
          responseModalities: ["Image"],
          responseFormat: {
            image: { aspectRatio: input.aspectRatio },
          },
        },
      }),
    },
  );
  const body = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
    }>;
    error?: { message?: string };
  };
  const part = body.candidates?.[0]?.content?.parts?.find(
    (candidate) => candidate.inlineData?.data || candidate.inline_data?.data,
  );
  const base64 = part?.inlineData?.data ?? part?.inline_data?.data;
  const mimeType =
    part?.inlineData?.mimeType ?? part?.inline_data?.mime_type ?? "image/png";

  if (!response.ok || !base64) {
    throw new ImageProviderError(
      body.error?.message ?? "Gemini did not return an image.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }

  return {
    provider: "gemini",
    model,
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`,
  };
}

export async function generateEventImage(input: ImageGenerationRequest) {
  const provider = chooseProvider(input.provider);
  return provider === "gemini"
    ? generateWithGemini(input)
    : generateWithOpenAI(input);
}
