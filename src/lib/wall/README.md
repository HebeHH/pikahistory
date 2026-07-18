# Wall mechanics (`src/lib/wall`)

Design-agnostic multi-screen plumbing from
`docs/product/multi-screen-wall-handoff.md`. These modules own coordinates,
camera, screen layout, and the room transport. They render **nothing** — the UI
owner supplies world-space visuals; the backend owner supplies the realtime
transport.

## Modules

| File | Responsibility |
|------|----------------|
| `coordinates.ts` | year ↔ world x, and world ↔ local-screen transforms (route ALL positioning through these) |
| `camera.ts` | `WallCamera` type, clamp, pan, pointer-anchored zoom, follower interpolation |
| `screen-layout.ts` | `WallScreen`, left-to-right offsets, viewport measurement |
| `ruler-scale.ts` | adaptive tick step + visible-year range (visual is UI-owned) |
| `room-types.ts` | `WallRoomState`, message types, `WallRoomTransport` interface |
| `transport-broadcast.ts` | same-machine multi-tab mock (Phase B) |
| `create-transport.ts` | **single swap point** for the real backend transport |
| `presence.ts` | stable per-user sprite hue assignment |
| `use-wall-room.ts` | headless React hook: `state`, `camera`, `canNavigate`, create/join/publish |

## Integration contract

UI owner renders world content and consumes the camera:

```tsx
const { camera, canNavigate, publishCamera, state, myScreenId } = useWallRoom();
// position each item with worldToLocalScreen(itemWorldPoint, camera, offsetX)
// only publish camera changes when canNavigate is true
```

## Swapping in the real backend

Implement `WallRoomTransport` against the managed realtime provider and return it
from `createWallTransport()`. Nothing else changes. The transport MUST reject
camera writes whose owner token is invalid and ignore stale camera revisions.

## Local multi-tab test (no backend needed)

Two tabs on the same machine share a `BroadcastChannel`: create a room in tab 1,
join with its code in tab 2 (different screen order). The math is unit-checked
for roundtrip, pointer-anchored zoom, and screen-boundary continuity.
