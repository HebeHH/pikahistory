import { z } from "zod";

/**
 * CANONICAL HISTORY WALL DATA CONTRACT
 *
 * This file is the source of truth shared by:
 * - the user-input UI that creates records;
 * - the database layer that stores records; and
 * - the wall UI that renders the timeline.
 *
 * AI CODERS: do not invent alternate field names or date formats. Import these
 * schemas and the inferred types from `history-wall.types.ts`. If the contract
 * must change, change this file, the types, README, and public base JSON in the
 * same commit.
 */

export const HISTORY_WALL_SCHEMA_VERSION = 1 as const;

/** Stable, URL-safe IDs such as `civilization_egypt` or `event_pyramids`. */
export const HistoryWallIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[a-z][a-z0-9_-]*$/,
    "IDs must start with a lowercase letter and contain only lowercase letters, numbers, underscores, or hyphens.",
  );

/**
 * Historical years use a signed integer convention without a year zero:
 * - BCE years are negative: 2550 BCE is `-2550`.
 * - CE years are positive: 2026 CE is `2026`.
 *
 * Keeping the sortable numeric value separate from `displayLabel` lets the UI
 * show uncertain or friendly text without making timeline sorting unreliable.
 */
export const HistoricalYearSchema = z
  .number()
  .int()
  .refine((year) => year !== 0, "Historical years cannot use year 0.");

export const DateCertaintySchema = z.enum([
  "exact",
  "approximate",
  "estimated",
  "legendary",
]);

/**
 * A shared date range for civilizations, events, and eras.
 * Omit `endYear` for a single-year event. The renderer should treat a missing
 * `endYear` as equal to `startYear`.
 */
export const HistoricalSpanSchema = z
  .object({
    startYear: HistoricalYearSchema,
    endYear: HistoricalYearSchema.optional(),
    displayLabel: z.string().trim().min(1).max(100),
    certainty: DateCertaintySchema.default("exact"),
  })
  .strict()
  .superRefine(({ startYear, endYear }, context) => {
    if (endYear !== undefined && endYear < startYear) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endYear"],
        message: "endYear must be the same as or later than startYear.",
      });
    }
  });

/** Initial location vocabulary. Add detail in `label` without changing it. */
export const ContinentSchema = z.enum([
  "africa",
  "antarctica",
  "asia",
  "europe",
  "north_america",
  "oceania",
  "south_america",
  "transcontinental",
  "unknown",
]);

export const GeographySchema = z
  .object({
    continent: ContinentSchema,
    /** Human-readable detail such as `Nile Valley` or `Eastern Mediterranean`. */
    label: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

/**
 * One visual reference shape covers both civilization icons and event media.
 * `asset` means a repository path such as `/images/pyramids.webp`.
 */
export const VisualReferenceSchema = z
  .object({
    kind: z.enum(["emoji", "asset", "url"]),
    value: z.string().trim().min(1).max(2_000),
    alt: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

/** CSS-compatible six-digit hex color. Example: `#D4A72C`. */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a six-digit hex value.");

/**
 * Explicit escape hatch for small future additions during the hackathon.
 * Stable fields should eventually graduate from `metadata` into the schema.
 */
const MetadataSchema = z.record(z.string(), z.unknown()).default({});

export const CivilizationSchema = z
  .object({
    /** Discriminator for code that handles several record kinds together. */
    type: z.literal("civilization"),
    id: HistoryWallIdSchema,
    title: z.string().trim().min(1).max(160),
    span: HistoricalSpanSchema,
    notes: z.string().trim().max(5_000).default(""),
    location: GeographySchema,
    icon: VisualReferenceSchema.optional(),
    color: HexColorSchema,
    metadata: MetadataSchema,
  })
  .strict();

export const EventSchema = z
  .object({
    /** Discriminator for code that handles several record kinds together. */
    type: z.literal("event"),
    id: HistoryWallIdSchema,
    title: z.string().trim().min(1).max(200),
    span: HistoricalSpanSchema,
    /** Optional because an event may be global or involve several civilizations. */
    civilizationId: HistoryWallIdSchema.optional(),
    notes: z.string().trim().max(5_000).default(""),
    visual: VisualReferenceSchema.optional(),
    metadata: MetadataSchema,
  })
  .strict();

/** Fixed UI vocabulary for the optional "vibe" of an era. */
export const EraTagSchema = z.enum([
  "golden_age",
  "peace",
  "expansion",
  "reform",
  "renaissance",
  "decline",
  "crisis",
  "civil_war",
  "other",
]);

export const EraSchema = z
  .object({
    /** Discriminator for code that handles several record kinds together. */
    type: z.literal("era"),
    id: HistoryWallIdSchema,
    title: z.string().trim().min(1).max(200),
    span: HistoricalSpanSchema,
    /** Every era belongs to exactly one civilization. */
    civilizationId: HistoryWallIdSchema,
    notes: z.string().trim().max(5_000).default(""),
    /** UI sentiment: 1 is very bad, 3 neutral, and 5 very good. */
    value: z.number().int().min(1).max(5).default(3),
    tag: EraTagSchema.optional(),
    metadata: MetadataSchema,
  })
  .strict();

/** Useful when a component or database function accepts any record kind. */
export const HistoryWallRecordSchema = z.discriminatedUnion("type", [
  CivilizationSchema,
  EventSchema,
  EraSchema,
]);

/**
 * Top-level payload read and written by the app.
 *
 * Cross-record checks here reject duplicate IDs and broken civilization
 * references before inconsistent data reaches the database or wall renderer.
 */
export const HistoryWallDataSchema = z
  .object({
    schemaVersion: z.literal(HISTORY_WALL_SCHEMA_VERSION),
    civilizations: z.array(CivilizationSchema),
    events: z.array(EventSchema),
    eras: z.array(EraSchema),
  })
  .strict()
  .superRefine((data, context) => {
    const allRecords = [
      ...data.civilizations.map((record, index) => ({
        collection: "civilizations",
        index,
        record,
      })),
      ...data.events.map((record, index) => ({
        collection: "events",
        index,
        record,
      })),
      ...data.eras.map((record, index) => ({
        collection: "eras",
        index,
        record,
      })),
    ];
    const seenIds = new Set<string>();

    for (const { collection, index, record } of allRecords) {
      if (seenIds.has(record.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [collection, index, "id"],
          message: `Duplicate record ID: ${record.id}`,
        });
      }
      seenIds.add(record.id);
    }

    const civilizationIds = new Set(
      data.civilizations.map((civilization) => civilization.id),
    );

    data.events.forEach((event, index) => {
      if (
        event.civilizationId !== undefined &&
        !civilizationIds.has(event.civilizationId)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["events", index, "civilizationId"],
          message: `Unknown civilization ID: ${event.civilizationId}`,
        });
      }
    });

    data.eras.forEach((era, index) => {
      if (!civilizationIds.has(era.civilizationId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eras", index, "civilizationId"],
          message: `Unknown civilization ID: ${era.civilizationId}`,
        });
      }
    });
  });

/** Use this at every JSON/database boundary instead of `as HistoryWallData`. */
export function parseHistoryWallData(input: unknown) {
  return HistoryWallDataSchema.parse(input);
}
