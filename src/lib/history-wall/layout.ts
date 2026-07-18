import type {
  Civilization,
  Continent,
  Era,
  HistoryEvent,
  HistoryWallData,
} from "@/contracts/history-wall.types";

/**
 * Zoom-independent layout: group records into continent bands and pack
 * civilizations onto non-overlapping lanes. Pixel positions are computed later
 * from the year fields via time-scale, so this only needs to run when data
 * changes, not on every zoom/render.
 */

export interface BandStyle {
  key: string;
  name: string;
  tint: string;
  labelColor: string;
  segColor: string;
}

const CONTINENT_TO_BAND: Record<Continent, string> = {
  africa: "africa",
  asia: "asia",
  europe: "europe",
  north_america: "americas",
  south_america: "americas",
  oceania: "oceania",
  antarctica: "world",
  transcontinental: "world",
  unknown: "world",
};

export const BAND_STYLES: Record<string, BandStyle> = {
  africa: { key: "africa", name: "Africa", tint: "#f2e8d7", labelColor: "#8a6d3b", segColor: "rgba(138,109,59,.30)" },
  asia: { key: "asia", name: "Asia", tint: "#ebe8de", labelColor: "#5f6b4a", segColor: "rgba(95,107,74,.30)" },
  europe: { key: "europe", name: "Europe", tint: "#e8ebda", labelColor: "#4d6b53", segColor: "rgba(77,107,83,.30)" },
  americas: { key: "americas", name: "Americas", tint: "#f0e5dd", labelColor: "#8a5a44", segColor: "rgba(138,90,68,.30)" },
  oceania: { key: "oceania", name: "Oceania", tint: "#e6ebe9", labelColor: "#3a7d6b", segColor: "rgba(58,125,107,.30)" },
  world: { key: "world", name: "World", tint: "#ece7dd", labelColor: "#6f675a", segColor: "rgba(111,103,90,.30)" },
};

const BAND_ORDER = ["africa", "asia", "europe", "americas", "oceania", "world"];

export interface CivLayout {
  civ: Civilization;
  lane: number;
  events: HistoryEvent[];
  eras: Era[];
}

export interface BandLayout {
  style: BandStyle;
  laneCount: number;
  civs: CivLayout[];
}

function spanEnd(record: { span: { startYear: number; endYear?: number } }): number {
  return record.span.endYear ?? record.span.startYear;
}

function groupByCivId<T extends { civilizationId?: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!item.civilizationId) continue;
    const list = map.get(item.civilizationId);
    if (list) list.push(item);
    else map.set(item.civilizationId, [item]);
  }
  return map;
}

export function buildWallLayout(data: HistoryWallData): BandLayout[] {
  const eventsByCiv = groupByCivId(data.events);
  const erasByCiv = groupByCivId(data.eras);

  const civsByBand = new Map<string, Civilization[]>();
  for (const civ of data.civilizations) {
    const bandKey = CONTINENT_TO_BAND[civ.location.continent] ?? "world";
    const list = civsByBand.get(bandKey);
    if (list) list.push(civ);
    else civsByBand.set(bandKey, [civ]);
  }

  const bands: BandLayout[] = [];
  for (const key of BAND_ORDER) {
    const civs = civsByBand.get(key);
    if (!civs || civs.length === 0) continue;

    // Greedy lane packing: earliest-start first, reuse the first free lane.
    const sorted = [...civs].sort((a, b) => a.span.startYear - b.span.startYear);
    const laneEnds: number[] = [];
    const civLayouts: CivLayout[] = [];

    for (const civ of sorted) {
      let lane = laneEnds.findIndex((end) => end <= civ.span.startYear);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(spanEnd(civ));
      } else {
        laneEnds[lane] = spanEnd(civ);
      }
      civLayouts.push({
        civ,
        lane,
        events: eventsByCiv.get(civ.id) ?? [],
        eras: erasByCiv.get(civ.id) ?? [],
      });
    }

    bands.push({
      style: BAND_STYLES[key],
      laneCount: Math.max(laneEnds.length, 1),
      civs: civLayouts,
    });
  }

  return bands;
}

/** Sentiment color for an era value 1 (bad, red) → 5 (good, green). */
export function eraSentimentColor(value: number): string {
  const palette: Record<number, string> = {
    1: "rgba(176,74,52,.45)",
    2: "rgba(198,128,60,.40)",
    3: "rgba(154,145,127,.35)",
    4: "rgba(120,140,90,.42)",
    5: "rgba(77,107,83,.48)",
  };
  return palette[value] ?? palette[3];
}
