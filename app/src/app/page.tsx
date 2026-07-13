"use client";

import useSWR from "swr";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Gauge, XOctagon } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { RecentRunsTable } from "@/components/dashboard/RecentRunsTable";
import { Sparkline } from "@/components/ui/Sparkline";
import { fetcher } from "@/lib/fetcher";
import { formatLatency, formatPercent, formatScore } from "@/lib/format";
import { staggerContainer } from "@/lib/motion";
import type { DashboardData } from "@/components/types";
import { RunWorkflowModal } from "@/components/workflows/RunWorkflowModal";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>("/api/dashboard", fetcher);
  const router = useRouter();
  const [runModalOpen, setRunModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-6 w-40" />
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} cols={4} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState message="Could not load dashboard metrics." onRetry={() => mutate()} />
      </div>
    );
  }

  const totals = data?.totals ?? { runs: 0, succeeded: 0, failed: 0, successRate: 0 };
  const isEmpty = totals.runs === 0;

  const evalValues = [
    data?.evalScores.deterministic,
    data?.evalScores.rubric,
    data?.evalScores.llm_judge,
  ].filter((v): v is number => v !== null && v !== undefined);

  return (
    <div className="flex flex-col gap-8">
      {isEmpty ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No activity yet"
          description="Run the sample workflow to populate the dashboard with real metrics and a trace."
          actionLabel="Run sample workflow"
          onAction={() => setRunModalOpen(true)}
        />
      ) : (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            <MetricCard label="Total Runs" value={totals.runs.toLocaleString()} icon={Activity} />
            <MetricCard
              label="Success Rate"
              value={formatPercent(totals.successRate)}
              icon={CheckCircle2}
              trend={{
                direction: totals.successRate >= 0.9 ? "up" : "down",
                label: `${totals.succeeded} succeeded`,
                positive: totals.successRate >= 0.9,
              }}
            />
            <MetricCard label="Avg Latency" value={formatLatency(data?.avgLatencyMs)} icon={Gauge} />
            <MetricCard
              label="Failed Steps"
              value={(data?.failedStepCount ?? 0).toLocaleString()}
              icon={XOctagon}
            />
          </motion.div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Recent runs</h2>
              <button
                onClick={() => router.push("/runs")}
                className="text-xs font-medium text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
              >
                View all
              </button>
            </div>
            <RecentRunsTable runs={data?.recentRuns ?? []} />
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">Evaluation summary</h2>
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2">
              <div className="grid grid-cols-3 gap-4">
                <ScoreTile label="Deterministic" value={data?.evalScores.deterministic ?? null} />
                <ScoreTile label="Rubric" value={data?.evalScores.rubric ?? null} />
                <ScoreTile label="LLM Judge" value={data?.evalScores.llm_judge ?? null} />
              </div>
              <div className="flex items-center justify-end">
                {evalValues.length > 0 ? (
                  <Sparkline values={evalValues} width={140} height={36} />
                ) : (
                  <span className="text-xs text-[var(--color-foreground-muted)]">
                    No evaluation scores yet
                  </span>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      <RunWorkflowModal
        open={runModalOpen}
        onClose={() => setRunModalOpen(false)}
        onRun={(runId) => {
          setRunModalOpen(false);
          router.push(`/runs/${runId}`);
        }}
      />
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-foreground-muted)]">{label}</p>
      <p className="tabular-nums text-xl font-semibold">{formatScore(value)}</p>
    </div>
  );
}
