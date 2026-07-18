/**
 * World ↔ screen coordinate math for the multi-screen wall.
 * See docs/product/multi-screen-wall-handoff.md §1 and §4.
 *
 * The shared source of truth is a world-space camera, NOT any browser's
 * scrollLeft/scrollTop. Time maps linearly to world x; visual layout drives y.
 * All rendering, hit testing, zoom anchoring, and the ruler must route through
 * these helpers so a point stays continuous across screen boundaries.
 */
import type { WallCamera } from "./camera";

export const WORLD_UNITS_PER_YEAR = 1;

export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function yearToWorldX(year: number): number {
  return year * WORLD_UNITS_PER_YEAR;
}

export function worldXToYear(x: number): number {
  return x / WORLD_UNITS_PER_YEAR;
}

/**
 * Convert a world point to local screen pixels for a screen whose combined-
 * display horizontal offset is `offsetX` (sum of the widths of all screens to
 * its left).
 */
export function worldToLocalScreen(
  point: WorldPoint,
  camera: WallCamera,
  offsetX: number,
): WorldPoint {
  return {
    x: (point.x - camera.x) * camera.zoom - offsetX,
    y: (point.y - camera.y) * camera.zoom,
  };
}

/** Inverse of {@link worldToLocalScreen}. */
export function localScreenToWorld(
  point: WorldPoint,
  camera: WallCamera,
  offsetX: number,
): WorldPoint {
  return {
    x: camera.x + (offsetX + point.x) / camera.zoom,
    y: camera.y + point.y / camera.zoom,
  };
}

/** World x of a local ruler x-position on a screen at `offsetX` (handoff §6). */
export function localXToYear(localX: number, camera: WallCamera, offsetX: number): number {
  return worldXToYear(camera.x + (offsetX + localX) / camera.zoom);
}
