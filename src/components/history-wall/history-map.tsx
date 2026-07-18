"use client";

import { useEffect, useMemo, useState } from "react";
import { geoGraticule10, geoInterpolate, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";

import type { HistoryWallData } from "@/contracts/history-wall.types";
import { CIV_GEO, geoForRecord, type LngLat } from "@/lib/history-wall/civ-geo";

const WIDTH = 960;
const HEIGHT = 520;

interface HistoryMapProps {
  data: HistoryWallData;
  activeId: string | null;
  onSelect: (id: string) => void;
}

// Minimal shape of a GeoJSON FeatureCollection we render.
interface CountryFeature {
  type: "Feature";
  geometry: unknown;
  properties: unknown;
}

export default function HistoryMap({ data, activeId, onSelect }: HistoryMapProps) {
  const [countries, setCountries] = useState<CountryFeature[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/countries-110m.json")
      .then((res) => res.json())
      .then((topology) => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const collection = feature(topology, (topology as any).objects.countries) as unknown as {
          features: CountryFeature[];
        };
        setCountries(collection.features);
      })
      .catch(() => setCountries([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Fit the projection to the civilizations so every pin is framed.
  const projection = useMemo(() => {
    const points = {
      type: "MultiPoint" as const,
      coordinates: Object.values(CIV_GEO).map((g) => [g.lng, g.lat]),
    };
    return geoMercator().fitExtent(
      [
        [48, 28],
        [WIDTH - 24, HEIGHT - 24],
      ],
      points,
    );
  }, []);

  const path = useMemo(() => geoPath(projection), [projection]);
  const landPaths = useMemo(
    () => (countries ? countries.map((f) => path(f as never) ?? "") : []),
    [countries, path],
  );
  const graticule = useMemo(() => path(geoGraticule10()) ?? "", [path]);

  const project = (g: LngLat): [number, number] => projection([g.lng, g.lat]) ?? [0, 0];

  const arcs = useMemo(() => {
    const out: { d: string; label: string; mid: [number, number]; key: string }[] = [];
    for (const event of data.events) {
      const parts = event.interaction?.participants ?? [];
      if (parts.length < 2) continue;
      const anchor = CIV_GEO[parts[0].civilizationId];
      if (!anchor) continue;
      for (let i = 1; i < parts.length; i++) {
        const other = CIV_GEO[parts[i].civilizationId];
        if (!other) continue;
        const line = { type: "LineString" as const, coordinates: [[anchor.lng, anchor.lat], [other.lng, other.lat]] };
        const midLngLat = geoInterpolate([anchor.lng, anchor.lat], [other.lng, other.lat])(0.5);
        out.push({
          d: path(line as never) ?? "",
          label: event.interaction?.type.replace(/_/g, " ") ?? "",
          mid: projection(midLngLat) ?? [0, 0],
          key: `${event.id}-${i}`,
        });
      }
    }
    return out;
  }, [data.events, path, projection]);

  return (
    <div className="min-h-0 flex-1 overflow-auto" style={{ background: "#dbe4e3" }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" style={{ display: "block" }}>
        <rect width={WIDTH} height={HEIGHT} fill="#dbe4e3" />
        {!countries && (
          <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" fill="#6f675a" fontSize={14}>
            Loading map…
          </text>
        )}
        <path d={graticule} fill="none" stroke="#c7d2d0" strokeWidth={0.5} />
        {landPaths.map((d, i) => (
          <path key={i} d={d} fill="#dccfae" stroke="#c9bd9c" strokeWidth={0.5} />
        ))}

        {/* Interaction arcs */}
        {arcs.map((arc) => (
          <g key={arc.key}>
            <path d={arc.d} fill="none" stroke="#b5850a" strokeWidth={1.4} strokeDasharray="4 3" opacity={0.8} />
            <text
              className="font-mono"
              x={arc.mid[0]}
              y={arc.mid[1] - 4}
              textAnchor="middle"
              fontSize={9}
              fill="#8a6a0c"
            >
              {arc.label}
            </text>
          </g>
        ))}

        {/* Civilization pins */}
        {data.civilizations.map((civ) => {
          const g = geoForRecord(civ);
          if (!g) return null;
          const [x, y] = project(g);
          const active = civ.id === activeId;
          return (
            <g
              key={civ.id}
              transform={`translate(${x},${y})`}
              onClick={() => onSelect(civ.id)}
              style={{ cursor: "pointer" }}
            >
              <circle
                r={active ? 8 : 5.5}
                fill={active ? "var(--accent)" : civ.color}
                stroke="#fbf8f0"
                strokeWidth={2}
                style={active ? { filter: "drop-shadow(0 0 6px rgba(232,169,12,.6))" } : undefined}
              />
              <text
                className="font-serif"
                x={0}
                y={-11}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={active ? "var(--accent-deep)" : "#3a342b"}
                style={{ pointerEvents: "none" }}
              >
                {civ.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
