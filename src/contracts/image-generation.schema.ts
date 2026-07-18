import { z } from "zod";

export const ImageGenerationRequestSchema = z
  .object({
    /** The historical fact/context supplied by the event detail form. */
    description: z.string().trim().min(20).max(4_000),
    title: z.string().trim().min(1).max(200).optional(),
    provider: z.enum(["auto", "openai", "gemini"]).default("auto"),
    aspectRatio: z.enum(["1:1", "3:2", "16:9"]).default("16:9"),
    style: z
      .enum(["editorial", "artifact", "map", "photorealistic"])
      .default("editorial"),
  })
  .strict();

export type ImageGenerationRequest = z.infer<
  typeof ImageGenerationRequestSchema
>;
