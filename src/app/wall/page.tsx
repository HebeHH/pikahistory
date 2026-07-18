"use client";

import { useState } from "react";

import type { HistoryWallData } from "@/contracts/history-wall.types";
import { loadInitialData } from "@/lib/history-wall/load-seed";
import { makeCamera, type WallCamera } from "@/lib/wall/camera";
import { yearToWorldX } from "@/lib/wall/coordinates";
import { presenceForScreens, type ScreenPresence } from "@/lib/wall/presence";
import type { WallScreen } from "@/lib/wall/screen-layout";
import ScreenViewport from "@/components/wall/screen-viewport";
import PikaSprite from "@/components/history-wall/pika-sprite";

const data: HistoryWallData = loadInitialData();

const SCREEN_W = 340;
const SCREEN_H = 470;
const SELF_ID = "screen_0";

const screens: WallScreen[] = [0, 1, 2].map((order) => ({
  id: `screen_${order}`,
  order,
  viewportWidth: SCREEN_W,
  viewportHeight: SCREEN_H,
  devicePixelRatio: 1,
  connected: true,
}));

function WorldLayer() {
  return (
    <>
      {data.civilizations.map((civ, i) => {
        const x = yearToWorldX(civ.span.startYear);
        const end = yearToWorldX(civ.span.endYear ?? civ.span.startYear);
        const y = 70 + i * 54;
        return (
          <div key={civ.id} style={{ position: "absolute", left: x, top: y, width: Math.max(end - x, 20) }}>
            <div style={{ height: 9, borderRadius: 5, background: civ.color }} />
            <div
              className="font-serif"
              style={{ position: "absolute", top: -18, left: 0, whiteSpace: "nowrap", fontSize: 11, fontWeight: 600, color: "#3a342b" }}
            >
              {civ.title}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function WallPage() {
  // One shared camera drives all three screens (stands in for the room camera).
  const [camera, setCamera] = useState<WallCamera>(() =>
    makeCamera({ x: yearToWorldX(-3000), y: 0, zoom: 0.2, updatedBy: SELF_ID }),
  );
  const presence = presenceForScreens(screens, SELF_ID);

  return (
    <main style={{ minHeight: "100vh", background: "var(--app-bg)", padding: 20 }}>
      {/* Session bar */}
      <div
        className="flex items-center justify-between"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 16px", marginBottom: 16 }}
      >
        <div className="flex items-center gap-3">
          <span className="font-serif" style={{ fontSize: 18, fontWeight: 700 }}>Wall session</span>
          <span className="font-mono" style={{ fontSize: 12, background: "var(--app-bg)", border: "1px solid var(--line)", borderRadius: 6, padding: "3px 8px" }}>
            ROOM 7Q2
          </span>
        </div>
        <div className="flex items-center gap-2">
          {presence.map((p) => (
            <PresenceAvatar key={p.screenId} p={p} />
          ))}
          <span className="font-mono" style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
            Controller: You · scroll to pan, ⌘+scroll to zoom
          </span>
        </div>
      </div>

      {/* Three laptops in a row = one continuous wall */}
      <div className="flex" style={{ gap: 14, justifyContent: "center" }}>
        {screens.map((screen, i) => (
          <div
            key={screen.id}
            style={{ width: SCREEN_W, height: SCREEN_H, position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line-4)", background: "linear-gradient(180deg, var(--timeline-from), var(--timeline-to))", boxShadow: "0 8px 24px rgba(43,38,32,.14)" }}
          >
            <ScreenViewport camera={camera} localScreen={screen} screens={screens} canNavigate={i === 0} onCameraChange={setCamera}>
              <WorldLayer />
            </ScreenViewport>

            {/* Role badge (local overlay) */}
            <div
              className="font-mono"
              style={{ position: "absolute", top: 8, left: 8, fontSize: 9, letterSpacing: ".1em", padding: "3px 7px", borderRadius: 999, background: i === 0 ? "var(--accent)" : "var(--surface)", color: i === 0 ? "var(--text)" : "var(--muted)", border: "1px solid var(--line)" }}
            >
              {i === 0 ? "CONTROLLER" : "FOLLOWER"} · SCREEN {i + 1}
            </div>

            {/* Per-user mascot (local overlay, one Volt per person) */}
            <div style={{ position: "absolute", left: 12, bottom: 10, display: "flex", alignItems: "flex-end", gap: 4 }}>
              <span className="pika-bob" style={{ filter: `drop-shadow(0 3px 4px rgba(43,38,32,.25)) hue-rotate(${presence[i].hue - 48}deg)` }}>
                <PikaSprite size={40} mood="spark" />
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 9, background: `hsl(${presence[i].hue} 70% 45%)`, color: "#fff", borderRadius: 999, padding: "1px 6px", marginBottom: 6 }}
              >
                U{i + 1}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="font-mono" style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 14 }}>
        One world · three clipped screens · {Math.round(camera.zoom * 100)}% — objects continue across each screen seam.
      </p>
    </main>
  );
}

function PresenceAvatar({ p }: { p: ScreenPresence }) {
  return (
    <span
      className="flex items-center justify-center font-mono"
      style={{ width: 26, height: 26, borderRadius: "50%", background: `hsl(${p.hue} 70% 45%)`, color: "#fff", fontSize: 11, border: p.isSelf ? "2px solid var(--text)" : "none" }}
      title={p.isSelf ? "You" : `User ${p.order + 1}`}
    >
      U{p.order + 1}
    </span>
  );
}
