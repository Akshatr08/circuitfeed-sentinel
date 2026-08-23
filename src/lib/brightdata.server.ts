/**
 * Bright Data service — the only module that talks to the Collection API.
 *
 * This app deliberately does NOT call any heal/approval endpoint: healing
 * happens outside the app via the Bright Data CLI. This service triggers the
 * existing collector, waits for its output, and hands the raw payload back.
 */

import {
  BRIGHT_DATA_RESULT_URL,
  BRIGHT_DATA_TRIGGER_URL,
  COLLECTOR_POLL_INTERVAL_MS,
  COLLECTOR_TIMEOUT_MS,
  COLLECTOR_SOURCE_URL,
} from "./config";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function triggerCollector(token: string, collectorId: string): Promise<string> {
  const url = `${BRIGHT_DATA_TRIGGER_URL}?collector=${encodeURIComponent(collectorId)}&queue_next=1`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify([{ url: COLLECTOR_SOURCE_URL }]),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Bright Data trigger failed (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const body = (await res.json()) as { collection_id?: string };
  if (!body.collection_id) {
    throw new Error("Bright Data trigger returned no collection_id");
  }
  return body.collection_id;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollCollectorResult(token: string, collectionId: string): Promise<unknown> {
  const url = `${BRIGHT_DATA_RESULT_URL}?id=${encodeURIComponent(collectionId)}`;
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
    if (["running", "building", "starting", "queued", "ready"].includes(status)) {
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
  const collectionId = await triggerCollector(token, collectorId);
  return pollCollectorResult(token, collectionId);
}
