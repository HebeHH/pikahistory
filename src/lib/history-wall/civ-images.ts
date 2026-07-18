import type { HistoryWallRecord } from "@/contracts/history-wall.types";
import { linkedCivId } from "./civ-geo";

/**
 * Frontend-only image map for civilizations (iconic landmark photos from
 * Wikimedia Commons). Kept here rather than in the shared seed JSON so it
 * doesn't collide with the data-owner's files. Once records carry real
 * `details.media`, that takes precedence and this becomes a fallback.
 */
interface CivImage {
  url: string;
  credit: string;
}

export const CIV_IMAGES: Record<string, CivImage> = {
  civilization_rome: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/330px-Colosseo_2020.jpg",
    credit: "Colosseum, Rome — Wikimedia Commons",
  },
  civilization_ptolemaic_egypt: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Temple_Edfou_Egypte.jpg/330px-Temple_Edfou_Egypte.jpg",
    credit: "Temple of Edfu — Wikimedia Commons",
  },
  civilization_macedon: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Alexander_Mosaic_detail_of_Alexander_the_Great_%283x4_cropped%29.jpg/330px-Alexander_Mosaic_detail_of_Alexander_the_Great_%283x4_cropped%29.jpg",
    credit: "Alexander Mosaic — Wikimedia Commons",
  },
  civilization_aksum: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Rome_Stele.jpg/330px-Rome_Stele.jpg",
    credit: "Obelisk of Axum — Wikimedia Commons",
  },
  civilization_mali: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Djingareiber_cour.jpg/330px-Djingareiber_cour.jpg",
    credit: "Djinguereber Mosque, Timbuktu — Wikimedia Commons",
  },
  civilization_umayyad_caliphate: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Umayyad_Mosque%2C_Damascus.jpg/330px-Umayyad_Mosque%2C_Damascus.jpg",
    credit: "Umayyad Mosque, Damascus — Wikimedia Commons",
  },
  civilization_han_china: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg/330px-The_Great_Wall_of_China_at_Jinshanling-edit.jpg",
    credit: "Great Wall of China — Wikimedia Commons",
  },
  civilization_maurya_india: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Sarnath_capital.jpg/330px-Sarnath_capital.jpg",
    credit: "Lion Capital of Ashoka — Wikimedia Commons",
  },
  civilization_inca: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Machu_Picchu%2C_2023_%28012%29.jpg/330px-Machu_Picchu%2C_2023_%28012%29.jpg",
    credit: "Machu Picchu — Wikimedia Commons",
  },
  civilization_maori_aotearoa: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Marae%2C_Raiatea_2.jpg/330px-Marae%2C_Raiatea_2.jpg",
    credit: "Marae — Wikimedia Commons",
  },
};

/** The landmark image for a record: civ uses its own id; events/eras use their civilization. */
export function imageForRecord(record: HistoryWallRecord): CivImage | undefined {
  const civId = linkedCivId(record);
  return civId ? CIV_IMAGES[civId] : undefined;
}
