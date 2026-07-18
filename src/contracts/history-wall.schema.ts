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

export const HISTORY_WALL_SCHEMA_VERSION = 2 as const;

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
 * A shared date range for civilizations, people, events, and eras.
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
    /** Map pin coordinates, WGS84 decimal degrees. Optional: not every record needs a pin. */
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .strict();

/**
 * One visual reference shape covers civilization icons, person portraits, and event media.
 * `asset` means a repository path such as `/images/pyramids.webp`.
 */
export const VisualReferenceSchema = z
  .object({
    kind: z.enum(["emoji", "asset", "url"]),
    value: z.string().trim().min(1).max(2_000),
    alt: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

/** A source attached to a note. URLs stay explicit so the detail panel can link them. */
export const SourceReferenceSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    url: z.url().max(2_000),
    publisher: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

/**
 * Optional long-form detail shared by civilizations, people, events, and eras.
 *
 * Keep `notes` as the short, backwards-compatible summary. The detail drawer
 * should prefer this object when it exists: `markdown` is the full study note,
 * while tags, sources, and media remain structured and reusable by the UI.
 */
export const RecordDetailsSchema = z
  .object({
    markdown: z.string().trim().max(30_000).default(""),
    tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    sources: z.array(SourceReferenceSchema).max(30).default([]),
    media: z.array(VisualReferenceSchema).max(12).default([]),
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
const MAX_METADATA_KEYS = 100;
const MAX_METADATA_BYTES = 32 * 1024;

const MetadataSchema = z
  .record(z.string(), z.json())
  .superRefine((metadata, context) => {
    if (Object.keys(metadata).length > MAX_METADATA_KEYS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `metadata may contain at most ${MAX_METADATA_KEYS} top-level keys.`,
      });
    }

    if (new TextEncoder().encode(JSON.stringify(metadata)).byteLength > MAX_METADATA_BYTES) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `metadata must be at most ${MAX_METADATA_BYTES} bytes when encoded as JSON.`,
      });
    }
  })
  .default({});

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
    details: RecordDetailsSchema.optional(),
    metadata: MetadataSchema,
  })
  .strict();

/** Stable filter vocabulary for the major ways a historical person is known. */
export const PersonRoleSchema = z.enum([
  "monarch",
  "political_leader",
  "military_leader",
  "religious_leader",
  "scholar",
  "philosopher",
  "scientist",
  "inventor",
  "explorer",
  "artist",
  "writer",
  "architect",
  "engineer",
  "merchant",
  "diplomat",
  "activist",
  "other",
]);

/**
 * A person is a first-class wall record, not metadata inside a civilization.
 * `span` represents their lifespan (or best-known active span when life dates
 * are unknown). Multiple civilization IDs support people whose identity or
 * influence crosses empires, states, or cultures.
 */
export const PersonSchema = z
  .object({
    type: z.literal("person"),
    id: HistoryWallIdSchema,
    /** Display name, kept as `title` so shared record UI remains generic. */
    title: z.string().trim().min(1).max(200),
    span: HistoricalSpanSchema,
    civilizationIds: z.array(HistoryWallIdSchema).max(20).default([]),
    roles: z.array(PersonRoleSchema).max(12).default([]),
    /** Specific historical title such as `Pharaoh` or `Court astronomer`. */
    roleTitle: z.string().trim().min(1).max(160).optional(),
    notes: z.string().trim().max(5_000).default(""),
    location: GeographySchema.optional(),
    visual: VisualReferenceSchema.optional(),
    details: RecordDetailsSchema.optional(),
    metadata: MetadataSchema,
  })
  .strict()
  .superRefine(({ civilizationIds, roles }, context) => {
    if (new Set(civilizationIds).size !== civilizationIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["civilizationIds"],
        message: "Each civilization may appear only once on a person.",
      });
    }

    if (new Set(roles).size !== roles.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roles"],
        message: "Each person role may appear only once.",
      });
    }
  });

/**
 * Stable visual/filter vocabulary for relationships between civilizations.
 * `other` is intentionally available, but UIs should offer these named types
 * first so wars do not get stored as trade or vague free text.
 */
export const InteractionTypeSchema = z.enum([
  "war",
  "conquest",
  "occupation",
  "alliance",
  "treaty",
  "diplomacy",
  "trade",
  "migration",
  "exploration_contact",
  "colonialism",
  "hegemony_tributary",
  "cultural_exchange",
  "religious_exchange",
  "technology_transfer",
  "rivalry",
  "aid",
  "epidemic_transmission",
  "other",
]);

/** A participant role is optional context; it never replaces the relationship type. */
export const InteractionRoleSchema = z.enum([
  "participant",
  "initiator",
  "aggressor",
  "defender",
  "ally",
  "victor",
  "defeated",
  "occupier",
  "occupied",
  "colonizer",
  "colonized",
  "hegemon",
  "tributary",
  "explorer",
  "encountered",
  "trader",
  "migrant_origin",
  "migrant_destination",
]);

export const InteractionSchema = z
  .object({
    type: InteractionTypeSchema,
    /** Two or more civilizations; supports large events such as World War II. */
    participants: z
      .array(
        z
          .object({
            civilizationId: HistoryWallIdSchema,
            role: InteractionRoleSchema.default("participant"),
          })
          .strict(),
      )
      .min(2)
      .max(40),
  })
  .strict()
  .superRefine(({ participants }, context) => {
    const seen = new Set<string>();

    participants.forEach((participant, index) => {
      if (seen.has(participant.civilizationId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["participants", index, "civilizationId"],
          message: "Each civilization may appear only once in an interaction.",
        });
      }
      seen.add(participant.civilizationId);
    });
  });

export const EventSchema = z
  .object({
    /** Discriminator for code that handles several record kinds together. */
    type: z.literal("event"),
    id: HistoryWallIdSchema,
    title: z.string().trim().min(1).max(200),
    span: HistoricalSpanSchema,
    /** Optional because an event may be global or involve several civilizations. */
    civilizationId: HistoryWallIdSchema.optional(),
    /**
     * Present only when this event explicitly links multiple civilizations.
     * Example: World War II is one event with many participants and type `war`.
     */
    interaction: InteractionSchema.optional(),
    notes: z.string().trim().max(5_000).default(""),
    visual: VisualReferenceSchema.optional(),
    details: RecordDetailsSchema.optional(),
    metadata: MetadataSchema,
  })
  .strict()
  .superRefine(({ civilizationId, interaction }, context) => {
    if (civilizationId !== undefined && interaction !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["interaction"],
        message:
          "Use civilizationId for a single-civilization event or interaction for a multi-civilization event, not both.",
      });
    }
  });

/** Fixed UI vocabulary for the optional "vibe" of an era. */
export const EraTagSchema = z.enum([
  "golden_age",
  "peace",
  "prosperity",
  "expansion",
  "empire",
  "occupation",
  "colonization",
  "reform",
  "renaissance",
  "revolution",
  "industrialization",
  "restoration",
  "transition",
  "stagnation",
  "fragmentation",
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
    details: RecordDetailsSchema.optional(),
    metadata: MetadataSchema,
  })
  .strict();

/** Useful when a component or database function accepts any record kind. */
export const HistoryWallRecordSchema = z.discriminatedUnion("type", [
  CivilizationSchema,
  PersonSchema,
  EventSchema,
  EraSchema,
]);

/** The only mutable part of an existing record in v1. */
export const RecordNotesPatchSchema = z
  .object({
    notes: z.string().trim().max(5_000).optional(),
    /** Use null to remove the structured details object. */
    details: RecordDetailsSchema.nullable().optional(),
  })
  .strict()
  .refine(
    ({ notes, details }) => notes !== undefined || details !== undefined,
    "At least one of notes or details must be provided.",
  );

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
    people: z.array(PersonSchema),
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
      ...data.people.map((record, index) => ({
        collection: "people",
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

      event.interaction?.participants.forEach((participant, participantIndex) => {
        if (!civilizationIds.has(participant.civilizationId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [
              "events",
              index,
              "interaction",
              "participants",
              participantIndex,
              "civilizationId",
            ],
            message: `Unknown civilization ID: ${participant.civilizationId}`,
          });
        }
      });
    });

    data.people.forEach((person, index) => {
      person.civilizationIds.forEach((civilizationId, civilizationIndex) => {
        if (!civilizationIds.has(civilizationId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["people", index, "civilizationIds", civilizationIndex],
            message: `Unknown civilization ID: ${civilizationId}`,
          });
        }
      });
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
