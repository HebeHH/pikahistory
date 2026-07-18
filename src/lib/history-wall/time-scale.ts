/**
 * Time-scale math for the timeline wall. Linear mapping from a historical year
 * to an x pixel, scaled by zoom. Everything on the wall is positioned from X().
 *
 *   X(year, z) = round(150 + ((year + 3000) / 5025) * 1820 * z)
 */
export const YEAR_MIN = -3000;
export const YEAR_MAX = 2025;
export const SPAN_YEARS = YEAR_MAX - YEAR_MIN; // 5025

const LEFT_OFFSET = 150; // gutter for the sticky band labels
const BASE_WIDTH = 1820; // usable width at zoom = 1

export const ZOOM_MIN = 0.55;
export const ZOOM_MAX = 2.2;

export const TICK_YEARS = [-3000, -2000, -1000, 0, 500, 1000, 1500, 2025];

const LANE_TOP = 54;
const LANE_GAP = 56;

export function xForYear(year: number, zoom: number): number {
  const clamped = Math.max(YEAR_MIN, Math.min(YEAR_MAX, year));
  return Math.round(LEFT_OFFSET + ((clamped - YEAR_MIN) / SPAN_YEARS) * BASE_WIDTH * zoom);
}

export function trackWidth(zoom: number): number {
  return xForYear(YEAR_MAX, zoom) + 40;
}

export function laneY(lane: number): number {
  return LANE_TOP + lane * LANE_GAP;
}

export function bandHeight(laneCount: number): number {
  return Math.max(150, laneY(Math.max(laneCount, 1) - 1) + 40);
}

/** "3000 BCE" | "1 CE" | "500 CE" */
export function formatYear(year: number): string {
  if (year < 0) return `${-year} BCE`;
  if (year === 0) return "1 CE";
  return `${year} CE`;
}

export function clampZoom(zoom: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}
