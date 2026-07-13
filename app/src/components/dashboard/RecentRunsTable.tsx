"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatLatency, relativeTime } from "@/lib/format";
import { rowContainer, rowItem } from "@/lib/motion";
import type { RunSummary } from "@/components/types";
import { Play } from "lucide-react";

const ACTIVE_STATUSES = new Set(["queued", "running", "awaiting_approval"]);

export function RecentRunsTable({ runs }: { runs: RunSummary[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Play}
        title="No runs yet"
        description="Run the sample workflow to see a live trace here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-muted)] text-xs uppercase tracking-wide text-[var(--color-foreground-muted)]">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Run</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="px-4 py-2 text-left font-medium">Latency</th>
            <th className="px-4 py-2 text-left font-medium">Created</th>
          </tr>
        </thead>
        <motion.tbody variants={rowContainer} initial="hidden" animate="visible">
          <AnimatePresence initial={false}>
            {runs.map((run) => (
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/runs/${run.id}`);
                }}
                className={`cursor-pointer border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] ${
                  ACTIVE_STATUSES.has(run.status) ? "row-shimmer" : ""
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
              </motion.tr>
            ))}
          </AnimatePresence>
        </motion.tbody>
      </table>
    </div>
  );
}
