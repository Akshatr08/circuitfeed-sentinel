# Sentinel Feed

Build a complete production-quality hackathon project called:

CIRCUITFEED SENTINEL

Tagline:

"Web intelligence that fixes itself."

This is a submission for the WeMakeDevs × Bright Data "Into the Scrape-Verse" hackathon.

IMPORTANT CONTEXT:

This is NOT a fake UI prototype. The application must be designed around a REAL Bright Data Scraper Studio custom collector.

The central product concept:

A web scraper can silently break when a website changes its structure. CircuitFeed Sentinel detects that the structured output has become unreliable, and after the existing collector is healed (healing is triggered manually via the Bright Data CLI, outside this app), re-runs the SAME collector, verifies the recovered output, stores the corrected data in Supabase, and immediately allows an AI application using that data to return the correct answer.

The key demonstration:

USER ASKS THE SAME QUESTION

→ scraper/data pipeline is broken

→ answer is stale/empty

→ (outside this app) the collector is healed via Bright Data CLI, same Collector ID

→ this app re-runs the same collector and re-verifies

→ user asks THE EXACT SAME QUESTION

→ answer is now correct

No application redeployment. No frontend change. No new question. The data pipeline was repaired.

==================================================

REAL BRIGHT DATA CONFIGURATION

==================================================

Target source: https://unstop.com/hackathons

REAL COLLECTOR ID: c_mt5exs0h17mxa45f4b

Treat this collector ID as configuration, not fake sample data.

The Bright Data integration must be isolated in a server-side Supabase Edge Function that calls the Collection API:

POST https://api.brightdata.com/dca/trigger?collector=c_mt5exs0h17mxa45f4b

(pass the Bright Data API token as an Authorization header, stored as a server-side secret — never in frontend code)

This app should NOT attempt to call any Bright Data heal/approval endpoint. Healing happens outside this app via CLI. This app's job is only to: trigger a run, receive output, validate it, and store it.

==================================================

REAL SAMPLE OUTPUT (actual data from a real run — use this to infer types/shape only, do not hardcode as permanent fixtures)

==================================================

[

  {

    "title": "Full Stack Python with Gen-AI",

    "organizer": "Quality Thought Info Systems",

    "deadline": "Posted Aug 22, 2026 2 days left",

    "participation_mode": "Online",

    "url": "https://unstop.com/hackathons/full-stack-python-with-gen-ai-quality-thought-info-systems-1742888"

  },

  {

    "title": "Horizon",

    "organizer": "Hoollow",

    "deadline": "Posted Aug 21, 2026 1 month left",

    "prize": "Pre-Placement Interviews",

    "participation_mode": "Delhi, Delhi, Delhi, India",

    "url": "https://unstop.com/hackathons/horizon-hoollow-1726596"

  },

  {

    "title": "Innov8 4.0: A Hackathon by Eightfold Ai X Aries IIT Delhi",

    "organizer": "Indian Institute of Technology (IIT), Delhi",

    "deadline": "Posted Aug 22, 2026 10 days left",

    "participation_mode": "Indian Institute of Technology, Delhi, New Delhi, Delhi, India",

    "url": "https://unstop.com/hackathons/innov8-40-a-hackathon-by-eightfold-ai-x-aries-iit-delhi-iit-delhi-1742230"

  }

]

Note: `prize` is frequently absent (null) — most listings genuinely have no cash prize shown. `participation_mode` is inconsistent: sometimes "Online," sometimes a full physical address string — display whatever string is returned, do not normalize it. `deadline` is a compound string like "Posted Aug 22, 2026 2 days left" — store as-is as deadline_text, do not parse into a strict date.

==================================================

TECH STACK

==================================================

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Supabase, Supabase Edge Functions, Gemini API, Vercel-compatible deployment. Prefer a simple architecture. No unnecessary microservices.

==================================================

PRODUCT

==================================================

CircuitFeed Sentinel is a focused reliability layer for web intelligence. The first supported data source is Unstop's public hackathon listings. The structured data powers an AI query surface called "Ask Sentinel."

Example question: "What hackathons are currently open, and which has the closest deadline?"

The answer MUST come from current structured records stored in Supabase. Gemini must NOT browse the web directly. Gemini must NOT invent records, deadlines, prizes, organizers, or URLs. The backend retrieves relevant structured records from Supabase and passes those records to Gemini as context. If the database doesn't have enough information, Gemini must say so explicitly.

==================================================

DATABASE (Supabase project: https://qwilzlwybafdfoobyjpv.supabase.co)

==================================================

TABLE: hackathons

id (uuid, pk), title (text), organizer (text), deadline_text (text), prize (text, nullable), participation_mode (text), url (text), scraped_at (timestamptz)

TABLE: scraper_runs

id (uuid, pk), collector_id (text), status (text), record_count (int), valid_record_count (int), error_message (text, nullable), started_at (timestamptz), completed_at (timestamptz)

TABLE: recovery_events

id (uuid, pk), collector_id (text), failure_run_id (uuid, references scraper_runs), healing_status (text), records_before (int), records_after (int), explanation (text), created_at (timestamptz)

Generate strongly typed TypeScript interfaces for all three.

==================================================

DATA VALIDATION

==================================================

Required fields for a valid hackathon record: title, url.

Preferred fields: organizer, deadline_text.

A scraper run is suspicious if:

- record count unexpectedly drops to zero

- valid records collapse compared to the last known-good run

- required fields are missing from a large percentage of records

- returned URLs are obviously invalid

- output shape substantially differs from expected schema

Use simple explainable thresholds — no ML anomaly detection. Validation logic must be easy for a developer/judge to read and understand.

==================================================

BRIGHT DATA INTEGRATION (server-side only)

==================================================

Create a server-side Bright Data service (Edge Function) that:

1. Triggers the existing collector (c_mt5exs0h17mxa45f4b) via POST /dca/trigger

2. Receives structured output

3. Validates the output per the rules above

4. Stores run metadata in scraper_runs

5. Stores valid records in hackathons

6. Flags suspicious runs

7. Exposes a way to log a recovery event manually (this app does NOT call any heal endpoint — healing happens via Bright Data CLI outside this app; this app only re-runs the same collector afterward and lets a human mark the recovery via a "Record Recovery" action that logs records_before/records_after into recovery_events)

Do not fake Bright Data results. Do not hardcode fake output. If credentials are missing, show a clear "Bright Data integration requires server-side credentials" message rather than pretending success.

==================================================

ASK SENTINEL

==================================================

Primary query interface. Example placeholder: "What hackathons are currently open, and which has the closest deadline?"

On submit: query Supabase for current hackathon records → pass relevant records to Gemini as context → Gemini answers strictly from those records → return a concise answer plus the relevant hackathons (title, deadline_text, organizer, prize where available, clickable url).

No chat history. No authentication. No unnecessary conversational features.

==================================================

UI STATES TO SUPPORT

==================================================

HEALTHY: ● Sentinel operational, Collector c_mt5exs0h17mxa45f4b, last run record count, schema verified.

DRIFT DETECTED: ⚠ shows expected vs received record count and reason.

RECOVERY LOGGED: shows records_before → records_after once a human logs the recovery event after running the CLI heal.

Every external operation needs loading/success/error/timeout/empty-data states. Never show fake success.

==================================================

DESIGN — THE WEB CONCEPT

==================================================

The visual identity is built around one idea: a web of connected threads that can fray and be repaired. Execute this with restraint and precision — NOT as a superhero theme, and NEVER with any character, logo, costume, or spider imagery. The "web" is an abstract data-network metaphor only.

Background: near-black (#0a0a0a range), with a very faint (4-8% opacity) geometric web-like line mesh across the full page — thin interconnected lines, abstract and architectural, never a literal spider or web icon.

Typography: one distinctive display/monospace-leaning font for headings (technical, geometric, not a generic system default) paired with a clean readable sans for body text. Avoid default Inter-everywhere styling.

Color: black background, off-white text, the existing CircuitFeed green as the single primary accent used throughout. Reserve a deep red strictly for the "broken thread" state — nowhere else in the UI. No gradients, no glassmorphism, no neon glow, no heavy drop-shadow cards.

==================================================

MAIN SCREEN — "THE WEB" DIAGRAM

==================================================

Top: "CircuitFeed Sentinel" / "Web intelligence that fixes itself." / ● SYSTEM OPERATIONAL status.

A real interactive diagram, "The Web," placed prominently on the main screen (not hidden in a collapsed section) — this is the visual centerpiece of the page.

Nodes, connected by thin animated threads in this order:

Source (Unstop) → Collector → Validation → Supabase → Gemini → Answer

Behavior:

- Healthy state: threads are solid green-tinted lines. A subtle light pulse travels along a thread whenever that stage is active (e.g. Source→Collector pulses when a scrape is triggered; Supabase→Gemini→Answer pulses when Ask Sentinel is used).

- Drift detected: the specific thread at the broken stage becomes a dashed, jittering red line — a "frayed thread" — with a small label like "Thread severed" near that node. Pure CSS/SVG animation, no video/GIF assets.

- Recovery logged: that thread animates re-drawing itself smoothly from broken back to solid, flips to green, label changes to "Thread repaired." Snappy animation, under ~1.5s.

- Ask Sentinel interaction: on submit, animate a thin pulse extending from the input box toward the Supabase → Gemini nodes in the diagram before the answer renders below, visually tying the question into the web.

Below the diagram: Ask Sentinel input box + Ask button → Answer with source records → Pipeline Health summary (Collector, Status, Records, Schema) → Latest Recovery (if one exists).

Microcopy vocabulary (use consistently, everywhere): "The Web" (diagram section), "Web integrity: [X]%" (overall pipeline health), "Thread severed" / "Thread repaired" (drift/recovery states). No spider, superhero, or comic-book language or imagery anywhere — the tone is technical and premium, elegant infrastructure design, not a costume.

Motion discipline: the thread-pulse and thread-break/repair animations are the ONLY signature motion in the app. No confetti, no bouncing elements, no parallax, no scroll-triggered reveals beyond a simple fade-in.

==================================================

DO NOT BUILD

==================================================

No authentication, user accounts, multiple scraper sources, multi-agent systems, ML anomaly detection, notifications, GitHub Actions, complex analytics, chat history, billing, teams, admin panels, unnecessary charts, fake demo data presented as real, or any automated Bright Data heal/approval calling.

==================================================

CODE QUALITY

==================================================

This project is also being submitted for Best Clean Code: small reusable components, clear service boundaries, typed API responses, centralized configuration, meaningful naming, comments only where they explain non-obvious decisions, no giant monolithic components, no duplicated API logic, no unnecessary dependencies.

==================================================

SECURITY

==================================================

Never put Bright Data API tokens, Gemini API keys, or Supabase service-role keys in frontend source code. Use Supabase Edge Function secrets/environment variables only.

==================================================

DELIVERABLES

==================================================

Complete frontend, Supabase schema/migrations, server-side Edge Functions, Bright Data service, Gemini service, validation service, recovery event logging, the Web diagram, Ask Sentinel, error handling, README foundation, and a clear setup checklist covering: which secrets to add (Bright Data API token, Gemini API key), how to run the first real scrape, how to log a recovery event, and how to deploy.

IMPORTANT: Do not stop at a visual mockup. Implement the real backend architecture and integrations wherever credentials/API access permit. If a credential is unavailable during generation, implement the integration using secure environment variables and leave a precise setup instruction rather than substituting mock behavior.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9b583785-a59c-41f6-86c9-c44f036441d9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
