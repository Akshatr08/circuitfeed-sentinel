import type { PipelineState } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface PipelineHealthProps {
  pipeline: PipelineState;
  scrapePending: boolean;
  scrapeMessage: string | null;
  onTriggerScrape: () => void;
}

const conditionLabel: Record<PipelineState["condition"], string> = {
  idle: "Idle",
  healthy: "System operational",
  drift: "Thread severed",
  repaired: "Thread repaired",
};

export function PipelineHealth({
  pipeline,
  scrapePending,
  scrapeMessage,
  onTriggerScrape,
}: PipelineHealthProps) {
  return (
    <section className="rounded-xl border border-line bg-card/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-foreground">Pipeline Health</h2>
        <Button
          onClick={onTriggerScrape}
          disabled={scrapePending}
          className="font-mono uppercase tracking-[0.12em]"
        >
          {scrapePending ? "Running scrape…" : "Trigger scrape"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Metric label="Collector" value={pipeline.collectorId} mono />
        <Metric
          label="Status"
          value={conditionLabel[pipeline.condition]}
          danger={pipeline.condition === "drift"}
        />
        <Metric
          label="Web integrity"
          value={pipeline.integrity === null ? "Not available yet" : `${pipeline.integrity}%`}
        />
        <Metric label="Stored records" value={`${pipeline.hackathonCount}`} />
        <Metric label="Last run records" value={`${pipeline.latestRun?.record_count ?? 0}`} />
        <Metric
          label="Last valid records"
          value={`${pipeline.latestRun?.valid_record_count ?? 0}`}
        />
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Source:{" "}
        <a
          href={pipeline.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          {pipeline.sourceName}
        </a>
      </p>

      {pipeline.latestRun?.error_message && pipeline.latestRun.status !== "healthy" ? (
        <p className="mt-2 break-words text-sm text-destructive">
          {pipeline.latestRun.error_message.split("\n\n[RAW]")[0]}
        </p>
      ) : null}
      {scrapeMessage ? <p className="mt-2 text-sm text-muted-foreground">{scrapeMessage}</p> : null}
    </section>
  );
}

function Metric({
  label,
  value,
  mono = false,
  danger = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border border-line p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p
        className={`mt-1 ${mono ? "font-mono text-xs break-all" : ""} ${danger ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
