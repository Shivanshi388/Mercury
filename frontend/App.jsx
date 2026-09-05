import { useState } from 'react';
import InputForm from './InputForm';
import MarketCard from './MarketCard';
import Results from './Results';
import AskMercury from './AskMercury';
import ScenarioHistory from './ScenarioHistory';
import { MARKETS } from './markets';
import { runSimulation } from './api';

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
  const [scenarios, setScenarios] = useState([]);
  const [activeScenario, setActiveScenario] = useState(null);
  const [apiError, setApiError] = useState('');

  const selectedMarkets = MARKETS.filter((m) => selectedCodes.includes(m.code));
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const toggleMarket = (market) => {
    setSelectedCodes((codes) => codes.includes(market.code) ? codes.filter((c) => c !== market.code) : [...codes, market.code]);
  };

  const handleProductSubmit = (values) => {
    setProduct(values);
    setStep('markets');
    setApiError('');
  };

  const handleRunSimulation = async () => {
    setStep('simulating');
    setApiError('');
    try {
      const data = await runSimulation(product, selectedMarkets);
      setResults(data);
      setStep('results');
    } catch (err) {
      setApiError(`${err.message}. Start the FastAPI backend on port 8000 and try again.`);
      setStep('markets');
    }
  };

  function saveScenario(result) {
    const changes = result.changes || [];
    const label = result.scenario?.label || `Scenario ${scenarios.length + 1}`;
    const saved = {
      ...result,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label,
      changeSummary: changes.map((c) => `${c.from} ΓåÆ ${c.to}`).join(' ┬╖ '),
    };
    setScenarios((items) => [...items, saved]);
  }

  async function applyScenario(result) {
    if (!result?.modified?.product) return;
    const p = result.modified.product;
    const nextProduct = {
      ...product,
      name: p.product_name,
      description: p.product_description,
      category: p.category,
      price: Number(p.price),
      targetCustomer: p.target_audience,
      currency: p.currency,
    };
    setProduct(nextProduct);
    setActiveScenario(result);
    setStep('simulating');
    try {
      const fresh = await runSimulation(nextProduct, selectedMarkets);
      setResults(fresh);
      setStep('results');
    } catch (err) {
      setApiError(err.message);
      setStep('results');
    }
  }

  const handleRestart = () => {
    setProduct(null); setSelectedCodes([]); setResults(null); setScenarios([]); setActiveScenario(null); setApiError(''); setStep('input');
  };

  return (
    <div className="mercury-app">
      <header className="mercury-header">
        <div className="mercury-logo"><span className="mark" /><h1>MERCURY</h1><span>AI MARKET SIMULATION</span></div>
        {product && <div className="header-product">{product.name} ┬╖ {product.currency === 'INR' ? 'Γé╣' : '$'}{product.price}</div>}
      </header>

      <main className="mercury-main">
        <div className="mercury-shell">
          <div className="step-rail">
            {STEPS.map((s, i) => <div key={s.key} className={`step-rail-item ${i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''}`}><span className="step-rail-num mono">{s.num}</span><span className="step-rail-label">{s.label}</span></div>)}
          </div>

          {apiError && <div className="api-error">ΓÜá {apiError}</div>}

          {step === 'input' && <InputForm initialValue={product} onSubmit={handleProductSubmit} />}

          {step === 'markets' && (
            <div className="panel">
              <h2 style={{ fontSize: 16, marginBottom: 4 }}>Choose countries or regions to test</h2>
              <p className="hint" style={{ color: 'var(--text-dim)', fontSize: 13 }}>Select as many as you like ΓÇö Mercury will simulate {product?.name || 'your product'} in each one.</p>
              <div className="market-grid">{MARKETS.map((m) => <MarketCard key={m.code} market={m} selected={selectedCodes.includes(m.code)} onToggle={toggleMarket} />)}</div>
              <div className="actions-row"><button className="btn btn-ghost" onClick={() => setStep('input')}>ΓåÉ Back</button><button className="btn btn-primary" disabled={!selectedCodes.length} onClick={handleRunSimulation}>Run simulation ({selectedCodes.length}) ΓåÆ</button></div>
            </div>
          )}

          {step === 'simulating' && <div className="simulating"><div className="pulse-ring" /><p className="msg">Generating regional personas and simulating responsesΓÇª</p></div>}

          {step === 'results' && results && (
            <div className="results-layout">
              <div className="results-content">
                <Results product={product} results={results} onRestart={handleRestart} onEditMarkets={() => setStep('markets')} activeScenario={activeScenario} />
                <ScenarioHistory scenarios={scenarios} currentProduct={product} onSelect={(s) => setActiveScenario(s)} />
              </div>
              <AskMercury product={product} selectedMarkets={selectedMarkets} onApplyScenario={applyScenario} scenarios={scenarios} onSaveScenario={saveScenario} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
