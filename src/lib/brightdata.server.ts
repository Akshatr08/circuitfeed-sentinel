/**
 * Bright Data service — the only module that talks to the Collection API.
 *
 * This app deliberately does NOT call any heal/approval endpoint: healing
 * happens outside the app via the Bright Data CLI. This service triggers the
 * existing collector, waits for its output, and hands the raw payload back.
 *
 * Bright Data's DCA API accepts a few different trigger shapes depending on how
 * the collector declares its inputs. A collector that rejects one shape answers
 * HTTP 400 `{"error":"No input provided"}`, so we try the documented variants in
 * order and only fail once every one is refused — the collected errors are
 * reported together so the UI shows exactly what Bright Data said.
 */

import {
  BRIGHT_DATA_RESULT_URL,
  BRIGHT_DATA_TRIGGER_URL,
  COLLECTOR_POLL_INTERVAL_MS,
  COLLECTOR_TIMEOUT_MS,
  COLLECTOR_SOURCE_URL,
} from "./config";

const BRIGHT_DATA_TRIGGER_IMMEDIATE_URL = "https://api.brightdata.com/dca/trigger_immediate";
const BRIGHT_DATA_IMMEDIATE_RESULT_URL = "https://api.brightdata.com/dca/get_result";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/** The input record handed to the collector. Override the field name if the
 * collector declares something other than `url` (e.g. `page_url`). */
function collectorInput(): Record<string, string> {
  const field = process.env["BRIGHT_DATA_INPUT_FIELD"] || "url";
  const value = process.env["BRIGHT_DATA_INPUT_URL"] || COLLECTOR_SOURCE_URL;
  return { [field]: value };
}

type TriggerHandle =
  | { mode: "collection"; id: string }
  | { mode: "immediate"; id: string };

interface TriggerAttempt {
  label: string;
  url: string;
  body: unknown;
  mode: "collection" | "immediate";
}

function triggerAttempts(collectorId: string): TriggerAttempt[] {
  const input = collectorInput();
  const collector = encodeURIComponent(collectorId);
  return [
    {
      label: "trigger[array]",
      url: `${BRIGHT_DATA_TRIGGER_URL}?collector=${collector}&queue_next=1`,
      body: [input],
      mode: "collection",
    },
    {
      label: "trigger{input:[]}",
      url: `${BRIGHT_DATA_TRIGGER_URL}?collector=${collector}&queue_next=1`,
      body: { input: [input] },
      mode: "collection",
    },
    {
      label: "trigger_immediate{input}",
      url: `${BRIGHT_DATA_TRIGGER_IMMEDIATE_URL}?collector=${collector}`,
      body: { input },
      mode: "immediate",
    },
  ];
}

function readHandleId(body: unknown, mode: "collection" | "immediate"): string | null {
  if (!isPlainObject(body)) return null;
  const keys = mode === "immediate" ? ["response_id", "collection_id"] : ["collection_id", "response_id"];
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

async function triggerCollector(token: string, collectorId: string): Promise<TriggerHandle> {
  const failures: string[] = [];

  for (const attempt of triggerAttempts(collectorId)) {
    const res = await fetch(attempt.url, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(attempt.body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      failures.push(`${attempt.label} → HTTP ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
      continue;
    }

    const body: unknown = await res.json().catch(() => null);
    const id = readHandleId(body, attempt.mode);
    if (!id) {
      failures.push(`${attempt.label} → no collection/response id in reply`);
      continue;
    }
    return { mode: attempt.mode, id };
  }

  throw new Error(
    `Bright Data trigger failed. ${failures.join(" | ")}. ` +
      "If every attempt says \"No input provided\", the collector expects a differently named input — " +
      "set BRIGHT_DATA_INPUT_FIELD to the field name shown in Scraper Studio.",
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollCollectorResult(token: string, handle: TriggerHandle): Promise<unknown> {
  const url =
    handle.mode === "immediate"
      ? `${BRIGHT_DATA_IMMEDIATE_RESULT_URL}?response_id=${encodeURIComponent(handle.id)}`
      : `${BRIGHT_DATA_RESULT_URL}?id=${encodeURIComponent(handle.id)}`;
  const deadline = Date.now() + COLLECTOR_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(url, { headers: authHeaders(token) });

    // 202 = still collecting; an object with a running-style status means the same.
    if (res.status === 202) {
      await sleep(COLLECTOR_POLL_INTERVAL_MS);
      continue;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Bright Data result fetch failed (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }

    const body: unknown = await res.json();
    if (Array.isArray(body)) return body;

    const status = isPlainObject(body) && typeof body["status"] === "string" ? (body["status"] as string) : "";
    if (["running", "building", "starting", "queued", "ready", "pending", "collecting"].includes(status)) {
      await sleep(COLLECTOR_POLL_INTERVAL_MS);
      continue;
    }
    // Unknown non-array payload: return it and let validation flag the shape.
    return body;
  }
  throw new Error(`Collector run did not finish within ${Math.round(COLLECTOR_TIMEOUT_MS / 1000)}s`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Triggers the collector and resolves with the raw structured output. */
export async function runCollector(token: string, collectorId: string): Promise<unknown> {
  const handle = await triggerCollector(token, collectorId);
  return pollCollectorResult(token, handle);
}
