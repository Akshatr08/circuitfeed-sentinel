import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { recordRecovery } from "@/lib/pipeline.functions";
import type { PipelineState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface RecoveryPanelProps {
  pipeline: PipelineState;
  onRecoverySaved: () => void;
}

export function RecoveryPanel({ pipeline, onRecoverySaved }: RecoveryPanelProps) {
  const [recordsBefore, setRecordsBefore] = useState(
    String(
      pipeline.activeFailure?.valid_record_count ?? pipeline.latestRun?.valid_record_count ?? 0,
    ),
  );
  const [recordsAfter, setRecordsAfter] = useState(String(pipeline.hackathonCount));
  const [explanation, setExplanation] = useState("");
  const [statusText, setStatusText] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () =>
      recordRecovery({
        data: {
          recordsBefore: Number.parseInt(recordsBefore, 10) || 0,
          recordsAfter: Number.parseInt(recordsAfter, 10) || 0,
          explanation: explanation.trim() || undefined,
          failureRunId: pipeline.activeFailure?.id,
        },
      }),
    onSuccess: () => {
      setStatusText("Recovery event logged.");
      onRecoverySaved();
    },
    onError: (error) => {
      setStatusText((error as Error).message || "Recovery logging failed.");
    },
  });

  return (
    <section className="rounded-xl border border-line bg-card/70 p-5">
      <h2 className="font-display text-xl text-foreground">Recovery Panel</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Healing is done via Bright Data CLI outside this app. Log the verified before/after counts
        here.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Records before
          </span>
          <Input
            value={recordsBefore}
            onChange={(event) => setRecordsBefore(event.target.value)}
            inputMode="numeric"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Records after
          </span>
          <Input
            value={recordsAfter}
            onChange={(event) => setRecordsAfter(event.target.value)}
            inputMode="numeric"
          />
        </label>
      </div>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Recovery note
        </span>
        <Textarea
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          placeholder="Describe what changed in the collector and how you verified the rerun."
          rows={3}
        />
      </label>

      <Button
        className="mt-3 font-mono uppercase tracking-[0.12em]"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Saving…" : "Record recovery"}
      </Button>

      {statusText ? <p className="mt-3 text-sm text-muted-foreground">{statusText}</p> : null}

      {pipeline.latestRecovery ? (
        <div className="mt-4 rounded-md border border-line p-3 text-sm">
          <p className="text-foreground">
            Latest recovery: {pipeline.latestRecovery.records_before} →{" "}
            {pipeline.latestRecovery.records_after}
          </p>
          {pipeline.latestRecovery.explanation ? (
            <p className="mt-1 text-muted-foreground">{pipeline.latestRecovery.explanation}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
