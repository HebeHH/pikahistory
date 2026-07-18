import type { WallScreen } from "./screen-layout";

/**
 * Per-user presence styling. Each connected laptop gets its own Pikachu sprite;
 * this assigns a stable hue/index per screen so the number of sprites matches
 * the number of users. The sprite artwork itself is the UI owner's; this only
 * decides which variant belongs to whom.
 */
const SPRITE_HUES = [48, 210, 140, 320, 20, 265, 175, 0];

export interface ScreenPresence {
  screenId: string;
  order: number;
  hue: number;
  isSelf: boolean;
  connected: boolean;
}

export function presenceForScreens(screens: WallScreen[], selfId: string): ScreenPresence[] {
  return [...screens]
    .sort((a, b) => a.order - b.order)
    .map((screen, index) => ({
      screenId: screen.id,
      order: screen.order,
      hue: SPRITE_HUES[index % SPRITE_HUES.length],
      isSelf: screen.id === selfId,
      connected: screen.connected,
    }));
}
