/**
 * Shared wall camera: the world coordinate visible at the top-left of the whole
 * combined display, plus a uniform zoom. See handoff §2 and §5.
 *
 * Only the room controller mutates the camera; followers receive it. Use the
 * monotonically increasing `revision` to ignore out-of-order updates.
 */
export interface WallCamera {
  x: number;
  y: number;
  zoom: number;
  revision: number;
  updatedBy: string;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export function makeCamera(partial: Partial<WallCamera> = {}): WallCamera {
  return {
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    zoom: clampZoom(partial.zoom ?? 1),
    revision: partial.revision ?? 0,
    updatedBy: partial.updatedBy ?? "",
  };
}

/** Pan by a delta measured in local screen pixels. */
export function panByScreenDelta(
  camera: WallCamera,
  deltaX: number,
  deltaY: number,
  updatedBy: string,
): WallCamera {
  return {
    ...camera,
    x: camera.x + deltaX / camera.zoom,
    y: camera.y + deltaY / camera.zoom,
    revision: camera.revision + 1,
    updatedBy,
  };
}

/**
 * Zoom around a pointer so the world point under the pointer stays under the
 * same physical pixel. `globalPointerX` is `offsetX + localPointerX`;
 * `localPointerY` is the pointer y within the local screen. (handoff §5)
 */
export function zoomAtPointer(
  camera: WallCamera,
  globalPointerX: number,
  localPointerY: number,
  zoomFactor: number,
  updatedBy: string,
): WallCamera {
  const anchorWorldX = camera.x + globalPointerX / camera.zoom;
  const anchorWorldY = camera.y + localPointerY / camera.zoom;
  const nextZoom = clampZoom(camera.zoom * zoomFactor);
  return {
    x: anchorWorldX - globalPointerX / nextZoom,
    y: anchorWorldY - localPointerY / nextZoom,
    zoom: nextZoom,
    revision: camera.revision + 1,
    updatedBy,
  };
}

/** Accept a remote camera only if it is newer (higher revision). */
export function isNewerCamera(incoming: WallCamera, current: WallCamera): boolean {
  return incoming.revision > current.revision;
}

/**
 * Interpolate a follower's rendered camera toward the newest camera to hide
 * network stepping (handoff §9). Zoom is interpolated in log space so it feels
 * uniform. `t` is a 0..1 blend factor per animation frame.
 */
export function lerpCamera(from: WallCamera, to: WallCamera, t: number): WallCamera {
  const k = Math.max(0, Math.min(1, t));
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
    zoom: Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * k),
    revision: to.revision,
    updatedBy: to.updatedBy,
  };
}
