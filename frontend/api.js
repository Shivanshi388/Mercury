const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Request failed with ${response.status}`);
  }
  return data;
}

function productToPayload(product, marketNames) {
  return {
    product_name: product.name,
    product_description: product.description,
    category: product.category,
    price: Number(product.price),
    currency: product.currency || 'INR',
    target_audience: product.targetCustomer,
    regions: marketNames,
  };
}

export async function runSimulation(product, marketList) {
  const payload = productToPayload(product, marketList.map((m) => m.name));
  const data = await request('/simulate', payload);
  return adaptSimulationResponse(data, marketList);
}

export async function runWhatIf({ question, product, marketList }) {
  const payload = {
    question,
    current_product: productToPayload(product, marketList.map((m) => m.name)),
    regions: marketList.map((m) => m.name),
  };
  const data = await request('/what-if', payload);
  return {
    ...data,
    original: adaptSimulationResponse(data.original, marketList),
    modified: adaptSimulationResponse(data.modified, marketList),
  };
}

function adaptSimulationResponse(data, marketList = []) {
  const marketByName = new Map(marketList.map((m) => [m.name.toLowerCase(), m]));
  const markets = (data.results || []).map((r) => {
    const meta = marketByName.get(String(r.region).toLowerCase()) || {};
    const scores = r.scores || {};
    const personas = r.persona
      ? [{
          id: `${r.region}-persona`,
          name: r.persona.name || 'Market Persona',
          age: 'Representative',
          income: 'Market segment',
          region: r.region,
          avatarColor: '#8b7fff',
          interestLevel: scores.purchase_intent ?? 50,
          priceSensitivity: 100 - (scores.price_fit ?? 50),
          purchaseLikelihood: scores.purchase_intent ?? 50,
          objections: scores.risk > 55 ? ['Higher market-entry risk'] : [],
          quote: r.persona.reaction || 'The simulated customer sees potential but wants stronger evidence.',
        }]
      : [];

    return {
      ...meta,
      code: meta.code || String(r.region).slice(0, 3).toUpperCase(),
      name: r.region,
      region: meta.region || 'Market',
      flag: meta.flag || '🌐',
      demandScore: scores.demand ?? 0,
      priceFitScore: scores.price_fit ?? 0,
      successScore: scores.success ?? 0,
      personas,
      bestSegment: r.persona?.profile || 'Representative market segment',
      raw: r,
    };
  });

  return {
    overallScore: data.summary?.average_success_score ?? 0,
    markets,
    feedback:
      data.summary?.disclaimer ||
      `Mercury simulated ${markets.length} market${markets.length === 1 ? '' : 's'} using the same scoring engine.`,
    summary: data.summary,
    product: data.product,
    aiUsed: data.ai_used,
  };
}
