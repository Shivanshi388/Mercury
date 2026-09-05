function scoreTier(score) {
  if (score >= 65) return 'high';
  if (score >= 45) return 'mid';
  return 'low';
}

function formatCurrency(amount, currency) {
  if (
    amount === null ||
    amount === undefined ||
    Number.isNaN(Number(amount)) ||
    !currency
  ) {
    return '—';
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

/**
 * Two modes:
 *  - selection mode: pass `selected` + `onToggle`
 *  - scored mode: pass `score` (0-100)
 */
export default function MarketCard({ market, selected, onToggle, score }) {
  const scored = typeof score === 'number';

  return (
    <div
      className={`market-card ${selected ? 'selected' : ''} ${
        scored ? 'scored' : ''
      }`}
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

      {/* Local converted price */}
      {market.localPrice !== null &&
        market.localPrice !== undefined &&
        market.currency && (
          <div className="market-price">
            {formatCurrency(market.localPrice, market.currency)}
          </div>
        )}

      {!scored && <span className="check">{selected ? '✓' : ''}</span>}

      {scored && (
        <span className={`score-badge ${scoreTier(score)}`}>
          {score}
        </span>
      )}
    </div>
  );
}