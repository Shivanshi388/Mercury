const API_BASE = 'https://mercury-te7m.vercel.app';

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

async function convertCurrency(amount, fromCurrency, toCurrency) {
  if (!amount || fromCurrency === toCurrency) {
    return Number(amount);
  }

  const params = new URLSearchParams({
    amount: String(amount),
    from_currency: fromCurrency,
    to_currency: toCurrency,
  });

  const response = await fetch(
    `${API_BASE}/convert-currency?${params.toString()}`
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail || 'Unable to fetch exchange rate.'
    );
  }

  return Number(data.converted_amount);
}


async function prepareMarketPrices(product, marketList) {
  const baseCurrency = product.currency || 'INR';
  const basePrice = Number(product.price);

  const convertedMarkets = await Promise.all(
    marketList.map(async (market) => {
      const currency = market.currency || baseCurrency;

      const localPrice = await convertCurrency(
        basePrice,
        baseCurrency,
        currency
      );

      return {
        ...market,
        currency,
        localPrice,
      };
    })
  );

  return convertedMarkets;
}


function productToPayload(product, marketNames, marketPrices = []) {
  return {
    product_name: product.name,
    product_description: product.description,
    category: product.category,
    price: Number(product.price),
    currency: product.currency || 'INR',
    target_audience: product.targetCustomer,
    regions: marketNames,
    market_prices: marketPrices,
  };
}


export async function runSimulation(product, marketList) {
  const convertedMarkets = await prepareMarketPrices(
    product,
    marketList
  );

  const payload = productToPayload(
    product,
    convertedMarkets.map((m) => m.name)
  );

  payload.market_prices = convertedMarkets.map((market) => ({
    region: market.name,
    country: market.code,
    currency: market.currency,
    price: market.localPrice,
  }));

  const data = await request('/simulate', payload);

  return adaptSimulationResponse(
    data,
    convertedMarkets
  );
}


export async function runWhatIf({ question, product, marketList }) {
  const payload = {
    question,
    current_product: productToPayload(
      product,
      marketList.map((m) => m.name),
      marketList.map((m) => ({
        region: m.name,
        country: m.code,
        currency: m.currency,
        price: m.localPrice,
      }))
    ),
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
  const marketByName = new Map();
  const marketByCode = new Map();

  // Store markets by BOTH name and country code
  marketList.forEach((market) => {
    if (market.name) {
      marketByName.set(
        String(market.name).trim().toLowerCase(),
        market
      );
    }

    if (market.code) {
      marketByCode.set(
        String(market.code).trim().toUpperCase(),
        market
      );
    }
  });

  const markets = (data.results || []).map((r) => {
    const regionName = String(r.region || '').trim();

    // Try matching by name first
    let meta = marketByName.get(regionName.toLowerCase());

    // Then try country code
    if (!meta && r.country) {
      meta = marketByCode.get(
        String(r.country).trim().toUpperCase()
      );
    }

    // Last resort: find by partial name
    if (!meta) {
      meta = marketList.find(
        (m) =>
          String(m.name || '').toLowerCase() ===
          regionName.toLowerCase()
      );
    }

    // If still not found, DO NOT default to USD.
    // Keep the market's actual information if the backend supplied it.
    meta = meta || {};

    const scores = r.scores || {};

    const personas = r.persona
      ? [
          {
            id: `${regionName}-persona`,

            name:
              r.persona.name ||
              r.persona.persona_name ||
              'Market Persona',

            age: 'Representative',

            income: 'Market segment',

            region: regionName,

            avatarColor: '#8b7fff',

            interestLevel:
              scores.purchase_intent ?? 50,

            priceSensitivity:
              100 - (scores.price_fit ?? 50),

            purchaseLikelihood:
              scores.purchase_intent ?? 50,

            objections:
              scores.risk > 55
                ? ['Higher market-entry risk']
                : [],

            quote:
              r.persona.reaction ||
              'The simulated customer sees potential but wants stronger evidence.',
          },
        ]
      : [];

    /*
     * IMPORTANT:
     *
     * Currency and localPrice MUST come from the selected
     * market metadata, not from a USD fallback.
     */

    const currency =
      meta.currency ||
      r.currency ||
      null;

    const symbol =
      meta.symbol ||
      r.symbol ||
      null;

    const localPrice =
      meta.localPrice ??
      r.localPrice ??
      r.price ??
      null;

    return {
      ...meta,

      code:
        meta.code ||
        r.country ||
        regionName.slice(0, 3).toUpperCase(),

      name:
        meta.name ||
        regionName,

      region:
        meta.region ||
        'Market',

      flag:
        meta.flag ||
        '🌐',

      // Correct currency for this market
      currency,

      // Correct currency symbol
      symbol,

      // Correct converted local price
      localPrice,

      demandScore:
        scores.demand ?? 0,

      priceFitScore:
        scores.price_fit ?? 0,

      successScore:
        scores.success ?? 0,

      personas,

      bestSegment:
        r.persona?.profile ||
        'Representative market segment',

      raw: r,
    };
  });

  return {
    overallScore:
      data.summary?.average_success_score ?? 0,

    markets,

    feedback:
      data.summary?.disclaimer ||
      `Mercury simulated ${markets.length} market${
        markets.length === 1 ? '' : 's'
      } using the same scoring engine.`,

    summary: data.summary,

    product: data.product,

    aiUsed: data.ai_used,
  };
}

export async function generateProductImage(product) {
  const data = await request('/generate-product-image', {
    product_name: product.name,
    product_description: product.description,
    category: product.category,
  });

  return {
    type: 'image',
    url: data.image,
    name: 'AI-generated product image',
  };
}