# CircuitFeed Sentinel — Full Documentation

> **Web intelligence that fixes itself.**
> Built for the WeMakeDevs × Bright Data "Into the Scrape-Verse" hackathon.

---

## 1. What this project is

Scrapers break quietly. A website changes its layout, the scraper keeps "succeeding", and bad or empty data flows into everything downstream, including AI answers.

CircuitFeed Sentinel adds a **reliability layer** on top of a real scraping pipeline:

1. It **collects** hackathon listings from Unstop using a Bright Data collector.
2. It **checks** every run against simple, explainable rules to spot drift.
3. It **only stores data that passed the checks**.
4. It **answers questions** (Ask Sentinel) using only that verified data.
5. When a run goes bad, the pipeline is shown as a **severed thread**. After the collector is healed (outside the app) and re-run, the thread is shown as **repaired** and a recovery event is logged.

The demo: ask the same question before and after recovery, and see the answer get better because the data was repaired.

---

## 2. The big picture

```text
 Unstop website
      |
      v
 Bright Data collector (c_mt5exs0h17mxa45f4b)
      |   triggered server-side, polled for results
      v
 Validation + drift detection
      |   healthy -> store      suspicious/failed -> keep old data, flag drift
      v
 Database (hackathons, scraper_runs, recovery_events)
      |
      v
 AI model (gets verified records only, no web access)
      |
      v
 Ask Sentinel answer + source records shown in the UI
```

The "Web" diagram on the home page draws this exact chain as six nodes:
**Source -> Collector -> Validation -> Database -> AI -> Answer.**
The Source-to-Collector thread frays when drift is detected and redraws itself when repaired.

---

## 3. Tech stack

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start v1 (React 19, SSR, server functions) |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 with tokens in `src/styles.css` |
| Data fetching | TanStack Query |
| Database | Supabase (Postgres + Row Level Security) |
| Scraping | Bright Data Scraper Studio collector (DCA API) |
| AI | Gemini (direct key) or Lovable AI Gateway fallback |
| Hosting | Lovable or Vercel (Nitro auto-detects the target) |

---

## 4. Folder and file guide

```text
src/
  routes/
    __root.tsx            App shell, fonts, global head tags
    index.tsx             The single dashboard page
  components/
    web-diagram.tsx       Animated 6-node pipeline diagram
    ask-sentinel.tsx      Question box + grounded answers + sources
    pipeline-health.tsx   Run status, integrity %, Trigger scrape button
    recovery-panel.tsx    Form to log a recovery event
    background-mesh.tsx   Decorative background lines
  lib/
    config.ts             Collector ID, source URL, thresholds (no secrets)
    types.ts              Shared TypeScript types
    validation.ts         Record extraction, validation, drift checks
    brightdata.server.ts  Trigger + poll Bright Data (server only)
    gemini.server.ts      Build AI answer from trusted records (server only)
    pipeline.server.ts    Orchestration, DB writes, health state
    pipeline.functions.ts Server functions called by the UI
  integrations/supabase/  Generated database clients and types
  styles.css              Design system + thread animations
supabase/                 Database config and migrations
```

Rule of thumb: files ending in `.server.ts` never reach the browser. The UI only talks to the server through `pipeline.functions.ts`.

---

## 5. Database

### `hackathons` — the current verified snapshot
| Column | Meaning |
| --- | --- |
| `id` | uuid |
| `title` | required |
| `organizer` | optional |
| `deadline_text` | raw text like "Posted Aug 22 · 2 days left" (not parsed) |
| `prize` | optional |
| `participation_mode` | online / offline etc. |
| `url` | required, must match the Unstop URL pattern |
| `scraped_at` | timestamp |

Replaced **only** when a run is healthy.

### `scraper_runs` — one row per scrape attempt
`collector_id`, `status` (`running` / `healthy` / `suspicious` / `failed`), `record_count`, `valid_record_count`, `error_message`, `started_at`, `completed_at`.

### `recovery_events` — the healing log
`collector_id`, `failure_run_id` (links to the bad run), `healing_status`, `records_before`, `records_after`, `explanation`, `created_at`.

### Security
- Row Level Security is on for all three tables.
- The public can **read** only. All writes happen on the server with the service role.

---

## 6. How a scrape works (step by step)

Triggered by **Trigger scrape** in Pipeline Health.

1. A `scraper_runs` row is created with status `running`.
2. `brightdata.server.ts` triggers collector `c_mt5exs0h17mxa45f4b`. It tries three documented request shapes in order until one is accepted:
   - `POST /dca/trigger` with an input array
   - `POST /dca/trigger` with `{ input: [...] }`
   - `POST /dca/trigger_immediate`
   The input field defaults to `url` = `https://unstop.com/hackathons` and can be changed with `BRIGHT_DATA_INPUT_FIELD` / `BRIGHT_DATA_INPUT_URL`.
3. The server polls the result endpoint every 4 seconds, for up to 110 seconds.
4. The output is unwrapped: it can be a plain list **or** `{ "hackathons": [...] }` (the real collector returns the second shape).
5. Validation runs (next section).
6. The run is marked `healthy`, `suspicious` or `failed`.
7. If healthy, the `hackathons` table is replaced with the new valid records. Otherwise old trusted data stays in place.

---

## 7. Validation and drift detection

Defined in `src/lib/validation.ts`, thresholds in `src/lib/config.ts`. They are deliberately simple so anyone can predict the verdict.

A record is **valid** when it has a `title` and a `url`.

A run is **suspicious** if any of these is true:

| Check | Threshold |
| --- | --- |
| Records missing title or url | more than 20% |
| Valid records vs last healthy run | below 50% |
| URLs not matching `https://unstop.com/hackathons/<slug>` | more than 10% |
| Output shape is not a list or `{ hackathons: [...] }` | always suspicious |

A run is **failed** if the collector errored or timed out. The reasons are saved and shown in the UI.

---

## 8. Pipeline states

| State | When | What the UI shows |
| --- | --- | --- |
| `idle` | no completed run yet | waiting |
| `healthy` | latest run passed | "System operational", intact thread |
| `drift` | latest run suspicious/failed with no recovery after it | "Thread severed", frayed red thread |
| `repaired` | a recovery was logged, or a newer healthy run followed the failure | "Thread repaired", redrawn thread |

**Web integrity %** = valid records / total records of the latest completed run.

---

## 9. Healing and recovery

- The app **does not** heal the collector itself. Healing is done outside with the Bright Data CLI / Scraper Studio, on the **same** collector ID.
- After healing, press **Trigger scrape** again to verify.
- Then use **Record recovery**: enter records before and after, plus an optional note. This writes a `recovery_events` row tied to the failed run, and the diagram switches to the repaired state.

---

## 10. Ask Sentinel (AI answers)

1. You type a question (3+ characters).
2. The server loads up to 40 verified records from `hackathons`.
3. Only those records are sent to the AI as context. The AI has no web access and is told to answer only from them, and to say so when the data doesn't cover the question.
4. The answer comes back with the source records it used, shown as cards.

If the pipeline is in drift, answers stay based on the last trusted snapshot, never on bad data.

---

## 11. Server functions (UI <-> server)

From `src/lib/pipeline.functions.ts`:

| Function | Purpose |
| --- | --- |
| `getPipelineState` | Current condition, integrity, latest runs, recovery, record count (UI refreshes every 15s) |
| `triggerScrapeRun` | Runs the full scrape flow from section 6 |
| `askSentinel` | Grounded AI answer from section 10 |
| `recordRecovery` | Writes a recovery event |

---

## 12. Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | database URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | public read key |
| `SUPABASE_URL` | server | database URL |
| `SUPABASE_PUBLISHABLE_KEY` | server | public key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | writes runs / records |
| `BRIGHT_DATA_API_TOKEN` | server | triggers the collector |
| `GEMINI_API_KEY` or `LOVABLE_API_KEY` | server | AI answers |
| `BRIGHT_DATA_INPUT_FIELD` (optional) | server | collector input name, default `url` |
| `BRIGHT_DATA_INPUT_URL` (optional) | server | input value, default Unstop URL |

Never prefix secrets with `VITE_` — those values ship to the browser.

---

## 13. Running and deploying

**Local:** `bun install` then `bun run dev` (or npm equivalents). Copy `.env.example` to `.env` first.

**Vercel:** import the repo, add every variable above for Production and Preview, then **redeploy** (`VITE_` values are baked in at build time).

**Lovable:** the backend is already connected; just publish.

---

## 14. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Blank page, "Missing Supabase environment variable(s)" | `VITE_SUPABASE_*` not set, or set without redeploying |
| `No input provided` (HTTP 400) | Collector input field isn't `url`. Check Scraper Studio, set `BRIGHT_DATA_INPUT_FIELD`, redeploy |
| HTTP 401/403 from Bright Data | Token missing or lacks access to the collector |
| Run marked suspicious "Output shape differs" | Collector changed output format; check the raw sample in the run's error message |
| Permission error reading tables | RLS read policy or table grants missing |
| AI says it has no data | No healthy run yet — trigger a scrape |

---

## 15. Design system

Dark instrument-panel look: near-black background, circuit-green primary, deep red reserved only for the severed-thread state. No gradients or glass. Technical display type, tabular mono numbers, hairline panels. Animations (fray jitter, thread redraw, data pulse) respect "reduce motion" settings. All colors are tokens in `src/styles.css`.

---

## 16. Credits

Built with AI assistance — Claude for planning and architecture, Lovable for scaffolding, GitHub Copilot and Antigravity for implementation and debugging. All code was reviewed and is understood by the developer.
