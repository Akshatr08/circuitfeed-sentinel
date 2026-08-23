import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { askSentinel } from "@/lib/pipeline.functions";
import type { AskSentinelResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AskSentinelProps {
  onAskLifecycle: (active: boolean) => void;
}

export function AskSentinel({ onAskLifecycle }: AskSentinelProps) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskSentinelResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: string) => askSentinel({ data: { question: input } }),
    onMutate: () => {
      onAskLifecycle(true);
      setResult(null);
    },
    onSettled: () => {
      onAskLifecycle(false);
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const canSubmit = question.trim().length >= 3 && !mutation.isPending;

  return (
    <section className="rounded-xl border border-line bg-card/70 p-5">
      <h2 className="font-display text-xl text-foreground">Ask Sentinel</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ask from current validated records only.</p>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = question.trim();
          if (trimmed.length < 3) return;
          mutation.mutate(trimmed);
        }}
      >
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What hackathons are currently open, and which has the closest deadline?"
          className="font-sans"
        />
        <Button
          type="submit"
          disabled={!canSubmit}
          className="font-mono uppercase tracking-[0.12em]"
        >
          {mutation.isPending ? "Asking…" : "Ask"}
        </Button>
      </form>

      {mutation.isError ? (
        <p className="mt-3 text-sm text-destructive">
          {(mutation.error as Error).message || "Ask Sentinel failed"}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3 text-sm">
          {result.ok ? (
            <>
              <p className="text-foreground">{result.answer}</p>
              <p className="font-mono text-xs text-muted-foreground">
                Records available: {result.recordsAvailable}
              </p>
              {result.sources.length > 0 ? (
                <ul className="space-y-2">
                  {result.sources.map((source) => (
                    <li key={source.id} className="rounded-md border border-line p-3">
                      <p className="font-medium text-foreground">{source.title}</p>
                      <p className="text-muted-foreground">
                        {source.organizer || "Organizer unavailable"} ·{" "}
                        {source.deadline_text || "Deadline unavailable"}
                      </p>
                      {source.prize ? (
                        <p className="text-muted-foreground">Prize: {source.prize}</p>
                      ) : null}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
                      >
                        View listing
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-destructive">
              {result.message || "Ask Sentinel could not answer right now."}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
