/**
 * Centralized configuration for CircuitFeed Sentinel.
 *
 * The collector ID is real configuration — the same Bright Data Scraper
 * Studio collector is re-run after a CLI heal, which is the entire point
 * of the recovery loop. Never secrets in this file: it ships to the client.
 */

export const COLLECTOR_ID = "c_mt5exs0h17mxa45f4b";
export const COLLECTOR_SOURCE_NAME = "Unstop";
export const COLLECTOR_SOURCE_URL = "https://unstop.com/hackathons";

export const BRIGHT_DATA_TRIGGER_URL = "https://api.brightdata.com/dca/trigger";
export const BRIGHT_DATA_RESULT_URL = "https://api.brightdata.com/dca/dataset";

/** How long the server polls a triggered collector run before giving up. */
export const COLLECTOR_POLL_INTERVAL_MS = 4_000;
export const COLLECTOR_TIMEOUT_MS = 110_000;

/**
 * Validation thresholds. Deliberately simple, explainable numbers — a judge
 * should be able to read assessRunHealth() and predict its verdict.
 */
export const THRESHOLDS = {
  /** >20% of records missing a required field (title/url) → suspicious. */
  maxMissingRequiredRatio: 0.2,
  /** Valid records below 50% of the last healthy run → suspicious. */
  minValidVsLastGoodRatio: 0.5,
  /** >10% of records carrying an off-pattern URL → suspicious. */
  maxInvalidUrlRatio: 0.1,
} as const;

/** Unstop hackathon detail URLs always match this shape. */
export const EXPECTED_URL_PATTERN = /^https:\/\/unstop\.com\/hackathons\/[a-z0-9-]+$/i;

/** Cap on records handed to Gemini as context. */
export const AI_CONTEXT_RECORD_LIMIT = 40;
