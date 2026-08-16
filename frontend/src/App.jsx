import { useState } from 'react';
import InputForm from './components/InputForm';
import MarketCard from './components/MarketCard';
import Results from './components/Results';
import { MARKETS } from './data/markets';
import { runSimulation } from './utils/mockSimulate';
import './index.css';

const STEPS = [
  { key: 'input', num: '01', label: 'Enter product' },
  { key: 'markets', num: '02', label: 'Select markets' },
  { key: 'simulating', num: '03', label: 'AI simulation' },
  { key: 'results', num: '04', label: 'Results' },
];

export default function App() {
  const [step, setStep] = useState('input');
  const [product, setProduct] = useState(null);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [results, setResults] = useState(null);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const toggleMarket = (market) => {
    setSelectedCodes((codes) =>
      codes.includes(market.code) ? codes.filter((c) => c !== market.code) : [...codes, market.code]
    );
  };

  const handleProductSubmit = (values) => {
    setProduct(values);
    setStep('markets');
  };

  const handleRunSimulation = async () => {
    const chosen = MARKETS.filter((m) => selectedCodes.includes(m.code));
    setStep('simulating');
    // NOTE: runSimulation is a local mock — swap for the real AI
    // Simulation API call once Member 3's endpoint is live.
    const data = await runSimulation(product, chosen);
    setResults(data);
    setStep('results');
  };

  const handleRestart = () => {
    setProduct(null);
    setSelectedCodes([]);
    setResults(null);
    setStep('input');
  };

  return (
    <div className="mercury-app">
      <header className="mercury-header">
        <div className="mercury-logo">
          <span className="mark" />
          <h1>MERCURY</h1>
          <span>AI MARKET SIMULATION</span>
        </div>
      </header>

      <main className="mercury-main">
        <div className="mercury-shell">
          <div className="step-rail">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`step-rail-item ${
                  i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''
                }`}
              >
                <span className="step-rail-num mono">{s.num}</span>
                <span className="step-rail-label">{s.label}</span>
              </div>
            ))}
          </div>

          {step === 'input' && (
            <InputForm initialValue={product} onSubmit={handleProductSubmit} />
          )}

          {step === 'markets' && (
            <div className="panel">
              <h2 style={{ fontSize: 16, marginBottom: 4 }}>Choose countries or regions to test</h2>
              <p className="hint" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                Select as many as you like — Mercury will simulate {product?.name || 'your product'}{' '}
                in each one.
              </p>

              <div className="market-grid">
                {MARKETS.map((m) => (
                  <MarketCard
                    key={m.code}
                    market={m}
                    selected={selectedCodes.includes(m.code)}
                    onToggle={toggleMarket}
                  />
                ))}
              </div>

              <div className="actions-row">
                <button className="btn btn-ghost" onClick={() => setStep('input')}>
                  ← Back
                </button>
                <button
                  className="btn btn-primary"
                  disabled={selectedCodes.length === 0}
                  onClick={handleRunSimulation}
                >
                  Run simulation ({selectedCodes.length}) →
                </button>
              </div>
            </div>
          )}

          {step === 'simulating' && (
            <div className="simulating">
              <div className="pulse-ring" />
              <p className="msg">
                Generating regional personas and simulating responses…
              </p>
            </div>
          )}

          {step === 'results' && results && (
            <Results
              product={product}
              results={results}
              onRestart={handleRestart}
              onEditMarkets={() => setStep('markets')}
            />
          )}
        </div>
      </main>
    </div>
  );
}
