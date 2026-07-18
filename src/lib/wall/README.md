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
| `transport-broadcast.ts` | legacy same-machine multi-tab mock retained for isolated mechanics work |
| `session-client.ts` | production create/join/recover API and Ably realtime adapter |
| `presence.ts` | stable per-user sprite hue assignment |
| `use-wall-room.ts` | headless React hook: `state`, `camera`, `canNavigate`, create/join/publish |

## Integration contract

UI owner renders world content and consumes the camera:

```tsx
const { camera, canNavigate, publishCamera, state, myScreenId } = useWallRoom();
// position each item with worldToLocalScreen(itemWorldPoint, camera, offsetX)
// only publish camera changes when canNavigate is true
```

## Real backend integration

The real multi-screen page is `src/app/wall/page.tsx`, backed by
`src/components/wall/wall-session-app.tsx`. It uses `session-client.ts` directly:

- Next.js + Neon create rooms, register screens, authenticate the controller,
  and persist final camera snapshots.
- Ably carries throttled camera frames and presence.
- The server gives followers subscribe-only camera capability.
- Each laptop renders one clipped `ScreenViewport`; it never renders three fake
  laptop frames on one page.

Set `ABLY_API_KEY`, apply the Drizzle schema with `pnpm db:push`, and open
`/wall`. The first laptop chooses **Create room code**; the others enter that
code and choose their left-to-right screen position.

## Legacy local mock

`use-wall-room.ts`, `create-transport.ts`, and `transport-broadcast.ts` remain as
a no-backend mechanics harness. They are not imported by the production
`/wall` route.
