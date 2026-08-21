function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

function Bar({ label, value, color }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="bar-value mono">{value}%</span>
    </div>
  );
}

export default function PersonaCard({ persona }) {
  return (
    <div className="persona-card">
      <div className="persona-head">
        <div className="persona-avatar" style={{ background: persona.avatarColor }}>
          {initials(persona.name)}
        </div>
        <div>
          <div className="persona-name">{persona.name}</div>
          <div className="persona-meta">
            {persona.age} · {persona.income} · {persona.region}
          </div>
        </div>
      </div>

      <p className="persona-quote">&ldquo;{persona.quote}&rdquo;</p>

      <div className="persona-bars">
        <Bar label="Interest" value={persona.interestLevel} color="var(--accent-cyan)" />
        <Bar label="Purchase" value={persona.purchaseLikelihood} color="var(--success)" />
        <Bar label="Price sens." value={persona.priceSensitivity} color="var(--accent-amber)" />
      </div>

      {persona.objections.length > 0 && (
        <div className="objection-tags">
          {persona.objections.map((o) => (
            <span key={o} className="objection-tag">
              {o}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
