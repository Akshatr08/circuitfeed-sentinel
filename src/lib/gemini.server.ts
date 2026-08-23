/**
 * Gemini service — the answer layer for Ask Sentinel.
 *
 * Gemini never browses the web and never sees anything except the verified
 * records we pass in. If the database is empty, the prompt says so and the
 * model is instructed to state that explicitly.
 *
 * Uses a direct Gemini API key when GEMINI_API_KEY is set; otherwise falls
 * back to the built-in Lovable AI Gateway (also a Gemini model, no key
 * required).
 */

import { AI_CONTEXT_RECORD_LIMIT } from "./config";
import type { Hackathon } from "./types";

const SYSTEM_PROMPT = [
  "You are Sentinel, the answer layer of CircuitFeed Sentinel.",
  "You answer questions about hackathons STRICTLY from the structured JSON records provided with each question.",
  "Those records were scraped from Unstop and passed a validation layer.",
  "Rules:",
  "- Never invent hackathons, deadlines, prizes, organizers, or URLs.",
  "- Never use outside knowledge or browse the web.",
  "- If the records do not contain enough information, say so explicitly and briefly.",
  "- deadline_text is a raw string like \"Posted Aug 22, 2026 2 days left\" — quote it as-is, never reinterpret it into a computed date.",
  "- prize is often null — that genuinely means no prize is listed; do not speculate.",
  "- Keep answers concise (under 120 words) and name the specific hackathons you relied on.",
].join("\n");

function buildUserPrompt(question: string, records: Hackathon[]): string {
  const context =
    records.length === 0
      ? "No records are currently stored in the database."
      : JSON.stringify(
          records.map((r) => ({
            title: r.title,
            organizer: r.organizer,
            deadline_text: r.deadline_text,
            prize: r.prize,
            participation_mode: r.participation_mode,
            url: r.url,
            scraped_at: r.scraped_at,
          })),
          null,
          2,
        );
  return `STRUCTURED RECORDS:\n${context}\n\nQUESTION: ${question}`;
}

async function askDirectGemini(apiKey: string, question: string, records: Hackathon[]): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildUserPrompt(question, records) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini API request failed (HTTP ${res.status})`);
  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty answer");
  return text;
}

async function askViaGateway(apiKey: string, question: string, records: Hackathon[]): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(question, records) },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`AI gateway request failed (HTTP ${res.status})`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI gateway returned an empty answer");
  return text;
}

/** Answers a question strictly from the supplied verified records. */
export async function answerWithRecords(question: string, records: Hackathon[]): Promise<string> {
  const context = records.slice(0, AI_CONTEXT_RECORD_LIMIT);
  const directKey = process.env["GEMINI_API_KEY"];
  if (directKey) return askDirectGemini(directKey, question, context);

  const gatewayKey = process.env["LOVABLE_API_KEY"];
  if (!gatewayKey) throw new Error("No Gemini credentials configured (GEMINI_API_KEY or gateway key)");
  return askViaGateway(gatewayKey, question, context);
}
