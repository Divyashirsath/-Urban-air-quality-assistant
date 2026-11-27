# Urban Air Quality Assistant — Challenge 6

A GenAI-powered assistant that helps families and communities navigate severe winter smog and urban air pollution. The assistant suggests low-emission daily routines, indoor air quality hacks, and sustainable alternatives tailored to the user's location and lifestyle, while clearly explaining the direct impact of their choices.

## Run it

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Other useful commands:

```bash
npm test       # run the assistant/agent and server tests
npm run dev    # restart the server when files change
```

No `npm install` step is required.

## What is implemented

- **Assistant workflow:** location air context → air-quality assessment → routine plan → impact scoring → prioritized actions → narrative guidance.
- **Low-emission routines:** indoor air protection, exercise and commute adjustments, cooking and heating hacks, lifestyle dust/smoke controls.
- **Indoor air quality hacks:** HEPA purifier strategy, sealing/ventilation, cooking ventilation, wood-smoke reduction.
- **Sustainable alternatives:** low-emission commuting, cleaner heating, cleaner cooking, reduced indoor smoke.
- **Direct impact explanation:** every routine reports before → after breathing-zone PM2.5, saved personal exposure (µg/m³·min/day), and an estimated life-years-gained figure (simplified linear model), plus a plain-language narrative.
- **Tailoring:** household health sensitivities and everyday activities adjust which routines are recommended.

## How the assistant decides

1. The location adapter resolves an air-quality profile (local-mock winter-smog profiles in `src/airquality.js`).
2. The assessment maps PM2.5/AQI to a severity level and flags household sensitivity.
3. The routine catalog in `src/agent.js` filters routines against the household activities and context.
4. `src/impact.js` computes deterministic before/after exposure math per routine.
5. Actions are sorted indoor-first, then by estimated saved exposure.

## Data and adapters

The app uses deterministic local profiles so the full workflow runs offline. See the seams in:

- `src/airquality.js` — location/air adapter boundary (provider-ready)
- `src/impact.js` — exposure and health-impact math
- `src/agent.js` — investigation workflow
- `src/llm.js` — narrative generation boundary (LLM when `LLM_API_KEY` is set)

## Safety note

Impact figures are approximate planning estimates, not medical advice. Confirm air-quality values with official monitoring, and consult healthcare providers for sensitive family members.

## Deploy to GitHub and Render

1. Create an empty GitHub repository.
2. From this folder, run:

```powershell
git init
git add .
git commit -m "Build Urban Air Quality Assistant"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

3. In Render, choose **New → Blueprint**, connect the GitHub repository, and apply `render.yaml`.
4. Render will use `npm install`, `npm start`, and `/api/health`.

See [`DEPLOY.md`](DEPLOY.md) for the complete submission and deployment command list and troubleshooting.
