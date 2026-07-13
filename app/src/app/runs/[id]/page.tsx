"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { TraceHeader } from "@/components/runs/TraceHeader";
import { StepCard } from "@/components/runs/StepCard";
import { EvalResultsSection } from "@/components/runs/EvalResultsSection";
import { fetcher } from "@/lib/fetcher";
import { staggerContainer } from "@/lib/motion";
import type { RunDetail, Workflow } from "@/components/types";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

export default function RunTracePage() {
  const params = useParams<{ id: string }>();
  const { data, error, isLoading, mutate } = useSWR<RunDetail>(
    params.id ? `/api/runs/${params.id}` : null,
    fetcher,
    {
      refreshInterval: (latest) => {
        const run = (latest as RunDetail | undefined)?.run;
        return run && !TERMINAL.has(run.status) ? 2000 : 0;
      },
    }
  );

  const { data: workflowData } = useSWR<{ workflow: Workflow }>(
    data?.run.workflowId ? `/api/workflows/${data.run.workflowId}` : null,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32 w-full" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        message="Could not load this run. It may not exist, or the server is unreachable."
        onRetry={() => mutate()}
      />
    );
  }

  const orderedSteps = [...data.steps].sort((a, b) => a.position - b.position);
  const stepDefsById = new Map(
    (workflowData?.workflow.steps ?? []).map((s) => [s.id, { type: s.type, name: s.name }])
  );

  return (
    <div className="flex flex-col gap-8" aria-live="polite">
      <TraceHeader run={data.run} workflowName={workflowData?.workflow.name} steps={orderedSteps} />

      <section>
        <h2 className="mb-4 text-base font-semibold">Trace</h2>
        {orderedSteps.length === 0 ? (
          <p className="text-sm text-[var(--color-foreground-muted)]">
            No steps have started yet.
          </p>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col"
          >
            {orderedSteps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                index={i}
                onApprovalDecided={() => mutate()}
                stepDef={stepDefsById.get(step.stepId)}
              />
            ))}
          </motion.div>
        )}
      </section>

      <EvalResultsSection evaluations={data.evaluations} />
    </div>
  );
}
