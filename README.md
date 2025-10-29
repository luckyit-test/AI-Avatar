<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1We-R6LGGeeupr3kKfbAxsidzJQck3Eu_

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Timeweb Cloud (Docker)

This repo includes a production Dockerfile (Nginx) and runtime env injection for `GEMINI_API_KEY`.

1) Build the image locally (optional):
```bash
docker build -t newava:latest .
```

2) Timeweb Cloud → Containers → Create from Dockerfile/Registry:
- Source: Connect Git repo or upload image to Timeweb Registry (both work)
- Expose port: 80
- Env vars: add `GEMINI_API_KEY=...`

3) On start the container generates `/usr/share/nginx/html/env.js` from `env.template.js` and serves the built app via Nginx.

Notes:
- The frontend reads the key at runtime via `window.GEMINI_API_KEY` (see `services/geminiService.ts`).
- If you later rotate the key, just update the container env and restart — no rebuild required.
