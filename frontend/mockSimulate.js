// ---------------------------------------------------------------
// TEMPORARY MOCK — replace with a real API call to the AI
// Simulation service (Member 3) once it's ready, e.g.:
//
//   export async function runSimulation(product, marketCodes) {
//     const res = await fetch('/api/simulate', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ product, markets: marketCodes }),
//     });
//     return res.json();
//   }
//
// The shape returned below is what Results.jsx / PersonaCard.jsx
// expect, so keep the real API response in this shape (or adapt
// the components) when you swap this out.
// ---------------------------------------------------------------

const FIRST_NAMES = [
  'Aria', 'Kenji', 'Fatima', 'Lucas', 'Priya', 'Noah', 'Elena', 'Tariq',
  'Mei', 'Diego', 'Sofia', 'Liam', 'Amara', 'Yuki', 'Omar', 'Ingrid',
];

const INCOME_BANDS = ['Lower-income', 'Middle-income', 'Upper-middle', 'High-income'];
const AGE_BANDS = ['18–24', '25–34', '35–44', '45–54', '55+'];

const OBJECTION_POOL = [
  'Price feels high for the category',
  'Unfamiliar brand, needs trust signals',
  'Prefers a local alternative',
  'Unsure about delivery/support in this region',
  'Wants more product detail before buying',
  'Currency/payment friction',
];

const AVATAR_COLORS = ['#4ee1d6', '#8b7fff', '#f5a623', '#5fd68a', '#ff6b6b'];

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function buildPersona(rand, region) {
  const interest = Math.round(30 + rand() * 65);
  const likelihood = Math.round(Math.max(5, interest - 10 + rand() * 20));
  const objectionCount = rand() > 0.5 ? 2 : 1;
  const objections = Array.from({ length: objectionCount }, () => pick(rand, OBJECTION_POOL));

  return {
    id: Math.random().toString(36).slice(2, 9),
    name: pick(rand, FIRST_NAMES),
    region,
    age: pick(rand, AGE_BANDS),
    income: pick(rand, INCOME_BANDS),
    avatarColor: pick(rand, AVATAR_COLORS),
    interestLevel: interest,
    priceSensitivity: Math.round(30 + rand() * 65),
    purchaseLikelihood: likelihood,
    objections: [...new Set(objections)],
    quote:
      likelihood > 60
        ? "This solves a real problem for me — I'd try it at this price."
        : likelihood > 35
        ? "I'm curious, but I'd want to compare it with what I already use."
        : "Not convinced yet — the price and the brand are both a stretch.",
  };
}

export function runSimulation(product, marketList) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const markets = marketList.map((m) => {
        const rand = seededRandom(
          m.code.charCodeAt(0) * 97 + m.code.charCodeAt(1) * 13 + product.price * 3
        );
        const demandScore = Math.round(40 + rand() * 55);
        const priceFitScore = Math.round(35 + rand() * 60);
        const successScore = Math.round(demandScore * 0.55 + priceFitScore * 0.45);
        const personas = Array.from({ length: 3 }, () => buildPersona(rand, m.region));
        const bestSegment = personas.reduce((a, b) =>
          b.purchaseLikelihood > a.purchaseLikelihood ? b : a
        );

        return {
          ...m,
          demandScore,
          priceFitScore,
          successScore,
          personas,
          bestSegment: `${bestSegment.age}, ${bestSegment.income}`,
        };
      });

      const overallScore = Math.round(
        markets.reduce((sum, m) => sum + m.successScore, 0) / markets.length
      );

      resolve({
        overallScore,
        markets,
        feedback: `Across ${markets.length} market${markets.length > 1 ? 's' : ''}, "${
          product.name
        }" performs best where price sensitivity is lower and the target customer overlaps with early-adopter segments. Consider leading launch in the top-scoring market and using it as a proof point before expanding.`,
      });
    }, 1600);
  });
}
