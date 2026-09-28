/**
 * Validation service. Pure functions, no I/O — the explainability of these
 * rules is a product feature, so keep them readable.
 *
 * A record is VALID when it has a non-empty title and a well-formed Unstop URL.
 * A run is SUSPICIOUS when the output looks broken in any of a few explicit,
 * threshold-based ways (see assessRunHealth).
 */

import { EXPECTED_URL_PATTERN, THRESHOLDS } from "./config";
import type { RawHackathonRecord, RunStatus, ValidHackathonRecord } from "./types";

const KNOWN_KEYS = new Set([
  "title",
  "organizer",
  "deadline",
  "prize",
  "participation_mode",
  "url",
]);

export interface ValidationResult {
  totalCount: number;
  validCount: number;
  missingRequiredCount: number;
  invalidUrlCount: number;
  /** False when the payload isn't an array of objects with known keys. */
  schemaMatches: boolean;
  records: ValidHackathonRecord[];
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function isPlainObject(value: unknown): value is RawHackathonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractRecords(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (!isPlainObject(raw)) return null;

  const wrappedRecords = raw["hackathons"];
  return Array.isArray(wrappedRecords) ? wrappedRecords : null;
}

export function validateCollectorOutput(raw: unknown): ValidationResult {
  const output = extractRecords(raw);
  if (!output) {
    return {
      totalCount: 0,
      validCount: 0,
      missingRequiredCount: 0,
      invalidUrlCount: 0,
      schemaMatches: false,
      records: [],
    };
  }

  const records: ValidHackathonRecord[] = [];
  let missingRequiredCount = 0;
  let invalidUrlCount = 0;
  let schemaMatches = true;

  for (const item of output) {
    if (!isPlainObject(item)) {
      schemaMatches = false;
      missingRequiredCount += 1;
      continue;
    }
    // Unknown top-level keys mean the site's markup likely changed.
    if (Object.keys(item).some((key) => !KNOWN_KEYS.has(key))) {
      schemaMatches = false;
    }

    const title = asNullableString(item.title);
    const url = asNullableString(item.url);

    if (!title || !url) {
      missingRequiredCount += 1;
      continue;
    }
    if (!EXPECTED_URL_PATTERN.test(url)) {
      invalidUrlCount += 1;
      continue;
    }

    records.push({
      title,
      url,
      organizer: asNullableString(item.organizer),
      deadline_text: asNullableString(item.deadline),
      prize: asNullableString(item.prize),
      participation_mode: asNullableString(item.participation_mode),
    });
  }

  return {
    totalCount: output.length,
    validCount: records.length,
    missingRequiredCount,
    invalidUrlCount,
    schemaMatches,
    records,
  };
}

export interface HealthAssessment {
  status: Extract<RunStatus, "healthy" | "suspicious">;
  reasons: string[];
}

/**
 * Compares a validated run against expectations and the last known-good run.
 * Any single reason is enough to flag the run as suspicious.
 */
export function assessRunHealth(
  result: ValidationResult,
  lastGoodValidCount: number | null,
): HealthAssessment {
  const reasons: string[] = [];

  if (!result.schemaMatches) {
    reasons.push("Output shape differs from the expected schema");
  }
  if (result.totalCount === 0) {
    reasons.push("Collector returned zero records");
  }
  if (result.totalCount > 0) {
    const missingRatio = result.missingRequiredCount / result.totalCount;
    if (missingRatio > THRESHOLDS.maxMissingRequiredRatio) {
      reasons.push(
        `${Math.round(missingRatio * 100)}% of records are missing required fields (title/url)`,
      );
    }
    const invalidUrlRatio = result.invalidUrlCount / result.totalCount;
    if (invalidUrlRatio > THRESHOLDS.maxInvalidUrlRatio) {
      reasons.push(`${result.invalidUrlCount} record(s) returned invalid URLs`);
    }
  }
  if (
    lastGoodValidCount !== null &&
    lastGoodValidCount > 0 &&
    result.validCount < lastGoodValidCount * THRESHOLDS.minValidVsLastGoodRatio
  ) {
    reasons.push(
      `Valid records collapsed: ${result.validCount} vs ${lastGoodValidCount} in the last healthy run`,
    );
  }

  return { status: reasons.length === 0 ? "healthy" : "suspicious", reasons };
}
