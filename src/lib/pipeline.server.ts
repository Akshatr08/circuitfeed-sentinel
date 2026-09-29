/**
 * Pipeline service — all database access for CircuitFeed Sentinel.
 *
 * Reads use a publishable client (public tables, anon SELECT policies).
 * Writes use the service-role client because the app has no user accounts:
 * pipeline rows are system facts, not user data. This module is server-only.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { COLLECTOR_ID, COLLECTOR_SOURCE_NAME, COLLECTOR_SOURCE_URL } from "./config";
import { runCollector } from "./brightdata.server";
import { answerWithRecords } from "./gemini.server";
import { assessRunHealth, validateCollectorOutput } from "./validation";
import type {
  AskSentinelResult,
  Hackathon,
  PipelineState,
  RecoveryEvent,
  ScraperRun,
  TriggerRunResult,
  ValidHackathonRecord,
} from "./types";

type Client = SupabaseClient;

/** Publishable client for public reads; RLS applies as anon. */
function publicClient(): Client {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // New-format sb_ keys are opaque, not JWTs — send apikey only.
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

async function adminClient(): Promise<Client> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

async function latestRun(client: Client): Promise<ScraperRun | null> {
  const { data } = await client
    .from("scraper_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ScraperRun | null) ?? null;
}

async function lastHealthyRun(client: Client): Promise<ScraperRun | null> {
  const { data } = await client
    .from("scraper_runs")
    .select("*")
    .eq("status", "healthy")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ScraperRun | null) ?? null;
}

async function latestFailure(client: Client): Promise<ScraperRun | null> {
  const { data } = await client
    .from("scraper_runs")
    .select("*")
    .in("status", ["suspicious", "failed"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ScraperRun | null) ?? null;
}

async function latestRecovery(client: Client): Promise<RecoveryEvent | null> {
  const { data } = await client
    .from("recovery_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RecoveryEvent | null) ?? null;
}

async function hackathonCount(client: Client): Promise<number> {
  const { count } = await client.from("hackathons").select("id", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * Web integrity: 100 when the latest run is healthy; otherwise the ratio of
 * valid records to what the last healthy run produced. Null before any run.
 */
function computeIntegrity(latest: ScraperRun | null, lastGood: ScraperRun | null): number | null {
  if (!latest || latest.status === "running") return null;
  if (latest.status === "healthy") return 100;
  if (latest.status === "failed" || latest.record_count === 0) return 0;
  const expected = lastGood?.valid_record_count ?? 0;
  if (expected <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((100 * latest.valid_record_count) / expected)));
}

export async function getPipelineStateData(): Promise<PipelineState> {
  const client = publicClient();
  const [latest, lastGood, failure, recovery, count] = await Promise.all([
    latestRun(client),
    lastHealthyRun(client),
    latestFailure(client),
    latestRecovery(client),
    hackathonCount(client),
  ]);

  // A newer healthy run repairs an earlier failure automatically. A manually
  // logged recovery can also close the failure when healing happened outside.
  const activeFailure =
    failure &&
    (!lastGood?.completed_at || lastGood.completed_at < failure.started_at) &&
    (!recovery || recovery.created_at < failure.started_at)
      ? failure
      : null;

  const condition: PipelineState["condition"] = !latest
    ? "idle"
    : activeFailure
      ? "drift"
      : recovery && failure
        ? "repaired"
        : "healthy";

  return {
    collectorId: COLLECTOR_ID,
    sourceName: COLLECTOR_SOURCE_NAME,
    sourceUrl: COLLECTOR_SOURCE_URL,
    condition,
    integrity: computeIntegrity(latest, lastGood),
    latestRun: latest,
    lastHealthyRun: lastGood,
    activeFailure,
    latestRecovery: recovery,
    hackathonCount: count,
  };
}

async function replaceHackathons(client: Client, records: ValidHackathonRecord[]): Promise<void> {
  // A healthy run defines the new current snapshot; stale rows are replaced.
  const { error: deleteError } = await client.from("hackathons").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) throw new Error(`Failed to clear old records: ${deleteError.message}`);
  if (records.length === 0) return;
  const { error } = await client.from("hackathons").insert(records);
  if (error) throw new Error(`Failed to store records: ${error.message}`);
}

export async function executeCollectorRun(): Promise<TriggerRunResult> {
  const token = process.env["BRIGHT_DATA_API_TOKEN"];
  if (!token) {
    return {
      ok: false,
      code: "missing_credentials",
      message:
        "Bright Data integration requires server-side credentials. Add the BRIGHT_DATA_API_TOKEN secret to enable live collector runs.",
    };
  }

  const admin = await adminClient();
  const { data: runRow, error: insertError } = await admin
    .from("scraper_runs")
    .insert({ collector_id: COLLECTOR_ID, status: "running" })
    .select()
    .single();
  if (insertError || !runRow) {
    return { ok: false, code: "run_failed", message: `Could not create run record: ${insertError?.message}` };
  }
  const run = runRow as ScraperRun;

  try {
    const raw = await runCollector(token, COLLECTOR_ID);
    const result = validateCollectorOutput(raw);
    const lastGood = await lastHealthyRun(admin);
    const health = assessRunHealth(result, lastGood?.valid_record_count ?? null);

    const rawString = JSON.stringify(raw);
    const rawSnippet = rawString.length > 500 ? rawString.slice(0, 500) + "..." : rawString;
    const baseError = health.reasons.length > 0 ? health.reasons.join(" · ") : "";
    const debugError =
      health.status === "healthy" ? null : baseError ? `${baseError}\n\n[RAW]: ${rawSnippet}` : null;

    const completed: Partial<ScraperRun> = {
      status: health.status,
      record_count: result.totalCount,
      valid_record_count: result.validCount,
      error_message: debugError,
      completed_at: new Date().toISOString(),
    };

    // Suspicious output never touches the stored snapshot — the last
    // known-good data stays live for Ask Sentinel until a verified re-run.
    if (health.status === "healthy") {
      await replaceHackathons(admin, result.records);
    }

    const { data: updated } = await admin
      .from("scraper_runs")
      .update(completed)
      .eq("id", run.id)
      .select()
      .single();

    return { ok: true, run: (updated as ScraperRun) ?? { ...run, ...completed }, reasons: health.reasons };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown collector error";
    const { data: updated } = await admin
      .from("scraper_runs")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", run.id)
      .select()
      .single();
    return { ok: false, code: "run_failed", message, run: (updated as ScraperRun) ?? run };
  }
}

export interface LogRecoveryInput {
  recordsBefore: number;
  recordsAfter: number;
  explanation?: string | undefined;
  failureRunId?: string | undefined;
}

export async function logRecovery(input: LogRecoveryInput): Promise<{ ok: true; recovery: RecoveryEvent }> {
  const admin = await adminClient();

  let failureRunId = input.failureRunId ?? null;
  if (!failureRunId) {
    const failure = await latestFailure(admin);
    failureRunId = failure?.id ?? null;
  }

  const { data, error } = await admin
    .from("recovery_events")
    .insert({
      collector_id: COLLECTOR_ID,
      failure_run_id: failureRunId,
      healing_status: input.recordsAfter > input.recordsBefore ? "verified" : "logged",
      records_before: input.recordsBefore,
      records_after: input.recordsAfter,
      explanation: input.explanation?.trim() || null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to log recovery: ${error?.message}`);
  return { ok: true, recovery: data as RecoveryEvent };
}

export async function answerQuestion(question: string): Promise<AskSentinelResult> {
  const client = publicClient();
  const { data, error } = await client
    .from("hackathons")
    .select("*")
    .order("scraped_at", { ascending: false })
    .limit(50);
  if (error) {
    return { ok: false, answer: "", sources: [], recordsAvailable: 0, message: `Database read failed: ${error.message}` };
  }

  const records = (data ?? []) as Hackathon[];
  try {
    const answer = await answerWithRecords(question, records);
    return { ok: true, answer, sources: records.slice(0, 5), recordsAvailable: records.length };
  } catch (err) {
    return {
      ok: false,
      answer: "",
      sources: [],
      recordsAvailable: records.length,
      message: err instanceof Error ? err.message : "Answer generation failed",
    };
  }
}
