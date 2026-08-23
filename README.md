# CircuitFeed Sentinel

**Web intelligence that fixes itself.**

CircuitFeed Sentinel is a reliability layer for a real web-data pipeline built for the WeMakeDevs × Bright Data “Into the Scrape-Verse” hackathon. The app monitors whether scraper output is still trustworthy, detects drift with explicit validation checks, and keeps Ask Sentinel tied to verified records only. When the source website changes, a suspicious run is flagged as a severed thread; after healing the same collector externally, a new verified run and recovery log restore confidence. The core demo is the same question before and after recovery, with the answer quality changing because the data pipeline was repaired.

## Real Bright Data Collector

- **Collector ID:** `c_mt5exs0h17mxa45f4b`
- **Source it points to:** `https://unstop.com/hackathons` (Unstop hackathon listings)

This ID is live project configuration (see `src/lib/config.ts`) and is re-used for trigger + post-heal verification runs.

## Architecture Overview

1. **Bright Data** collector run is triggered server-side.
2. Raw output goes through **validation** (`title`/`url` requirements + threshold-based drift checks).
3. Healthy records are written to **Supabase** (`hackathons`, `scraper_runs`, `recovery_events`).
4. **Gemini** receives only verified Supabase records as context (no web browsing).
5. **Ask Sentinel** returns concise answers grounded in those records.

## Project Structure (key files)

- `src/lib/config.ts` — collector config and thresholds
- `src/lib/types.ts` — domain types
- `src/lib/validation.ts` — validation + drift logic
- `src/lib/brightdata.server.ts` — Bright Data trigger/poll service
- `src/lib/gemini.server.ts` — answer generation from trusted context only
- `src/lib/pipeline.server.ts` — orchestration, storage, health state, recovery log
- `src/lib/pipeline.functions.ts` — server function interface used by UI
- `src/routes/index.tsx` — main screen
- `src/styles.css` — dark “thread web” design system and thread animations

## Environment Setup

Create a local `.env` file with server-side secrets/config:

```bash
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
BRIGHT_DATA_API_TOKEN=...
# Choose one:
GEMINI_API_KEY=...
# or (gateway fallback used by this codebase):
LOVABLE_API_KEY=...
```

> Keep secrets server-side only. Do not expose API tokens in client code.

## Run Locally

```bash
bun install
bun run dev
```

(Equivalent npm scripts exist: `npm install` + `npm run dev`.)

## Trigger a Scrape

In the UI, use **Trigger scrape** in Pipeline Health.

What happens:
- Creates a `scraper_runs` row with `running`
- Triggers Bright Data collector `c_mt5exs0h17mxa45f4b`
- Polls for result
- Validates output and marks run `healthy` / `suspicious` / `failed`
- Replaces `hackathons` snapshot only when run is healthy

If `BRIGHT_DATA_API_TOKEN` is missing, the backend returns a real error message instead of fake success.

## Healing and Recovery Logging

### Healing (outside this app)
This app **does not** call any Bright Data heal endpoint. Healing is done externally with the Bright Data CLI against the same collector.

### Log recovery event
After external heal + rerun verification, use **Record recovery** in the UI:
- Enter `records_before` and `records_after`
- Add optional explanation
- Submit to write a `recovery_events` record

The pipeline state will then render the repaired thread state when appropriate.

## Live Deployment & Demo
- **Live URL:** [https://YOUR-DEPLOYED-URL-HERE.vercel.app](https://YOUR-DEPLOYED-URL-HERE.vercel.app) *(Placeholder — add your deployed Vercel URL here)*
- **Demo Video:** [https://YOUR-VIDEO-LINK-HERE.com](https://YOUR-VIDEO-LINK-HERE.com) *(Placeholder — add your demo video link here)*

## Tools Used

Built with AI assistance throughout — Claude for planning, architecture decisions, and technical guidance; Lovable for initial scaffolding; GitHub Copilot and Antigravity for implementation and debugging. All generated code and architecture were reviewed and are understood by the developer.
