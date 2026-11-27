# Deploy the Urban Air Quality Assistant to GitHub and Render (Challenge 6)

This project is a Node web app with a small HTTP API, so use a Node host such as Render. GitHub Pages cannot run `server.js` or the `/api/*` routes.

## A. Push to GitHub

Create a new **empty** GitHub repository for this challenge first (for example `urban-air-quality-assistant`).

Open PowerShell in the project folder:

```powershell
cd "C:\Users\HP\OneDrive\Documents\Default Project\urban-air-quality-assistant"
```

Initialize and commit:

```powershell
git init
git add .
git commit -m "Build Urban Air Quality Assistant"
git branch -M main
```

Add the GitHub remote. Replace the placeholders:

```powershell
git remote add origin https://github.com/<your-github-user>/<your-repository>.git
git push -u origin main
```

Git Credential Manager will ask you to sign in. Do not put a personal access token in a command, README, or committed file.

Useful checks:

```powershell
git status
git remote -v
git log --oneline -1
```

## B. Deploy the live app with Render Blueprint

1. Sign in at [https://render.com](https://render.com).
2. Select **New → Blueprint**.
3. Connect the GitHub repository you just pushed.
4. Confirm that Render detects `render.yaml`.
5. Select **Apply**. Render creates a Node web service named `urban-air-quality-assistant`.
6. Wait for the first deploy to finish.
7. Open the generated `onrender.com` URL.

The Blueprint uses:

- Build command: `npm install`
- Start command: `npm start`
- Health check: `/api/health`
- Automatic deploys: every commit to the connected branch

## C. Manual Render setup alternative

If you do not want to use Blueprints:

1. Select **New → Web Service** and connect the GitHub repository.
2. Choose **Node**.
3. Build command: `npm install`
4. Start command: `npm start`
5. Health check path: `/api/health`
6. Deploy.

The root `Dockerfile` is also supported if you prefer a Docker web service. Render sets `PORT`; `server.js` reads it automatically.

## D. Verify the live service

```powershell
Invoke-RestMethod "https://<your-render-host>/api/health"
```

The response should include `"ok": true`.

## E. Optional environment variables

The hosted app currently uses the deterministic local adapter, so no secrets are required. For richer assistant narratives:

```dotenv
LLM_API_KEY=your-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Do not commit credentials or put them in `render.yaml`.

## Submission checklist

Before submitting for the challenge:

1. `npm test` passes in the project root (`node --test`).
2. `node --check server.js` passes.
3. The live deployment answers `/api/health` with `"ok": true`.
4. The demo walkthrough works on the hosted URL:
   - Open the assistant home view.
   - Generate an action plan (form or sample household).
   - Review the air-quality briefing, projected household impact, and prioritized routines.
   - Review the routine library.

## Important hosting note

The demo uses an in-memory plan store, so a Render free instance may lose generated plans after a restart. That is fine for a hackathon demo; for production use, persist plans in a database/object store.
