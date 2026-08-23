import type { PipelineCondition } from "@/lib/types";

interface WebDiagramProps {
  condition: PipelineCondition;
  scrapeActive: boolean;
  askActive: boolean;
}

interface NodePoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

const NODES: NodePoint[] = [
  { id: "source", label: "Source", x: 90, y: 110 },
  { id: "collector", label: "Collector", x: 250, y: 70 },
  { id: "validation", label: "Validation", x: 420, y: 115 },
  { id: "supabase", label: "Supabase", x: 590, y: 75 },
  { id: "gemini", label: "Gemini", x: 760, y: 120 },
  { id: "answer", label: "Answer", x: 930, y: 80 },
];

const BROKEN_THREAD_INDEX = 1;

export function WebDiagram({ condition, scrapeActive, askActive }: WebDiagramProps) {
  const isDrift = condition === "drift";
  const isRepaired = condition === "repaired";

  return (
    <section className="rounded-xl border border-line bg-card/70 p-5 fade-in">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground">The Web</h2>
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Source → Collector → Validation → Supabase → Gemini → Answer
        </span>
      </div>

      <svg className="w-full" viewBox="0 0 1020 190" role="img" aria-label="Pipeline thread graph">
        {NODES.slice(0, -1).map((node, index) => {
          const next = NODES[index + 1];
          const x1 = node.x + 18;
          const y1 = node.y;
          const x2 = next.x - 18;
          const y2 = next.y;
          const activeScrapeThread = scrapeActive && (index === 0 || index === 1);
          const activeAskThread = askActive && (index === 3 || index === 4);
          const showPulse = activeScrapeThread || activeAskThread;
          const isBroken = isDrift && index === BROKEN_THREAD_INDEX;
          const isRepairing = isRepaired && index === BROKEN_THREAD_INDEX;
          const className = isBroken ? "thread-frayed" : isRepairing ? "thread-repaired" : "";

          return (
            <g key={`${node.id}-${next.id}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                pathLength={100}
                className={className}
                stroke={isBroken ? "var(--fray)" : "var(--thread)"}
                strokeWidth={1.8}
                strokeDasharray={isBroken ? "7 5" : undefined}
                strokeLinecap="round"
              />
              {showPulse ? (
                <circle r="4" fill="var(--thread)" className="pulse-dot">
                  <animateMotion
                    dur="1.4s"
                    repeatCount="indefinite"
                    path={`M ${x1} ${y1} L ${x2} ${y2}`}
                  />
                </circle>
              ) : null}
            </g>
          );
        })}

        {NODES.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            <circle r="18" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.2" />
            <circle r="5" fill="var(--thread)" className="pulse-dot" />
            <text
              y="34"
              textAnchor="middle"
              className="fill-foreground font-mono text-[11px] uppercase tracking-[0.18em]"
            >
              {node.label}
            </text>
          </g>
        ))}

        {isDrift ? (
          <text
            x="330"
            y="44"
            className="fill-destructive font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            Thread severed
          </text>
        ) : null}
        {isRepaired ? (
          <text
            x="330"
            y="44"
            className="fill-primary font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            Thread repaired
          </text>
        ) : null}
      </svg>
    </section>
  );
}
