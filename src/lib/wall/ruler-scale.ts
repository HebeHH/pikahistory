/**
 * Adaptive time-ruler math (handoff §6). Pure logic only — the ruler's visual
 * treatment stays with the UI owner. Every screen uses the same global step
 * multiples so a tick crossing a screen boundary stays continuous.
 */
import type { WallCamera } from "./camera";
import { WORLD_UNITS_PER_YEAR, localXToYear } from "./coordinates";

export const YEAR_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

/**
 * Smallest step (in years) that leaves at least ~`targetPx` pixels between major
 * labels at the current zoom.
 */
export function chooseTickStep(zoom: number, targetPx = 110): number {
  const pixelsPerYear = WORLD_UNITS_PER_YEAR * zoom;
  const idealStep = targetPx / pixelsPerYear;
  return YEAR_STEPS.find((step) => step >= idealStep) ?? YEAR_STEPS[YEAR_STEPS.length - 1];
}

/** The [minYear, maxYear] visible behind one screen. */
export function visibleYearRange(
  camera: WallCamera,
  offsetX: number,
  screenWidth: number,
): [number, number] {
  return [localXToYear(0, camera, offsetX), localXToYear(screenWidth, camera, offsetX)];
}

/** Tick years that are multiples of `step` within [minYear, maxYear], skipping year 0. */
export function tickYears(minYear: number, maxYear: number, step: number): number[] {
  const first = Math.ceil(minYear / step) * step;
  const ticks: number[] = [];
  for (let year = first; year <= maxYear; year += step) {
    if (year !== 0) ticks.push(year);
  }
  return ticks;
}

/** "3000 BCE" | "500 CE" (no year zero, per product convention). */
export function formatRulerYear(year: number): string {
  return year < 0 ? `${-year} BCE` : `${year} CE`;
}
