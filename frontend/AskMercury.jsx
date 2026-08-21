import { useMemo, useState } from 'react';
import { runWhatIf } from './api';
import ScenarioComparison from './ScenarioComparison';

export default function AskMercury({ product, selectedMarkets, onApplyScenario, scenarios, onSaveScenario }) {
  const [open, setOpen] = useState(true);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState([]);
  const [comparison, setComparison] = useState(null);

  const suggestions = useMemo(() => [
    `What if I reduce the price by 20%?`,
    'What if I target college students instead?',
    'What if I add a 7-day free trial?',
    'Which would perform better: the current price or 20% lower?',
  ], []);

  async function submitQuestion(e) {
    e?.preventDefault();
    const text = question.trim();
    if (!text || loading) return;
    setError('');
    setLoading(true);
    setConversation((items) => [...items, { role: 'owner', text }]);

    try {
      const result = await runWhatIf({
        question: text,
        product,
        marketList: selectedMarkets,
      });
      setComparison(result);
      setConversation((items) => [
        ...items,
        { role: 'mercury', text: result.explanation || 'I simulated the requested scenario.' },
      ]);
      onSaveScenario?.(result);
      setQuestion('');
    } catch (err) {
      setError(err.message || 'Could not run the scenario.');
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!comparison) return;
    onApplyScenario(comparison);
  }

  return (
    <aside className={`ask-mercury ${open ? 'open' : 'collapsed'}`}>
      <button className="ask-header" onClick={() => setOpen((v) => !v)}>
        <div>
          <div className="ask-kicker">ASK MERCURY</div>
          <div className="ask-title">💬 Explore a what-if</div>
        </div>
        <span>{open ? '→' : '←'}</span>
      </button>

      {open && (
        <div className="ask-body">
          <p className="ask-intro">Change your product in plain English. Mercury will clone the current inputs, rerun the same simulation engine, and compare the actual outputs.</p>

          <div className="suggestions">
            {suggestions.map((s) => (
              <button key={s} onClick={() => setQuestion(s)}>{s}</button>
            ))}
          </div>

          <div className="chat-log">
            {conversation.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`chat-message ${m.role}`}>
                <span className="chat-label">{m.role === 'owner' ? 'PRODUCT OWNER' : 'MERCURY AI'}</span>
                <p>{m.text}</p>
              </div>
            ))}
            {loading && <div className="chat-message mercury"><span className="chat-label">MERCURY AI</span><p>Extracting changes → cloning scenario → rerunning simulation…</p></div>}
          </div>

          <form className="ask-form" onSubmit={submitQuestion}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to test?"
              rows={3}
            />
            <button className="btn btn-primary" disabled={!question.trim() || loading}>
              {loading ? 'Simulating…' : 'Run what-if →'}
            </button>
          </form>

          {error && <div className="ask-error">{error}</div>}

          {comparison && (
            <>
              <ScenarioComparison comparison={comparison} />
              <div className="ask-actions">
                <button className="btn btn-primary" onClick={apply}>Apply this scenario</button>
                <button className="btn btn-ghost" onClick={() => { setComparison(null); setQuestion(''); }}>Try another change</button>
              </div>
            </>
          )}

          {scenarios.length > 0 && (
            <div className="scenario-mini-history">
              <div className="chat-label">SCENARIO HISTORY</div>
              {scenarios.slice(-4).reverse().map((s) => (
                <button key={s.id} onClick={() => setComparison(s)}>
                  <span>{s.label}</span><span>›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
