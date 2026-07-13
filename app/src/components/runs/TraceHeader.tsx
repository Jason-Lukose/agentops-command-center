"use client";

import { motion } from "framer-motion";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCost, formatLatency, formatTokens, relativeTime } from "@/lib/format";
import { resultReveal } from "@/lib/motion";
import type { Run, StepExecution } from "@/components/types";

export function TraceHeader({
  run,
  workflowName,
  steps,
}: {
  run: Run;
  workflowName?: string;
  steps: StepExecution[];
}) {
  const totalTokensIn = steps.reduce((s, x) => s + (x.tokensIn ?? 0), 0);
  const totalTokensOut = steps.reduce((s, x) => s + (x.tokensOut ?? 0), 0);
  const totalCost = steps.reduce((s, x) => s + Number(x.costEstimate ?? 0), 0);
  const isTerminal = ["succeeded", "failed", "canceled"].includes(run.status);

  return (
    <motion.div
      variants={resultReveal}
      initial={isTerminal ? "hidden" : false}
      animate="visible"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--color-foreground-muted)]">
            {workflowName ?? "Workflow"}
          </p>
          <h2 className="mt-0.5 font-mono text-sm text-[var(--color-foreground-muted)]">{run.id}</h2>
        </div>
        <StatusBadge status={run.status} className="text-sm" />
      </div>

      {run.status === "queued" && (
        <p className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground-muted)]">
          Waiting for the worker to pick this up. If this persists, check that the worker process
          is running (<code className="font-mono">npm run worker</code>).
        </p>
      )}

      {run.status === "failed" && run.errorMessage && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {run.errorMessage}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Latency" value={formatLatency(run.latencyMs)} />
        <Stat label="Tokens in/out" value={`${formatTokens(totalTokensIn)} / ${formatTokens(totalTokensOut)}`} />
        <Stat label="Cost (est.)" value={formatCost(totalCost)} />
        <Stat label="Started" value={run.startedAt ? relativeTime(run.startedAt) : "—"} />
        <Stat label="Finished" value={run.finishedAt ? relativeTime(run.finishedAt) : "—"} />
      </dl>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-foreground-muted)]">{label}</dt>
      <dd className="tabular-nums text-sm font-medium">{value}</dd>
    </div>
  );
}
