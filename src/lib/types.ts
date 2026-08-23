/**
 * Strongly typed domain models mirroring the public schema.
 * Row types match the database exactly; DTOs shape API responses.
 */

export interface Hackathon {
  id: string;
  title: string;
  organizer: string | null;
  /** Raw compound string, e.g. "Posted Aug 22, 2026 2 days left". Never parsed. */
  deadline_text: string | null;
  prize: string | null;
  participation_mode: string | null;
  url: string;
  scraped_at: string;
}

export type RunStatus = "running" | "healthy" | "suspicious" | "failed";

export interface ScraperRun {
  id: string;
  collector_id: string;
  status: RunStatus;
  record_count: number;
  valid_record_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface RecoveryEvent {
  id: string;
  collector_id: string;
  failure_run_id: string | null;
  healing_status: string;
  records_before: number;
  records_after: number;
  explanation: string | null;
  created_at: string;
}

/** Raw shape returned by the Bright Data collector (fields may be absent). */
export interface RawHackathonRecord {
  title?: unknown;
  organizer?: unknown;
  deadline?: unknown;
  prize?: unknown;
  participation_mode?: unknown;
  url?: unknown;
  [key: string]: unknown;
}

/** A record that passed validation, ready to insert into `hackathons`. */
export interface ValidHackathonRecord {
  title: string;
  organizer: string | null;
  deadline_text: string | null;
  prize: string | null;
  participation_mode: string | null;
  url: string;
}

export type PipelineCondition = "idle" | "healthy" | "drift" | "repaired";

/** Aggregated pipeline state returned by getPipelineState. */
export interface PipelineState {
  collectorId: string;
  sourceName: string;
  sourceUrl: string;
  condition: PipelineCondition;
  /** 0-100, or null when no run has ever completed. */
  integrity: number | null;
  latestRun: ScraperRun | null;
  lastHealthyRun: ScraperRun | null;
  /** Latest suspicious/failed run with no recovery logged after it. */
  activeFailure: ScraperRun | null;
  latestRecovery: RecoveryEvent | null;
  hackathonCount: number;
}

export type TriggerRunResult =
  | { ok: true; run: ScraperRun; reasons: string[] }
  | { ok: false; code: "missing_credentials" | "run_failed"; message: string; run?: ScraperRun };

export interface AskSentinelResult {
  ok: boolean;
  answer: string;
  sources: Hackathon[];
  recordsAvailable: number;
  message?: string;
}
