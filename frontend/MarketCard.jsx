function scoreTier(score) {
  if (score >= 65) return 'high';
  if (score >= 45) return 'mid';
  return 'low';
}

/**
 * Two modes:
 *  - selection mode (default): pass `selected` + `onToggle`, used in the
 *    "Select Markets" step.
 *  - scored mode: pass `score` (0-100), used on the Results dashboard's
 *    interactive market map. Card becomes non-interactive.
 */
export default function MarketCard({ market, selected, onToggle, score }) {
  const scored = typeof score === 'number';

  return (
    <div
      className={`market-card ${selected ? 'selected' : ''} ${scored ? 'scored' : ''}`}
      onClick={scored ? undefined : () => onToggle(market)}
      role={scored ? undefined : 'checkbox'}
      aria-checked={scored ? undefined : selected}
      tabIndex={scored ? -1 : 0}
      onKeyDown={
        scored
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle(market);
              }
            }
      }
    >
      <span className="flag">{market.flag}</span>
      <div className="name">{market.name}</div>
      <div className="region">{market.region}</div>

      {!scored && <span className="check">{selected ? '✓' : ''}</span>}

      {scored && (
        <span className={`score-badge ${scoreTier(score)}`}>{score}</span>
      )}
    </div>
  );
}
