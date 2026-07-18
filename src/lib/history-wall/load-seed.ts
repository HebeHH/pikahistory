import {
  HISTORY_WALL_SCHEMA_VERSION,
  parseHistoryWallData,
} from "@/contracts/history-wall.schema";
import type { HistoryWallData } from "@/contracts/history-wall.types";

import baseData from "../../../public/data/history-wall.base.json";
import seedCiv from "../../../public/data/seed-civ.json";
import seedEras from "../../../public/data/seed-eras.json";
import seedEvents from "../../../public/data/seed-events.json";
import seedPeople from "../../../public/data/seed-people.json";

/**
 * Initial wall data for the demo. Prefers the rich seed (seed-civ + seed-events
 * assembled into one payload); falls back to the canonical base payload if the
 * seed ever fails validation. Once the API/DB is live this can be swapped for
 * `GET /api/v1/records?detail=full`.
 */
export function loadInitialData(): HistoryWallData {
  try {
    return parseHistoryWallData({
      schemaVersion: HISTORY_WALL_SCHEMA_VERSION,
      civilizations: seedCiv,
      people: seedPeople,
      events: seedEvents,
      eras: seedEras,
    });
  } catch (error) {
    console.warn("[history-wall] rich seed failed validation, using base payload:", error);
    return parseHistoryWallData(baseData);
  }
}
