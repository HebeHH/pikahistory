/**
 * Screen registration and left-to-right arrangement. See handoff §3.
 *
 * Each joining browser measures its own viewport (CSS pixels) and an order.
 * A screen's combined-display horizontal offset is the sum of the widths of all
 * screens ordered before it. All screens share the same world y; a taller screen
 * simply reveals more vertical content.
 */
export interface WallScreen {
  id: string;
  order: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  connected: boolean;
}

/** Screens sorted left-to-right by their order value. */
export function orderedScreens(screens: WallScreen[]): WallScreen[] {
  return [...screens].sort((a, b) => a.order - b.order);
}

/** Sum of viewport widths of every screen ordered before `screen`. */
export function screenOffsetX(screen: WallScreen, screens: WallScreen[]): number {
  return screens
    .filter((candidate) => candidate.order < screen.order)
    .reduce((total, candidate) => total + candidate.viewportWidth, 0);
}

/** Total width of the combined display wall. */
export function totalWallWidth(screens: WallScreen[]): number {
  return screens.reduce((total, screen) => total + screen.viewportWidth, 0);
}

/** True if two screens claim the same order (the join UI should reject this). */
export function hasDuplicateOrders(screens: WallScreen[]): boolean {
  const seen = new Set<number>();
  for (const screen of screens) {
    if (seen.has(screen.order)) return true;
    seen.add(screen.order);
  }
  return false;
}

/** Measure the current browser viewport as a partial screen record. */
export function measureViewport(): Pick<
  WallScreen,
  "viewportWidth" | "viewportHeight" | "devicePixelRatio"
> {
  if (typeof window === "undefined") {
    return { viewportWidth: 0, viewportHeight: 0, devicePixelRatio: 1 };
  }
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}
