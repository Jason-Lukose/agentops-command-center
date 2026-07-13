"use client";

import useSWR from "swr";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Play } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { fetcher } from "@/lib/fetcher";
import { formatLatency, relativeTime } from "@/lib/format";
import { rowContainer, rowItem } from "@/lib/motion";
import type { RunStatus, RunSummary } from "@/components/types";

const STATUS_FILTERS: (RunStatus | "all")[] = [
  "all",
  "queued",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
  "canceled",
];

const ACTIVE_STATUSES: RunStatus[] = ["queued", "running", "awaiting_approval"];

export default function RunsPage() {
  const [status, setStatus] = useState<RunStatus | "all">("all");
  const router = useRouter();
  const reduce = useReducedMotion();

  const url = status === "all" ? "/api/runs" : `/api/runs?status=${status}`;
  const { data, error, isLoading, mutate } = useSWR<{ runs: RunSummary[] }>(url, fetcher, {
    refreshInterval: (latest) => {
      const runs = (latest as { runs: RunSummary[] } | undefined)?.runs ?? [];
      return runs.some((r) => ACTIVE_STATUSES.includes(r.status)) ? 2000 : 0;
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter runs by status">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
              status === s
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:bg-[var(--color-muted)]"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} cols={5} />
          ))}
        </div>
      )}

      {error && <ErrorState message="Could not load runs." onRetry={() => mutate()} />}

      {!isLoading && !error && data && data.runs.length === 0 && (
        <EmptyState
          icon={Play}
          title="No runs yet"
          description="Run the sample workflow to see it here."
          actionLabel="Go to workflows"
          actionHref="/workflows"
        />
      )}

      {!isLoading && !error && data && data.runs.length > 0 && (
        <div
          className="overflow-hidden rounded-lg border border-[var(--color-border)]"
          aria-live="polite"
        >
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)] text-xs uppercase tracking-wide text-[var(--color-foreground-muted)]">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Run</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Latency</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-left font-medium">Finished</th>
              </tr>
            </thead>
            <motion.tbody variants={rowContainer} initial="hidden" animate="visible">
              <AnimatePresence initial={false}>
                {data.runs.map((run) => (
                  <motion.tr
                    key={run.id}
                    layout={!reduce}
                    variants={rowItem}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    tabIndex={0}
                    role="button"
                    onClick={() => router.push(`/runs/${run.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/runs/${run.id}`)}
                    className={`cursor-pointer border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] ${
                      ACTIVE_STATUSES.includes(run.status) ? "row-shimmer" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-foreground-muted)]">
                      {run.id.slice(0, 10)}…
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{formatLatency(run.latencyMs)}</td>
                    <td className="px-4 py-2.5 text-[var(--color-foreground-muted)]">
                      {relativeTime(run.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-foreground-muted)]">
                      {run.finishedAt ? relativeTime(run.finishedAt) : "—"}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </motion.tbody>
          </table>
        </div>
      )}
    </div>
  );
}
