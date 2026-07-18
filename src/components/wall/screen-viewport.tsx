"use client";

import { useEffect, useRef, type ReactNode } from "react";

import type { WallCamera } from "@/lib/wall/camera";
import { panByScreenDelta, zoomAtPointer } from "@/lib/wall/camera";
import { screenOffsetX, type WallScreen } from "@/lib/wall/screen-layout";

/**
 * Clips one laptop's slice of the shared wall and renders the UI owner's
 * world-space `children` through a single CSS transform derived from the shared
 * camera (handoff §4). The renderer inside does not know which screen it is on;
 * it positions items at raw world coordinates and this transform places them.
 *
 * Only the controller (`canNavigate`) attaches pan/zoom gestures; followers
 * receive the camera and stay read-only.
 */
export interface ScreenViewportProps {
  camera: WallCamera;
  localScreen: WallScreen;
  screens: WallScreen[];
  canNavigate: boolean;
  onCameraChange?: (camera: WallCamera) => void;
  children: ReactNode;
}

function normalizeWheel(event: WheelEvent): { x: number; y: number } {
  const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
  return { x: event.deltaX * factor, y: event.deltaY * factor };
}

export default function ScreenViewport({
  camera,
  localScreen,
  screens,
  canNavigate,
  onCameraChange,
  children,
}: ScreenViewportProps) {
  const ref = useRef<HTMLDivElement>(null);
  const offsetX = screenOffsetX(localScreen, screens);

  // Keep the freshest values available to the native (non-passive) wheel handler.
  const latest = useRef({ camera, offsetX, canNavigate, onCameraChange });
  latest.current = { camera, offsetX, canNavigate, onCameraChange };

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      const { camera: cam, offsetX: off, canNavigate: canNav, onCameraChange: emit } = latest.current;
      if (!canNav || !emit) return;
      event.preventDefault(); // only inside the controller's viewport (handoff §5)

      const rect = node.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const delta = normalizeWheel(event);

      if (event.ctrlKey || event.metaKey) {
        const zoomFactor = Math.exp(-delta.y * 0.0015);
        emit(zoomAtPointer(cam, off + localX, localY, zoomFactor, localScreen.id));
      } else {
        const dx = event.shiftKey ? delta.y : delta.x;
        const dy = event.shiftKey ? 0 : delta.y;
        emit(panByScreenDelta(cam, dx, dy, localScreen.id));
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [localScreen.id]);

  return (
    <div
      ref={ref}
      className="wall-viewport"
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", touchAction: "none" }}
    >
      <div
        className="world-layer"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transformOrigin: "0 0",
          transform: `translate(${-offsetX}px, 0px) scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)`,
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
