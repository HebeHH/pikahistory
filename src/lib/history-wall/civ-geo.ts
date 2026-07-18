import type { HistoryWallRecord } from "@/contracts/history-wall.types";

/**
 * Approximate geographic center (lng, lat) for each seed civilization, so the
 * Map view can place pins at real coordinates. Frontend-only, like civ-images —
 * kept out of the shared seed JSON. Add entries as new civilizations appear.
 */
export interface LngLat {
  lng: number;
  lat: number;
}

export const CIV_GEO: Record<string, LngLat> = {
  civilization_rome: { lng: 12.5, lat: 41.9 },
  civilization_ptolemaic_egypt: { lng: 29.9, lat: 31.2 },
  civilization_macedon: { lng: 22.5, lat: 40.6 },
  civilization_aksum: { lng: 38.7, lat: 14.1 },
  civilization_mali: { lng: -3.0, lat: 16.8 },
  civilization_umayyad_caliphate: { lng: 36.3, lat: 33.5 },
  civilization_han_china: { lng: 108.9, lat: 34.3 },
  civilization_maurya_india: { lng: 85.1, lat: 25.6 },
  civilization_inca: { lng: -71.97, lat: -13.5 },
  civilization_maori_aotearoa: { lng: 174.8, lat: -41.3 },
};

/** The pin location for a record: civ uses its own id; events/eras use their civ. */
export function geoForRecord(record: HistoryWallRecord): LngLat | undefined {
  if (record.type === "civilization") return CIV_GEO[record.id];
  const civId =
    record.type === "era"
      ? record.civilizationId
      : record.civilizationId ?? record.interaction?.participants[0]?.civilizationId;
  return civId ? CIV_GEO[civId] : undefined;
}
