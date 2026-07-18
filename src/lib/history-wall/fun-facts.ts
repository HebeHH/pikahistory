import type { Civilization } from "@/contracts/history-wall.types";

/**
 * Cross-civilization "fun facts": a playful connection surfaced when a user
 * selects two civilizations in a row.
 *
 * BACKEND SHAPE (for the data owner): put these on each civilization's
 * `metadata.funFacts` (the contract's escape hatch — no schema change needed):
 *
 *   civilization.metadata.funFacts = [
 *     { withCivilizationId: "civilization_han_china", fact: "…" },
 *     …
 *   ]
 *
 * They can live on either civ of a pair; the lookup checks both. Facts do NOT
 * need to be historically true — they're a delight, not a citation.
 *
 * The seed below is a frontend fallback so the feature demos before the DB data
 * lands. When a matching `metadata` fact exists, it wins.
 */

interface SeedFact {
  pair: [string, string];
  fact: string;
}

const SEED_FACTS: SeedFact[] = [
  { pair: ["civilization_rome", "civilization_han_china"], fact: "Roman glass beads have turned up in Han Chinese tombs — hitchhikers on the Silk Road, 8,000 km from home." },
  { pair: ["civilization_ptolemaic_egypt", "civilization_han_china"], fact: "Did you know noodles were invented in Egypt? (They weren't — but Egypt's bread and Han China's noodles each fed an empire.)" },
  { pair: ["civilization_ptolemaic_egypt", "civilization_rome"], fact: "Cleopatra of Egypt bankrolled Rome's civil wars — her love life literally redrew the map of the Mediterranean." },
  { pair: ["civilization_maurya_india", "civilization_han_china"], fact: "Buddhism packed its bags in Maurya India and walked all the way to Han China, remaking a civilization's soul." },
  { pair: ["civilization_macedon", "civilization_maurya_india"], fact: "Alexander of Macedon reached India's doorstep — then traded conquest for 500 Mauryan war elephants." },
  { pair: ["civilization_mali", "civilization_umayyad_caliphate"], fact: "Mali's Mansa Musa handed out so much gold crossing the Islamic world that Cairo's economy stayed dented for a decade." },
  { pair: ["civilization_inca", "civilization_maori_aotearoa"], fact: "The sweet potato shows up in both Inca Peru and Māori Aotearoa — a hint that Pacific canoes beat Columbus by centuries." },
  { pair: ["civilization_aksum", "civilization_rome"], fact: "Aksum minted its own gold coins and shipped ivory to Rome across the Red Sea — a trading power Rome respected." },
  { pair: ["civilization_rome", "civilization_macedon"], fact: "Rome swallowed Macedon whole — Alexander's old kingdom became just another Roman province." },
  { pair: ["civilization_ptolemaic_egypt", "civilization_maurya_india"], fact: "Ptolemaic Egypt and Mauryan India swapped ambassadors — ancient globalization, elephants and all." },
  { pair: ["civilization_umayyad_caliphate", "civilization_rome"], fact: "The Umayyads inherited Rome's old provinces — Roman aqueducts, suddenly under new management." },
];

function metadataFacts(civ: Civilization): { withCivilizationId: string; fact: string }[] {
  const raw = (civ.metadata as Record<string, unknown>).funFacts;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is { withCivilizationId: string; fact: string } =>
      !!f && typeof f === "object" && "withCivilizationId" in f && "fact" in f,
  );
}

/** A fun fact linking two civilizations, or null. Backend metadata wins over the seed. */
export function funFactBetween(
  aId: string,
  bId: string,
  civilizations: Civilization[],
): string | null {
  const a = civilizations.find((c) => c.id === aId);
  const b = civilizations.find((c) => c.id === bId);

  const fromMeta =
    a && metadataFacts(a).find((f) => f.withCivilizationId === bId)?.fact
      ? metadataFacts(a).find((f) => f.withCivilizationId === bId)!.fact
      : b && metadataFacts(b).find((f) => f.withCivilizationId === aId)?.fact
        ? metadataFacts(b).find((f) => f.withCivilizationId === aId)!.fact
        : null;
  if (fromMeta) return fromMeta;

  const seed = SEED_FACTS.find(
    (f) => f.pair.includes(aId) && f.pair.includes(bId),
  );
  return seed?.fact ?? null;
}
