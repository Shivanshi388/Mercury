import { useState, useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/**
 * MarketMap
 * Plots each region as a bubble on a lng/lat grid (a lightweight stand-in
 * for a real world map — no external map tiles/API key required).
 * Bubble size = market potential score, color = risk level.
 *
 * Expected `results` shape (one entry per region, merged from markets.json
 * + demographics.json + the AI scoring output from Member 3's backend):
 * [{
 *   id, name, flag, lat, lng,
 *   score: 0-100,          // Market Potential Score
 *   scalability: 0-100,
 *   risk: "low" | "medium" | "high",
 *   summary: string
 * }]
 */

const RISK_COLOR = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#f87171",
};

const RISK_LABEL = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm shadow-xl">
      <div className="font-semibold text-white">
        {d.flag} {d.name}
      </div>
      <div className="mt-1 text-neutral-400">
        Score: <span className="text-white">{d.score}</span> · Risk:{" "}
        <span style={{ color: RISK_COLOR[d.risk] }}>{RISK_LABEL[d.risk]}</span>
      </div>
    </div>
  );
}

export default function MarketMap({
  results = DEMO_RESULTS,
  selectedId,
  onSelectRegion = () => {},
}) {
  const [hoveredId, setHoveredId] = useState(null);

  const points = useMemo(
    () =>
      results.map((r) => ({
        ...r,
        x: r.lng,
        y: r.lat,
        z: r.score,
      })),
    [results]
  );

  const sorted = useMemo(
    () => [...results].sort((a, b) => b.score - a.score),
    [results]
  );

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-neutral-950 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Regional Market Map
        </h3>
        <div className="flex items-center gap-4 text-xs text-neutral-400">
          {Object.entries(RISK_LABEL).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: RISK_COLOR[key] }}
              />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Bubble map */}
        <div className="h-80 rounded-xl bg-neutral-900/60 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[-180, 180]}
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                label={{ value: "Longitude", position: "insideBottom", offset: -5, fill: "#52525b", fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[-60, 80]}
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                label={{ value: "Latitude", angle: -90, position: "insideLeft", fill: "#52525b", fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="z" range={[200, 900]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter
                data={points}
                onClick={(d) => onSelectRegion(d.id)}
                onMouseEnter={(d) => setHoveredId(d.id)}
                onMouseLeave={() => setHoveredId(null)}
                cursor="pointer"
              >
                {points.map((p) => (
                  <circle
                    key={p.id}
                    fill={RISK_COLOR[p.risk]}
                    fillOpacity={
                      selectedId === p.id || hoveredId === p.id ? 0.95 : 0.6
                    }
                    stroke={selectedId === p.id ? "#ffffff" : "transparent"}
                    strokeWidth={2}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Ranked region list */}
        <div className="flex flex-col gap-2 overflow-y-auto">
          {sorted.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelectRegion(r.id)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                selectedId === r.id
                  ? "border-white/30 bg-white/10"
                  : "border-white/5 bg-neutral-900/60 hover:border-white/15 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{r.flag}</span>
                <span className="text-sm text-white">{r.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: RISK_COLOR[r.risk] }}
                />
                <span className="text-sm font-semibold text-neutral-200">
                  {r.score}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Fallback demo data so this component renders standalone during development
const DEMO_RESULTS = [
  { id: "india", name: "India", flag: "🇮🇳", lat: 20.59, lng: 78.96, score: 78, scalability: 82, risk: "medium" },
  { id: "usa", name: "United States", flag: "🇺🇸", lat: 37.09, lng: -95.71, score: 65, scalability: 58, risk: "high" },
  { id: "germany", name: "Germany", flag: "🇩🇪", lat: 51.17, lng: 10.45, score: 71, scalability: 66, risk: "low" },
  { id: "uae", name: "UAE", flag: "🇦🇪", lat: 23.42, lng: 53.85, score: 85, scalability: 74, risk: "low" },
  { id: "brazil", name: "Brazil", flag: "🇧🇷", lat: -14.24, lng: -51.93, score: 58, scalability: 61, risk: "medium" },
  { id: "japan", name: "Japan", flag: "🇯🇵", lat: 36.2, lng: 138.25, score: 52, scalability: 45, risk: "high" },
];
