export default function ScenarioHistory({ scenarios, currentProduct, onSelect }) {
  return (
    <div className="scenario-history-panel">
      <div className="section-heading"><h2>Scenario history</h2><span className="count mono">{scenarios.length + 1} saved</span></div>
      <div className="scenario-list">
        <button className="scenario-item current" onClick={() => onSelect?.(null)}>
          <span className="scenario-dot" />
          <span><strong>Current Product</strong><small>{currentProduct?.price} · {currentProduct?.targetCustomer}</small></span>
        </button>
        {scenarios.map((s) => (
          <button className="scenario-item" key={s.id} onClick={() => onSelect?.(s)}>
            <span className="scenario-dot" />
            <span><strong>{s.label}</strong><small>{s.changeSummary}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}
