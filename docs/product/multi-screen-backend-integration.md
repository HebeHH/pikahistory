# Multi-screen backend and UI integration guide

This is the implementation handoff for connecting the History Wall UI to the
multi-screen room backend. The underlying visual layout is described separately
in [`multi-screen-wall-handoff.md`](./multi-screen-wall-handoff.md).

## What requires the backend

The backend owns the parts that must be trusted, shared, or recoverable:

- Creating a temporary room and its eight-character invitation code.
- Establishing the creating screen as the sole controller.
- Giving every screen an unguessable reconnect credential.
- Registering screen order, viewport dimensions, and device pixel ratio.
- Preventing followers from publishing camera movement.
- Issuing short-lived, room-scoped Ably credentials without exposing the Ably
  API key to a browser.
- Persisting the latest camera snapshot so a joining/reconnecting screen starts
  at the correct position.
- Rejecting stale camera revisions and duplicate screen positions.
- Expiring rooms after 12 hours.

The backend does **not** render the wall, interpolate movement, interpret wheel
gestures, calculate screen offsets, or store local selections. Those remain in
the UI.

## Implemented architecture

Two paths work together:

1. **Next.js API + Neon:** room identity, screen registration, authorization,
   viewport metadata, and recoverable camera snapshots.
2. **Ably realtime:** transient camera frames and live screen presence.

Do not send every camera frame to Postgres. During a gesture, the controller
publishes frames directly to Ably at approximately 20-30 Hz. At gesture end it
persists one final camera through the API.

```text
Controller gesture
  ├─ camera frames ──────────────> Ably ─────> follower displays
  └─ final camera at gesture end -> API/Neon -> reconnect snapshot

Every display
  ├─ create/join/recover --------> API/Neon
  ├─ viewport update ------------> API/Neon
  └─ live presence --------------> Ably presence
```

The server issues different Ably capabilities:

| Role | Camera channel | Presence channel |
| --- | --- | --- |
| Controller | publish + subscribe | presence + subscribe |
| Display | subscribe only | presence + subscribe |

Calling `publishCamera` from a follower is therefore rejected by Ably even if
someone bypasses the disabled UI controls.

## Code supplied to the UI

The UI should import only from:

```ts
import {
  connectWallRealtime,
  createWallRoom,
  joinWallRoom,
  measureWallViewport,
  persistWallCamera,
  recoverWallRoom,
  updateWallScreen,
} from "@/lib/wall/session-client";
```

Shared runtime schemas and TypeScript types are exported from:

```ts
import type {
  WallCamera,
  WallCredential,
  WallPresenceData,
  WallRoomSnapshot,
  WallSessionBootstrap,
} from "@/contracts/wall-session.schema";
```

Provider credentials, database access, and authorization decisions are not part
of the UI component tree.

## Backend routes

All responses use the existing `{ "apiVersion": "v1", "data": ... }` envelope.
Errors use `{ "apiVersion": "v1", "error": { "code", "message" } }`.

| Method and route | Authentication | Purpose |
| --- | --- | --- |
| `POST /api/v1/wall/rooms` | None | Create room and controller screen |
| `POST /api/v1/wall/rooms/:code/join` | Room code | Register a follower display |
| `GET /api/v1/wall/rooms/:code` | Screen bearer token | Recover current room snapshot |
| `PATCH /api/v1/wall/rooms/:code/screens/:screenId` | Screen bearer token | Update viewport/order |
| `POST /api/v1/wall/rooms/:code/camera` | Controller bearer token | Persist final camera snapshot |
| `POST /api/v1/wall/rooms/:code/realtime-token` | Screen bearer token | Obtain scoped Ably TokenRequest |

The browser adapter calls these routes; UI code normally should not call them
with raw `fetch`.

## One-time deployment setup

### 1. Apply the database schema

Two tables and two enums were added to `src/lib/db/schema.ts`:

- `wall_rooms`
- `wall_screens`
- `wall_room_status`
- `wall_screen_role`

Apply them locally or to the selected Vercel/Neon environment:

```bash
pnpm db:push
```

Review Drizzle's SQL before confirming the production schema push.

### 2. Create an Ably app and API key

Create an Ably app and a server-side API key. Its capabilities must include
`publish`, `subscribe`, and `presence` for `history-wall:*` channels. The
backend reduces those capabilities for each browser token.

Set the secret locally and in Vercel:

```dotenv
ABLY_API_KEY=appId.keyId:keySecret
```

Never prefix it with `NEXT_PUBLIC_` and never send it to a client. Ably's
official guidance recommends server-issued token authentication for browsers;
the included realtime-token route follows that model. See Ably's official
[authentication overview](https://ably.com/docs/auth),
[token authentication guide](https://ably.com/docs/auth/token), and
[presence documentation](https://ably.com/docs/presence-occupancy/presence).

### 3. Install dependencies and deploy

`ably` is already declared in `package.json` and `pnpm-lock.yaml`.

```bash
pnpm install
pnpm build
```

Deploy after both `DATABASE_URL` and `ABLY_API_KEY` are configured.

## UI lifecycle

### 1. Measure the available display viewport

For a fullscreen wall occupying the browser window:

```ts
const viewport = measureWallViewport();
```

If the wall occupies only part of the page, report that element's rounded
`clientWidth`/`clientHeight` instead. All dimensions are CSS pixels. Do not send
physical pixels (`width * devicePixelRatio`).

### 2. Create or join

The room creator:

```ts
const bootstrap = await createWallRoom({
  viewport,
  screenOrder: 0,
  initialCamera: { x: -3200, y: 0, zoom: 0.35 },
});
```

A joining laptop:

```ts
const bootstrap = await joinWallRoom(roomCode, {
  viewport,
  screenOrder: 1,
});
```

If `screenOrder` is omitted when joining, the server chooses the next position.
An explicitly occupied position returns `409 screen_order_taken`.

The bootstrap response contains:

```ts
type WallSessionBootstrap = {
  credential: {
    screenId: string;
    token: string;
    role: "controller" | "display";
  };
  room: WallRoomSnapshot;
  realtime: {
    provider: "ably";
    authUrl: string;
    cameraChannel: string;
    presenceChannel: string;
    cameraEvent: "camera.changed";
    screenEvent: "screen.changed";
  };
};
```

Show `bootstrap.room.roomCode` to the creator as the invitation code.

### 3. Save the reconnect identity locally

Persist the whole bootstrap identity under a room-specific localStorage key:

```ts
localStorage.setItem(
  `history-wall:${bootstrap.room.roomCode}`,
  JSON.stringify({
    credential: bootstrap.credential,
    realtime: bootstrap.realtime,
  }),
);
```

The raw credential is returned only when a screen is created. It is stored as a
SHA-256 hash in Postgres. Treat the raw value as session-sensitive and do not
put it in URLs, analytics, or logs.

If the controller loses its local credential, it cannot silently reclaim
controller status. Create a new room for v1.

### 4. Recover after reload or network loss

Read the stored credential and request the durable snapshot:

```ts
const room = await recoverWallRoom(roomCode, credential.token);
```

Render this camera immediately before connecting to realtime. It prevents a
reconnecting screen from briefly showing the default position.

If recovery returns `410 room_expired`, discard the local identity and return
to the create/join view.

### 5. Connect realtime and enter presence

```ts
const realtime = connectWallRealtime(bootstrap.realtime, bootstrap.credential);

const localScreen = bootstrap.room.screens.find(
  (screen) => screen.id === bootstrap.credential.screenId,
)!;

const presence: WallPresenceData = {
  screenId: localScreen.id,
  role: localScreen.role,
  screenOrder: localScreen.screenOrder,
  viewport: localScreen.viewport,
};

await realtime.enterPresence(presence);
```

The adapter automatically calls the backend auth route when Ably needs a token
and refreshes it through the same callback. Close the connection during React
effect cleanup:

```ts
return () => realtime.close();
```

### 6. Subscribe to shared camera frames

```ts
const unsubscribeCamera = await realtime.subscribeToCamera((incoming) => {
  setCamera((current) => {
    if (incoming.revision <= current.revision) return current;
    return incoming;
  });
});
```

In the finished renderer, set a target camera here and interpolate toward it in
`requestAnimationFrame` rather than snapping on each network message. The
revision comparison remains mandatory because messages or a reconnect snapshot
may arrive out of order.

Call `unsubscribeCamera()` during effect cleanup.

### 7. Detect connected and disconnected screens

```ts
const refreshPresence = async () => {
  const activeScreens = await realtime.getPresence();
  setActiveScreenIds(new Set(activeScreens.map((screen) => screen.screenId)));
};

const unsubscribePresence = await realtime.subscribeToPresence(refreshPresence);
await refreshPresence();
```

The durable `room.screens` list defines the layout and preserves each screen's
space during a temporary disconnect. Presence determines which registered
screens are currently online.

If `room.ownerScreenId` is absent from the active presence set:

- Show **Controller disconnected**.
- Keep the last camera unchanged.
- Keep local selection working.
- Do not promote a follower.

Ably automatically restores the connection; after re-entering presence, the
controller resumes publishing.

### 8. Report viewport changes

Observe the actual viewport with `ResizeObserver`. Debounce updates by roughly
150-300 ms:

```ts
const result = await updateWallScreen(
  roomCode,
  credential.screenId,
  credential.token,
  { viewport: nextViewport },
);

await realtime.updatePresence({
  screenId: result.screen.id,
  role: result.screen.role,
  screenOrder: result.screen.screenOrder,
  viewport: result.screen.viewport,
});
```

Other screens receive the presence update and should merge the new viewport
into their local screen list. The API remains authoritative and enforces the
dimension limits.

The controller may update any screen's order through `updateWallScreen`.
Followers may update only themselves.

When the controller changes another screen's order, publish the returned screen
so every connected display can merge it immediately:

```ts
await realtime.publishScreenUpdate(result.screen);
```

Every display subscribes once during setup:

```ts
const unsubscribeScreens = await realtime.subscribeToScreenUpdates((screen) => {
  setRoom((current) => ({
    ...current,
    screens: current.screens.map((candidate) =>
      candidate.id === screen.id ? screen : candidate,
    ),
  }));
});
```

Only the controller has permission to publish `screen.changed`. A display's own
resize continues to propagate through its authenticated presence update.

### 9. Enable navigation only for the controller

```ts
const canNavigate =
  credential.role === "controller" &&
  credential.screenId === room.ownerScreenId;
```

Only attach active wheel/trackpad camera handlers when `canNavigate` is true.
All screens may retain click handlers for local selection.

The authorization backend is the final enforcement layer; `canNavigate` is for
correct UX, not security.

### 10. Publish and persist camera movement

For every network-throttled controller frame, increase the revision and include
the controller identity and client timestamp:

```ts
const sharedCamera: WallCamera = {
  ...nextPosition,
  revision: previousCamera.revision + 1,
  updatedBy: credential.screenId,
  updatedAt: new Date().toISOString(),
};

setCamera(sharedCamera);               // render controller immediately
await realtime.publishCamera(sharedCamera); // send to followers
```

Do not await `publishCamera` before rendering the controller locally. Queue or
throttle network sends so pointer movement remains responsive.

At wheel/pinch/drag end, and periodically during unusually long gestures,
persist the latest state:

```ts
await persistWallCamera(roomCode, credential.token, {
  x: sharedCamera.x,
  y: sharedCamera.y,
  zoom: sharedCamera.zoom,
  revision: sharedCamera.revision,
});
```

A follower calling either publish path is rejected. A camera persistence call
whose revision is not greater than the stored value returns
`409 stale_camera_revision` and includes the current durable camera in error
issues.

## Calculating each screen's viewport slice

Sort the durable screens by `screenOrder`. Preserve disconnected screens in
this calculation so a brief network loss does not cause every later laptop to
jump left.

```ts
function getScreenOffsetX(localScreenId: string, screens: WallScreen[]) {
  const ordered = [...screens].sort((a, b) => a.screenOrder - b.screenOrder);
  let offset = 0;

  for (const screen of ordered) {
    if (screen.id === localScreenId) return offset;
    offset += screen.viewport.width;
  }

  throw new Error("Local screen is missing from the room snapshot");
}
```

With `camera.x`/`camera.y` representing the top-left world coordinate of the
combined display, transform world coordinates into local pixels as documented
in the visual handoff:

```ts
localX = (worldX - camera.x) * camera.zoom - screenOffsetX;
localY = (worldY - camera.y) * camera.zoom;
```

The fixed time ruler uses the inverse x transform:

```ts
worldX = camera.x + (screenOffsetX + localX) / camera.zoom;
```

## Recommended React ownership

Keep shared/realtime room state above the visual renderer, while selection
stays inside each browser:

```text
WallSessionProvider
├── room snapshot
├── credential and controller permission
├── realtime connection and presence
├── shared camera target
└── ScreenViewport
    ├── transformed HistoryWorld
    ├── fixed TimeRuler
    ├── local selection state
    └── local DetailDrawer
```

Do not place `selectedRecord` in Ably, the room API, or the camera.

## Important error states for the UI

| Code | UI response |
| --- | --- |
| `room_not_found` | Check the invitation code |
| `room_expired` | Clear stored identity; create/join another room |
| `room_full` | Room already has 12 registered screens |
| `screen_order_taken` | Choose another left-to-right position |
| `invalid_wall_credential` | Clear stale local identity and rejoin |
| `camera_update_forbidden` | Disable navigation; current screen is not controller |
| `stale_camera_revision` | Adopt returned durable camera, then continue above its revision |
| `realtime_not_configured` | Configure `ABLY_API_KEY` on the server |

## Integration acceptance test

Before merging the UI integration, verify:

1. Laptop A creates a room and visibly receives the controller role.
2. Laptops B and C join with consecutive screen positions.
3. All three enter Ably presence and show as connected.
4. A controller pan changes both x and y on all three screens.
5. Controller zoom remains anchored and all screens use one camera revision.
6. A follower cannot pan/zoom and cannot publish a camera through devtools.
7. Clicking a record opens details only on that laptop.
8. Resizing one laptop updates downstream horizontal offsets.
9. Disconnecting a follower leaves its screen slice reserved.
10. Reconnecting a follower restores the durable camera before live updates.
11. Disconnecting the controller freezes the wall and shows the status.
12. Reconnecting the controller restores control without changing owner.
13. Reloading all screens after a completed gesture restores the final camera.

## Relevant implementation files

- `src/contracts/wall-session.schema.ts` — shared validation and types
- `src/lib/db/schema.ts` — room/screen database schema
- `src/lib/db/wall-sessions.ts` — room logic and authorization
- `src/lib/realtime/ably-wall.ts` — least-privilege realtime tokens
- `src/lib/wall/session-client.ts` — UI-facing browser adapter
- `src/app/api/v1/wall/rooms/**` — HTTP routes
