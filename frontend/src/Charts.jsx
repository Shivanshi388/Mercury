import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  Legend,
} from "recharts";

const ACCENT = "#818cf8";
const ACCENT_SOFT = "#4f46e5";

/* ---------------------------------------------------------
   1. Region Comparison — success score side by side by region
--------------------------------------------------------- */
export function RegionComparisonChart({ results = DEMO_RESULTS }) {
  const data = results.map((r) => ({
    name: `${r.flag} ${r.name}`,
    Score: r.score,
    Scalability: r.scalability,
  }));

  return (
    <ChartCard title="Region Comparison">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={{ stroke: "#3f3f46" }} tickLine={false} />
          <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          <Bar dataKey="Score" fill={ACCENT} radius={[6, 6, 0, 0]} />
          <Bar dataKey="Scalability" fill="#334155" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ---------------------------------------------------------
   2. Score Breakdown — radar of the sub-scores for one region
--------------------------------------------------------- */
export function ScoreBreakdownChart({ region = DEMO_RESULTS[0] }) {
  const data = [
    { metric: "Market Potential", value: region.score },
    { metric: "Scalability", value: region.scalability },
    { metric: "Demand", value: region.demand ?? 70 },
    { metric: "Affordability", value: region.affordability ?? 60 },
    { metric: "Low Competition", value: region.lowCompetition ?? 55 },
  ];

  return (
    <ChartCard title={`Score Breakdown — ${region.flag} ${region.name}`}>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data}>
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} />
          <Radar dataKey="value" stroke={ACCENT} fill={ACCENT} fillOpacity={0.35} />
          <Tooltip content={<DarkTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ---------------------------------------------------------
   3. What-if Price Simulation — slider recalculates demand
   using each region's priceSensitivityIndex (from markets.json)
--------------------------------------------------------- */
export function PriceSimulationChart({
  basePrice = 50,
  results = DEMO_RESULTS,
}) {
  const [price, setPrice] = useState(basePrice);

  // Simple elasticity model: demand falls as price rises above basePrice,
  // scaled by each region's price sensitivity (0 = insensitive, 1 = very sensitive)
  const curve = useMemo(() => {
    const steps = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    return steps.map((mult) => {
      const p = Math.round(basePrice * mult);
      const point = { price: p };
      results.forEach((r) => {
        const priceDelta = (p - basePrice) / basePrice;
        const demand = Math.max(
          0,
          Math.min(100, 100 - priceDelta * (r.priceSensitivityIndex ?? 0.5) * 100)
        );
        point[r.name] = Math.round(demand);
      });
      return point;
    });
  }, [basePrice, results]);

  const colors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#38bdf8", "#a78bfa"];

  return (
    <ChartCard title="What-if Price Simulation">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-neutral-400 w-24">
          Price: ${price}
        </span>
        <input
          type="range"
          min={Math.round(basePrice * 0.5)}
          max={Math.round(basePrice * 2)}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full accent-indigo-400"
        />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={curve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" vertical={false} />
          <XAxis dataKey="price" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "#3f3f46" }} tickLine={false} />
          <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip content={<DarkTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
          {results.map((r, i) => (
            <Line
              key={r.id}
              type="monotone"
              dataKey={r.name}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-neutral-500">
        Estimated demand (0–100) as price moves away from the base price of ${basePrice}, weighted by each region's price sensitivity.
      </p>
    </ChartCard>
  );
}

/* ---------------------------------------------------------
   Shared building blocks
--------------------------------------------------------- */
function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-300">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-xs shadow-xl">
      {label && <div className="mb-1 font-semibold text-white">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// Demo data so each chart renders standalone during development.
// priceSensitivityIndex mirrors data/markets.json.
const DEMO_RESULTS = [
  { id: "india", name: "India", flag: "🇮🇳", score: 78, scalability: 82, priceSensitivityIndex: 0.85 },
  { id: "usa", name: "United States", flag: "🇺🇸", score: 65, scalability: 58, priceSensitivityIndex: 0.35 },
  { id: "germany", name: "Germany", flag: "🇩🇪", score: 71, scalability: 66, priceSensitivityIndex: 0.45 },
  { id: "uae", name: "UAE", flag: "🇦🇪", score: 85, scalability: 74, priceSensitivityIndex: 0.30 },
];

export default function ChartsDemo() {
  return (
    <div className="grid gap-4 bg-black p-6 md:grid-cols-2">
      <RegionComparisonChart />
      <ScoreBreakdownChart />
      <div className="md:col-span-2">
        <PriceSimulationChart />
      </div>
    </div>
  );
}
