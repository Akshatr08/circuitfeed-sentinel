import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BackgroundMesh } from "@/components/background-mesh";
import { WebDiagram } from "@/components/web-diagram";
import { AskSentinel } from "@/components/ask-sentinel";
import { PipelineHealth } from "@/components/pipeline-health";
import { RecoveryPanel } from "@/components/recovery-panel";
import { getPipelineState, triggerScrapeRun } from "@/lib/pipeline.functions";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const queryClient = useQueryClient();
  const [askActive, setAskActive] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);

  const pipelineQuery = useQuery({
    queryKey: ["pipeline-state"],
    queryFn: () => getPipelineState(),
    refetchInterval: 15_000,
  });

  const scrapeMutation = useMutation({
    mutationFn: async () => triggerScrapeRun(),
    onMutate: () => setScrapeMessage(null),
    onSuccess: (result) => {
      if (result.ok) {
        setScrapeMessage(
          result.reasons.length > 0
            ? `Run completed with drift signals: ${result.reasons.join(" · ")}`
            : "Run completed healthy.",
        );
      } else {
        setScrapeMessage(result.message);
      }
      queryClient.invalidateQueries({ queryKey: ["pipeline-state"] });
    },
    onError: (error) => {
      setScrapeMessage((error as Error).message || "Failed to trigger scrape.");
    },
  });

  if (pipelineQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-mono text-sm uppercase tracking-[0.16em] text-muted-foreground">
          Loading CircuitFeed Sentinel…
        </p>
      </main>
    );
  }

  if (pipelineQuery.isError || !pipelineQuery.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="max-w-lg text-center text-sm text-destructive">
          {(pipelineQuery.error as Error)?.message || "Could not load pipeline state."}
        </p>
      </main>
    );
  }

  const pipeline = pipelineQuery.data;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-8">
      <BackgroundMesh />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="rounded-xl border border-line bg-card/70 p-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            CircuitFeed Sentinel
          </p>
          <h1 className="mt-2 font-display text-4xl text-foreground">
            Web intelligence that fixes itself.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Collector <span className="font-mono text-xs">{pipeline.collectorId}</span> · Web
            integrity: {pipeline.integrity === null ? "N/A" : `${pipeline.integrity}%`}
          </p>
        </header>

        <WebDiagram
          condition={pipeline.condition}
          scrapeActive={scrapeMutation.isPending}
          askActive={askActive}
        />

        <AskSentinel onAskLifecycle={setAskActive} />

        <div className="grid gap-5 lg:grid-cols-2">
          <PipelineHealth
            pipeline={pipeline}
            scrapePending={scrapeMutation.isPending}
            scrapeMessage={scrapeMessage}
            onTriggerScrape={() => scrapeMutation.mutate()}
          />
          <RecoveryPanel
            pipeline={pipeline}
            onRecoverySaved={() => queryClient.invalidateQueries({ queryKey: ["pipeline-state"] })}
          />
        </div>
      </div>
    </main>
  );
}
