import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const METRICS = [
  ['purchase_intent', 'Purchase Intent'],
  ['market_potential', 'Market Fit'],
  ['demand', 'Demand'],
  ['risk', 'Risk'],
  ['success', 'Success Score'],
];

function valueFor(result, key) {
  const summary = result?.summary || {};
  if (key === 'success') return Number(summary.average_success_score || 0);
  if (key === 'market_potential') {
    const values = (result.results || []).map((r) => r.scores?.market_potential ?? 0);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  }
  const values = (result.results || []).map((r) => r.scores?.[key] ?? 0);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

function signed(value) {
  return `${value > 0 ? '+' : ''}${value}`;
}

export default function ScenarioComparison({ comparison }) {
  const rows = METRICS.map(([key, label]) => {
    const current = valueFor(comparison.original, key);
    const modified = valueFor(comparison.modified, key);
    return { key, label, current, modified, change: modified - current };
  });

  const chartData = rows.map((r) => ({
    metric: r.label.replace(' Score', ''),
    Current: r.current,
    'What-if': r.modified,
  }));

  return (
    <div className="comparison-card">
      <div className="comparison-heading">
        <div>
          <div className="chat-label">IMPACT SUMMARY</div>
          <h3>{comparison.scenario?.label || 'What-if scenario'}</h3>
        </div>
        <span className="scenario-badge">SIMULATED</span>
      </div>

      <div className="change-chips">
        {(comparison.changes || []).map((c) => (
          <span key={`${c.field}-${c.to}`} className="change-chip">{c.label}: <strong>{c.from}</strong> → <strong>{c.to}</strong></span>
        ))}
      </div>

      {comparison.alternatives?.length > 1 && (
        <div className="alternative-prices">
          <div className="chat-label">PRICE ALTERNATIVES</div>
          {comparison.alternatives.map((alt) => (
            <div className="alternative-row" key={alt.price}>
              <span>{alt.result.product.currency === 'INR' ? '₹' : '$'}{alt.price}</span>
              <span>Success score <strong>{alt.result.summary.average_success_score}</strong></span>
              {alt.result.summary.average_success_score === Math.max(...comparison.alternatives.map((a) => a.result.summary.average_success_score)) && <b className="good">BEST</b>}
            </div>
          ))}
        </div>
      )}

      <div className="comparison-table">
        <div className="comparison-row comparison-head"><span>Metric</span><span>Current</span><span>What-if</span><span>Change</span></div>
        {rows.map((r) => (
          <div className="comparison-row" key={r.key}>
            <span>{r.label}</span><span>{r.current}</span><span>{r.modified}</span><strong className={r.key === 'risk' ? (r.change <= 0 ? 'good' : 'bad') : (r.change >= 0 ? 'good' : 'bad')}>{signed(r.change)}</strong>
          </div>
        ))}
      </div>

      <div className="comparison-chart">
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#232b3d" />
            <XAxis dataKey="metric" tick={{ fill: '#8b96ac', fontSize: 10 }} axisLine={{ stroke: '#232b3d' }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#8b96ac', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#161b29', border: '1px solid #232b3d', borderRadius: 8, color: '#edf1f7' }} />
            <Bar dataKey="Current" fill="#556077" radius={[4, 4, 0, 0]} />
            <Bar dataKey="What-if" fill="#4ee1d6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="reasoning-box">
        <div className="chat-label">💡 MERCURY'S REASONING</div>
        <p>{comparison.explanation}</p>
      </div>
    </div>
  );
}
