# Multi-screen History Wall: implementation handoff

## Outcome

Multiple laptops placed left-to-right should behave like windows onto one large,
two-dimensional history wall. Time runs along the world x-axis. Civilizations,
people, eras, events, and relationships occupy explicit world positions on both axes.

The person who creates a wall session is its controller. The controller's pan
and zoom gestures move the shared camera on every connected laptop. Anyone may
select content, but details open only on the laptop where the selection was
made.

This document separates the multi-screen mechanics from the main visual UI so
both pieces can be developed in parallel.

## Product decisions already made

- Screens are arranged in one horizontal row, ordered left-to-right.
- Ignore physical bezels and gaps for the first version.
- Every joining laptop reports its current viewport width and height.
- The room creator owns the controller role.
- Only the controller can pan or zoom the shared wall.
- Any laptop can select an item; the resulting detail view is local, not shared.
- A disconnected screen may reconnect and recover the current camera.
- If the controller disconnects, freeze the shared camera and wait for that
  controller to reconnect. Do not transfer control automatically in v1.
- Use wheel/trackpad gestures, not zoom buttons, as the primary navigation.
- A time ruler remains fixed near the bottom of each screen. Its ticks and
  labels change to match the shared pan and zoom.

## Ownership boundary with the main UI

The main UI owner should own:

- The appearance of civilizations, people, eras, events, and relationships.
- Detail drawers/panels and their content.
- Selection hit targets and visual selected states.
- The layout rules that assign each rendered item a world-space box or point.

The multi-screen implementation should own:

- Room creation, room joining, and screen ordering.
- Viewport measurement and presence.
- The shared two-dimensional camera.
- World-to-screen and screen-to-world coordinate transforms.
- Controller-only navigation gestures.
- The fixed time ruler.
- Realtime camera synchronization and reconnect behavior.

The renderer should not know whether it is on screen 1, 2, or 3. It should
receive a camera and screen geometry, then render world items through the shared
coordinate helpers.

## 1. Establish one permanent world coordinate system

Do not use each browser's `scrollLeft` or `scrollTop` as the source of truth.
Native scrolling may still be used internally for accessibility later, but the
shared state must be a world-space camera.

Use a stable mapping from historical year to world x-coordinate:

```ts
const WORLD_UNITS_PER_YEAR = 1;

export function yearToWorldX(year: number) {
  return year * WORLD_UNITS_PER_YEAR;
}

export function worldXToYear(x: number) {
  return x / WORLD_UNITS_PER_YEAR;
}
```

Negative x-coordinates are valid and naturally represent BCE years. There is
no need to make 1 BCE and 1 CE adjacent perfectly in the first version; use the
same year convention as the existing data contract.

Each UI object must resolve to stable world geometry. Dates normally determine
x, while the visual layout determines y:

```ts
type WorldPoint = { x: number; y: number };
type WorldRect = { x: number; y: number; width: number; height: number };

type CivilizationLayout = {
  civilizationId: string;
  y: number;
  laneHeight: number;
};
```

For example:

- A civilization uses its start/end years for its horizontal span and its
  assigned civilization lane for y.
- An era uses its start/end years and sits within its civilization lane.
- An event uses its year for x and a stable position within its civilization
  lane for y.
- A relationship connects the world-space anchor points of its participants.

Keep visual layout data separate from historical record data. Moving a
civilization vertically must not modify its historical meaning.

## 2. Introduce the shared camera

Treat `camera.x` and `camera.y` as the world coordinate visible at the top-left
of the entire combined display wall, before applying the individual laptop
offset. Keep zoom uniform on x and y for v1.

```ts
type WallCamera = {
  x: number;
  y: number;
  zoom: number;
  revision: number;
  updatedBy: string;
};
```

Set sensible limits so the wall cannot disappear or overflow numerically:

```ts
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
```

The current `TimelineWall` uses a fixed `TRACK_WIDTH` and an independently
scrollable `.timeline-scroll` element. During integration, replace those as the
navigation source with a clipped viewport containing a transformed world
layer. The track's visual components can be retained while their positions are
moved to world coordinates.

## 3. Register and arrange screens

Each joining browser measures the viewport available to the wall, in CSS
pixels, and reports it to the room:

```ts
type WallScreen = {
  id: string;
  order: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  connected: boolean;
};
```

Use `ResizeObserver` to resend dimensions whenever fullscreen mode, browser
chrome, orientation, or window size changes. Use CSS pixel dimensions for all
layout math; retain `devicePixelRatio` for canvas sharpness if the renderer
eventually uses `<canvas>`.

For screens ordered left-to-right, calculate the horizontal combined-display
offset as the sum of all preceding widths:

```ts
function screenOffsetX(screen: WallScreen, screens: WallScreen[]) {
  return screens
    .filter((candidate) => candidate.order < screen.order)
    .reduce((total, candidate) => total + candidate.viewportWidth, 0);
}
```

Different heights are allowed. All screens share the same world y-coordinate;
a taller screen simply reveals more vertical content. Assume their top edges
are aligned in v1.

The join UI needs only:

1. A short room code field.
2. A left-to-right screen position/order picker.
3. A connection indicator.
4. An enter-fullscreen action.

Reject duplicate screen orders visibly, or allow the controller to reorder the
connected screens before starting display mode.

## 4. Apply the viewport transform

For a screen whose combined-display horizontal offset is `offsetX`, convert a
world point to local screen pixels with:

```ts
function worldToLocalScreen(
  point: WorldPoint,
  camera: WallCamera,
  offsetX: number,
): WorldPoint {
  return {
    x: (point.x - camera.x) * camera.zoom - offsetX,
    y: (point.y - camera.y) * camera.zoom,
  };
}
```

The inverse transform is:

```ts
function localScreenToWorld(
  point: WorldPoint,
  camera: WallCamera,
  offsetX: number,
): WorldPoint {
  return {
    x: camera.x + (offsetX + point.x) / camera.zoom,
    y: camera.y + point.y / camera.zoom,
  };
}
```

Put these helpers in a small standalone module and unit-check them with a few
known examples, even if the hackathon does not add a full test suite. All
rendering, hit testing, zoom anchoring, and ruler calculations should use these
same functions.

Clip each laptop's viewport with `overflow: hidden`. Render the world layer
using one CSS transform where possible instead of recalculating every item's
pixel position on every camera update:

```css
.wall-viewport {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.world-layer {
  position: absolute;
  transform-origin: 0 0;
}
```

The exact transform depends on whether item coordinates are emitted as raw
world coordinates or pre-offset coordinates. Pick one approach and route all
math through the shared helpers; do not mix CSS scrolling and camera movement.

## 5. Add controller-only pan and zoom gestures

Only attach active navigation behavior when `localScreen.id === room.ownerId`.
Follower screens may receive pointer events for selection, but their wheel,
trackpad, and drag gestures must not mutate the camera.

Recommended controls:

- Trackpad two-finger movement pans freely using `deltaX` and `deltaY`.
- A conventional mouse wheel pans vertically.
- Shift + mouse wheel pans horizontally.
- Pinch or Ctrl/Cmd + wheel zooms around the pointer.
- Pointer-dragging empty wall space may be added as a pan fallback.

Normalize wheel deltas before applying them because browsers may report pixels,
lines, or pages through `WheelEvent.deltaMode`. Do not call `preventDefault()`
on every screen; use it only inside the controller's active wall viewport.

For pointer-anchored zoom, first find the world point under the pointer. After
choosing the new zoom, adjust the camera so that point remains under the same
physical pointer position:

```ts
const globalPointerX = offsetX + localPointerX;
const anchorWorldX = camera.x + globalPointerX / camera.zoom;
const anchorWorldY = camera.y + localPointerY / camera.zoom;

const nextZoom = clamp(camera.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);

const nextCamera = {
  ...camera,
  zoom: nextZoom,
  x: anchorWorldX - globalPointerX / nextZoom,
  y: anchorWorldY - localPointerY / nextZoom,
};
```

Use `requestAnimationFrame` for local rendering. Throttle network camera
updates to roughly 20-30 messages per second and always send a final update at
the end of a gesture.

## 6. Build the fixed time ruler as a screen overlay

The time ruler is not part of `.world-layer`; it is fixed near the bottom of
each laptop's viewport. It changes labels based on the portion of world visible
behind that particular screen.

At any local ruler x-position:

```ts
const worldX = camera.x + (offsetX + localX) / camera.zoom;
const year = worldXToYear(worldX);
```

Choose tick intervals dynamically so labels remain readable. Select from a
fixed list such as:

```ts
const YEAR_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
```

Pick the smallest step that leaves approximately 80-140 pixels between major
labels at the current zoom. Use the same global multiples on every laptop so a
tick crossing a screen boundary remains continuous.

The ruler should:

- Remain fixed during vertical movement.
- Update during horizontal movement and zoom.
- Format negative years as BCE and positive years as CE.
- Sit above the world renderer but below local modal/detail UI.
- Avoid rendering a historical year zero label if the existing product
  convention does not use year zero.

## 7. Keep selection local

Do not put `selectedId` in the room camera or presence state for v1.

Each `ScreenViewport` owns its own selection:

```ts
const [selectedRecord, setSelectedRecord] = useState<HistoryWallRecord>();
```

Clicking an item on any laptop opens the detail drawer or detail viewport only
there. Closing it is also local. The drawer must sit outside the transformed
world layer so it remains readable and does not scale with the map.

A future explicit **Focus wall here** command may allow the controller to move
the shared camera to a selected item, but ordinary selection must never move
the wall.

## 8. Add room synchronization behind a transport interface

Prove the renderer and coordinate math before choosing or integrating the final
realtime provider. Keep provider-specific code behind a small interface:

```ts
type WallRoomTransport = {
  createRoom(): Promise<{ roomCode: string; ownerToken: string }>;
  joinRoom(roomCode: string, screen: WallScreen): Promise<void>;
  updateViewport(dimensions: Pick<WallScreen, "viewportWidth" | "viewportHeight">): void;
  publishCamera(camera: WallCamera, ownerToken: string): void;
  subscribe(listener: (state: WallRoomState) => void): () => void;
  disconnect(): void;
};
```

Cross-laptop camera motion needs a realtime network transport. `BroadcastChannel`
is useful for a same-machine multi-tab prototype but does not work across the
team's laptops. The deployed version should use a Vercel-compatible managed
realtime/WebSocket service rather than holding long-lived WebSockets inside a
normal Next.js serverless route.

Minimum room state:

```ts
type WallRoomState = {
  roomCode: string;
  ownerId: string;
  camera: WallCamera;
  screens: WallScreen[];
};
```

Minimum message types:

- `screen.joined`
- `screen.viewport_changed`
- `screen.disconnected`
- `screens.reordered`
- `camera.changed`
- `room.snapshot`

The realtime service must reject camera updates that are not authenticated as
coming from the room owner. Hiding controls on follower screens is not enough.
Use monotonically increasing camera revisions and ignore older updates that
arrive out of order.

## 9. Handle reconnects and visual smoothing

When any follower reconnects:

1. Rejoin with its stable screen ID and room code.
2. Resend its latest viewport dimensions.
3. Receive the complete room snapshot, including screen order and camera.
4. Render immediately at that camera.
5. Resume interpolation for subsequent camera messages.

Between remote camera updates, followers should interpolate toward the newest
camera using `requestAnimationFrame`. Do not apply a long easing animation to
stale positions; the aim is to hide network stepping while staying close to the
controller.

When the owner disconnects:

- Show a small `Controller disconnected` indicator.
- Keep the last camera exactly where it was.
- Preserve selections and allow local details to close/open.
- Restore control when the same owner reconnects with the owner token.

## 10. Integrate without blocking the visual redesign

Suggested modules; names may be adapted to the UI owner's component structure:

```text
src/
  components/
    wall/
      HistoryWorld.tsx          # supplied/owned mainly by UI work
      ScreenViewport.tsx        # clips one laptop's view
      FixedTimeRuler.tsx        # local fixed overlay
      WallJoinPanel.tsx         # room and screen-order UI
  lib/
    wall/
      coordinates.ts            # year/world/screen conversions
      camera.ts                 # pan, zoom, clamping
      screen-layout.ts          # offsets from reported viewport widths
      room-types.ts             # provider-neutral room contracts
      transport.ts              # provider-neutral interface
```

The useful integration contract is:

```ts
type ScreenViewportProps = {
  camera: WallCamera;
  localScreen: WallScreen;
  screens: WallScreen[];
  canNavigate: boolean;
  children: React.ReactNode; // world-space UI supplied by the main UI owner
};
```

Avoid a large rewrite of the UI owner's in-progress files. Implement coordinate
helpers, camera behavior, ruler, and the mock room in new modules first. Replace
the current fixed track/scroll wrapper only during an agreed integration pass.

## Delivery plan

### Phase A: one-browser camera prototype

1. Extract year/world coordinate helpers.
2. Create a clipped `ScreenViewport` and transformed world layer.
3. Move both x and y with a local camera.
4. Add controller wheel/trackpad pan and pointer-anchored zoom.
5. Add the fixed adaptive time ruler.

**Exit check:** One browser can smoothly navigate the full 2D wall, and the
ruler remains fixed while showing the correct years.

### Phase B: simulated three-screen wall

1. Add a mock room transport using `BroadcastChannel` or shared local debug
   state.
2. Open three tabs using a debug query such as `?room=demo&screen=0`.
3. Give each tab its real reported dimensions and a distinct screen order.
4. Verify that objects crossing the right edge of one tab continue at the left
   edge of the next.
5. Verify that controller zoom stays anchored correctly even when the pointer
   is on screen 2 or 3.
6. Verify that selections and detail drawers remain local.

**Exit check:** Three tabs behave as one combined 2D display with only one
controller.

### Phase C: actual laptop room

1. Implement create/join room flows through the chosen realtime provider.
2. Secure camera publishing with the owner token.
3. Send presence, dimensions, order, snapshots, and camera revisions.
4. Test three laptops on different networks or the same Wi-Fi.
5. Add reconnect handling and owner-disconnected state.

**Exit check:** Three laptops can join by code, line up left-to-right, enter
fullscreen, and pan/zoom as one wall.

### Phase D: demo polish

1. Add a simple screen-order/reorder view.
2. Add fullscreen and connection status controls.
3. Tune zoom limits, pan speed, network throttling, and interpolation.
4. Hide editing chrome in wall display mode while keeping local detail UI.
5. Test mixed viewport widths and heights.

## Acceptance checklist

- [ ] Time maps consistently to world x-coordinates.
- [ ] Civilizations and other items have stable world y-coordinates.
- [ ] Shared pan moves both x and y on every connected screen.
- [ ] Shared zoom scales both axes and stays anchored under the pointer.
- [ ] Screens display adjacent slices rather than duplicated views.
- [ ] Joining and resizing a screen updates the combined offsets.
- [ ] Only the room creator can publish camera changes.
- [ ] Any screen can select an item.
- [ ] Details open only on the selecting screen.
- [ ] The time ruler remains fixed and displays locally correct years.
- [ ] Followers recover the current camera after reconnecting.
- [ ] The wall freezes safely if the controller disconnects.
- [ ] The primary path works with trackpads and mouse wheels.
- [ ] The existing historical record contract remains unchanged.

## Deliberately deferred

- Physical bezel/gap calibration.
- Multiple rows or irregular arrangements of screens.
- Automatic controller transfer.
- Simultaneous multi-user navigation.
- Shared selections or synchronized detail drawers.
- Persisting room state after the session ends.
- Independent x-axis and y-axis zoom.
- Canvas/WebGL optimization unless DOM rendering proves too slow.

