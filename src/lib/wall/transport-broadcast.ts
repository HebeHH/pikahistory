/**
 * BroadcastChannel transport — a same-machine, multi-tab mock of the wall room
 * (handoff §8, Phase B). Lets three tabs behave as one combined wall for local
 * development. It does NOT work across separate laptops; the deployed version
 * swaps in a managed realtime/WebSocket transport implementing the same
 * {@link WallRoomTransport} interface.
 *
 * The room creator is the authority: it owns the screen list and answers
 * snapshots. Only the owner's token may publish camera or reorder messages.
 */
import { isNewerCamera, makeCamera, type WallCamera } from "./camera";
import type { CreateRoomResult, WallRoomMessage, WallRoomState, WallRoomTransport } from "./room-types";
import type { WallScreen } from "./screen-layout";

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function randomRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export class BroadcastChannelTransport implements WallRoomTransport {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(state: WallRoomState) => void>();
  private state: WallRoomState | null = null;
  private myScreenId = "";
  private ownerToken = "";
  private isOwner = false;

  private ensureChannel(roomCode: string): void {
    if (this.channel) return;
    if (typeof BroadcastChannel === "undefined") {
      throw new Error("BroadcastChannelTransport requires a browser environment.");
    }
    this.channel = new BroadcastChannel(`pika-wall-${roomCode}`);
    this.channel.onmessage = (event: MessageEvent) => this.handle(event.data as WallRoomMessage);
  }

  async createRoom(screen: WallScreen): Promise<CreateRoomResult> {
    const roomCode = randomRoomCode();
    this.myScreenId = screen.id || randomId("screen");
    this.ownerToken = randomId("owner");
    this.isOwner = true;
    this.ensureChannel(roomCode);
    this.state = {
      roomCode,
      ownerId: this.myScreenId,
      camera: makeCamera({ updatedBy: this.myScreenId }),
      screens: [{ ...screen, id: this.myScreenId, connected: true }],
    };
    this.emit();
    this.broadcast({ type: "room.snapshot", state: this.state });
    return { roomCode, ownerToken: this.ownerToken, screenId: this.myScreenId };
  }

  async joinRoom(roomCode: string, screen: WallScreen): Promise<{ screenId: string }> {
    this.myScreenId = screen.id || randomId("screen");
    this.ensureChannel(roomCode);
    const joined: WallScreen = { ...screen, id: this.myScreenId, connected: true };
    // Provisional local state until the owner's snapshot arrives.
    this.state = this.state ?? { roomCode, ownerId: "", camera: makeCamera(), screens: [joined] };
    this.emit();
    this.broadcast({ type: "screen.joined", screen: joined });
    return { screenId: this.myScreenId };
  }

  updateViewport(dimensions: Pick<WallScreen, "viewportWidth" | "viewportHeight">): void {
    if (!this.state) return;
    this.applyViewport(this.myScreenId, dimensions);
    this.broadcast({
      type: "screen.viewport_changed",
      screenId: this.myScreenId,
      viewportWidth: dimensions.viewportWidth,
      viewportHeight: dimensions.viewportHeight,
    });
    if (this.isOwner) this.broadcastSnapshot();
  }

  reorderScreens(screens: WallScreen[], ownerToken: string): void {
    if (!this.isOwner || ownerToken !== this.ownerToken || !this.state) return;
    this.state = { ...this.state, screens };
    this.emit();
    this.broadcast({ type: "screens.reordered", screens });
  }

  publishCamera(camera: WallCamera, ownerToken: string): void {
    // Reject camera writes that are not the authenticated owner (handoff §8).
    if (!this.isOwner || ownerToken !== this.ownerToken || !this.state) return;
    this.state = { ...this.state, camera };
    this.emit();
    this.broadcast({ type: "camera.changed", camera });
  }

  subscribe(listener: (state: WallRoomState) => void): () => void {
    this.listeners.add(listener);
    if (this.state) listener(this.state);
    return () => this.listeners.delete(listener);
  }

  disconnect(): void {
    if (this.channel && this.state) {
      this.broadcast({ type: "screen.disconnected", screenId: this.myScreenId });
    }
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
    this.state = null;
  }

  // ---- internals ----

  private handle(message: WallRoomMessage): void {
    switch (message.type) {
      case "room.snapshot":
        if (!this.isOwner) {
          this.state = message.state;
          this.emit();
        }
        break;
      case "screen.joined":
        this.addScreen(message.screen);
        if (this.isOwner) this.broadcastSnapshot();
        break;
      case "screen.viewport_changed":
        this.applyViewport(message.screenId, {
          viewportWidth: message.viewportWidth,
          viewportHeight: message.viewportHeight,
        });
        break;
      case "screen.disconnected":
        this.removeScreen(message.screenId);
        if (this.isOwner) this.broadcastSnapshot();
        break;
      case "screens.reordered":
        if (this.state) {
          this.state = { ...this.state, screens: message.screens };
          this.emit();
        }
        break;
      case "camera.changed":
        if (this.state && isNewerCamera(message.camera, this.state.camera)) {
          this.state = { ...this.state, camera: message.camera };
          this.emit();
        }
        break;
    }
  }

  private addScreen(screen: WallScreen): void {
    if (!this.state) return;
    const exists = this.state.screens.some((candidate) => candidate.id === screen.id);
    const screens = exists
      ? this.state.screens.map((candidate) => (candidate.id === screen.id ? screen : candidate))
      : [...this.state.screens, screen];
    this.state = { ...this.state, screens };
    this.emit();
  }

  private removeScreen(screenId: string): void {
    if (!this.state) return;
    this.state = {
      ...this.state,
      screens: this.state.screens.map((candidate) =>
        candidate.id === screenId ? { ...candidate, connected: false } : candidate,
      ),
    };
    this.emit();
  }

  private applyViewport(
    screenId: string,
    dimensions: Pick<WallScreen, "viewportWidth" | "viewportHeight">,
  ): void {
    if (!this.state) return;
    this.state = {
      ...this.state,
      screens: this.state.screens.map((candidate) =>
        candidate.id === screenId ? { ...candidate, ...dimensions } : candidate,
      ),
    };
    this.emit();
  }

  private broadcastSnapshot(): void {
    if (this.state) this.broadcast({ type: "room.snapshot", state: this.state });
  }

  private broadcast(message: WallRoomMessage): void {
    this.channel?.postMessage(message);
  }

  private emit(): void {
    if (!this.state) return;
    const snapshot = this.state;
    for (const listener of this.listeners) listener(snapshot);
  }
}
