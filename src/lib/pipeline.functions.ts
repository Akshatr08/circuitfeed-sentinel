/**
 * Public server functions — thin wrappers over the pipeline service.
 * The app has no authentication; reads are public data and writes are
 * pipeline operations executed server-side with the service role.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  answerQuestion,
  executeCollectorRun,
  getPipelineStateData,
  logRecovery,
} from "./pipeline.server";

export const getPipelineState = createServerFn({ method: "GET" }).handler(async () => {
  return getPipelineStateData();
});

export const triggerScrapeRun = createServerFn({ method: "POST" }).handler(async () => {
  return executeCollectorRun();
});

export const recordRecovery = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        recordsBefore: z.number().int().min(0).max(100_000),
        recordsAfter: z.number().int().min(0).max(100_000),
        explanation: z.string().max(500).optional(),
        failureRunId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    return logRecovery(data);
  });

export const askSentinel = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ question: z.string().trim().min(3).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    return answerQuestion(data.question);
  });
