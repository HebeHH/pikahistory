import { z } from "zod";

import {
  CivilizationSchema,
  ContinentSchema,
  DateCertaintySchema,
  EraSchema,
  EraTagSchema,
  EventSchema,
  GeographySchema,
  HistoricalSpanSchema,
  HistoryWallDataSchema,
  HistoryWallRecordSchema,
  VisualReferenceSchema,
} from "./history-wall.schema";

/**
 * CANONICAL TYPES FOR HISTORY WALL FEATURES
 *
 * These types are inferred from the Zod runtime contract. Do not recreate
 * matching interfaces elsewhere: duplicated types drift away from validation.
 * Import only the types a component or database function actually needs.
 */

export type DateCertainty = z.infer<typeof DateCertaintySchema>;
export type HistoricalSpan = z.infer<typeof HistoricalSpanSchema>;
export type Continent = z.infer<typeof ContinentSchema>;
export type Geography = z.infer<typeof GeographySchema>;
export type VisualReference = z.infer<typeof VisualReferenceSchema>;
export type EraTag = z.infer<typeof EraTagSchema>;

export type Civilization = z.infer<typeof CivilizationSchema>;
export type HistoryEvent = z.infer<typeof EventSchema>;
export type Era = z.infer<typeof EraSchema>;
export type HistoryWallRecord = z.infer<typeof HistoryWallRecordSchema>;
export type HistoryWallData = z.infer<typeof HistoryWallDataSchema>;
