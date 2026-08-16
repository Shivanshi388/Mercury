import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import MarketCard from './MarketCard';
import PersonaCard from './PersonaCard';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#161b29',
        border: '1px solid #232b3d',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        fontFamily: 'IBM Plex Mono, monospace',
      }}
    >
      <div style={{ color: '#8b96ac', marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.fill }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export default function Results({ product, results, onRestart, onEditMarkets }) {
  const { overallScore, markets, feedback } = results;

  const topMarket = [...markets].sort((a, b) => b.successScore - a.successScore)[0];

  const chartData = markets.map((m) => ({
    market: m.code,
    Demand: m.demandScore,
    'Price fit': m.priceFitScore,
  }));

  return (
    <div>
      <div className="results-top">
        <div className="score-hero">
          <div className="label">Market Success Score</div>
          <div className="value">
            {overallScore}
            <span> / 100</span>
          </div>
          <div className="sub">
            Simulated across {markets.length} market{markets.length > 1 ? 's' : ''} for{' '}
            <strong>{product.name}</strong> at ${product.price}
          </div>
        </div>

        <div className="chart-panel">
          <h3>Demand vs. price-fit by market</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#232b3d" />
              <XAxis dataKey="market" tick={{ fill: '#8b96ac', fontSize: 11 }} axisLine={{ stroke: '#232b3d' }} tickLine={false} />
              <YAxis tick={{ fill: '#8b96ac', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="Demand" fill="#4ee1d6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Price fit" fill="#f5a623" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="segment-callout">
        <div>
          <div className="tag">Best customer segment</div>
          <p>
            {topMarket.bestSegment} in {topMarket.name} shows the strongest fit — success score{' '}
            {topMarket.successScore}.
          </p>
        </div>
      </div>

      <div className="section-heading">
        <h2>Interactive market map</h2>
        <span className="count mono">{markets.length} tested</span>
      </div>
      <div className="market-grid">
        {markets.map((m) => (
          <MarketCard key={m.code} market={m} score={m.successScore} />
        ))}
      </div>

      <div className="section-heading">
        <h2>Regional personas</h2>
        <span className="count mono">
          {markets.reduce((n, m) => n + m.personas.length, 0)} generated
        </span>
      </div>
      {markets.map((m) => (
        <div key={m.code} style={{ marginBottom: 28 }}>
          <div className="persona-meta mono" style={{ marginBottom: 10 }}>
            {m.flag} {m.name}
          </div>
          <div className="persona-grid">
            {m.personas.map((p) => (
              <PersonaCard key={p.id} persona={p} />
            ))}
          </div>
        </div>
      ))}

      <div className="feedback-panel">
        <h3>AI-generated feedback</h3>
        <p>{feedback}</p>
      </div>

      <div className="actions-row" style={{ marginTop: 32 }}>
        <button className="btn btn-ghost" onClick={onEditMarkets}>
          ← Adjust markets
        </button>
        <button className="btn btn-ghost" onClick={onRestart}>
          Start a new simulation
        </button>
      </div>
    </div>
  );
}
