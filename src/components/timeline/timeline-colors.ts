import type { Civilization, Continent, Era } from "@/contracts/history-wall.types";

/** Continents share a color family; a civilization may provide its own hue. */
export const CONTINENT_COLORS: Record<Continent, string> = {
  africa: "#a66c35",
  antarctica: "#5e8290",
  asia: "#78864b",
  europe: "#526f63",
  north_america: "#9b6048",
  oceania: "#3c7f83",
  south_america: "#a45b65",
  transcontinental: "#76649a",
  unknown: "#746f65",
};

export function civilizationColor(civilization: Civilization) {
  return civilization.color || CONTINENT_COLORS[civilization.location.continent];
}

/**
 * Era value changes intensity, never the underlying geographic color family.
 * Values 1→5 become progressively brighter/more prominent on the same hue.
 */
export function eraColor(civilization: Civilization, era: Era) {
  const alpha = [0.3, 0.42, 0.56, 0.72, 0.9][era.value - 1];
  return `color-mix(in srgb, ${civilizationColor(civilization)} ${Math.round(
    alpha * 100,
  )}%, white)`;
}
