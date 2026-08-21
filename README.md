# MERCURY — AI Market Simulation + Ask Mercury What-If

This version adds the **Ask Mercury** decision-support feature to the existing Mercury stack.

## Stack

- Frontend: React + Vite + Recharts
- Backend: Python + FastAPI + Pydantic
- Optional AI: Gemini REST API from the backend
- Simulation: Mercury's Python scoring engine

## Important architecture

The AI/parser does **not** generate the what-if numbers.

1. User asks a natural-language what-if question.
2. Mercury extracts structured changes.
3. A copy of the current simulation inputs is created.
4. The original product and modified product are both sent through the same simulation engine.
5. The frontend compares the real engine outputs.
6. Mercury explains the observed impact.

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt

# Optional: copy .env.example to .env and set GEMINI_API_KEY.
uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000 and Swagger docs at http://localhost:8000/docs.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite normally opens the app at http://localhost:5173.

If the backend is hosted elsewhere, create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

## Demo flow

1. Enter a product, price and target audience.
2. Select at least one market.
3. Run the normal simulation.
4. Open **ASK MERCURY** on the right.
5. Try:
   - `What if I reduce the price to ₹799?`
   - `What if I increase the price by 20%?`
   - `What if I add a 7-day free trial?`
   - `What if I target college students instead?`
   - `What if I reduce the price to ₹799, remove analytics and target college students?`
6. Mercury shows the extracted changes, current vs what-if metrics, graph and reasoning.
7. Use **Apply this scenario** to make the what-if product the new current simulation.

## Gemini is optional

The app works without a Gemini key. The deterministic parser handles common hackathon demo questions and the backend scoring engine produces the numbers.

With `GEMINI_API_KEY`, Gemini is used for richer persona generation and more flexible change extraction. The simulation metrics still come from Mercury's scoring engine.
