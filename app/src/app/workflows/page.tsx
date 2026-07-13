"use client";

import useSWR from "swr";
import { motion } from "framer-motion";
import Link from "next/link";
import { Plus, Workflow as WorkflowIcon } from "lucide-react";
import { WorkflowCard } from "@/components/workflows/WorkflowCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetcher } from "@/lib/fetcher";
import { staggerContainer } from "@/lib/motion";
import type { WorkflowSummary } from "@/components/types";

export default function WorkflowsPage() {
  const { data, error, isLoading, mutate } = useSWR<{ workflows: WorkflowSummary[] }>(
    "/api/workflows",
    fetcher
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-foreground-muted)]">
          Ordered step pipelines you can run and trace.
        </p>
        <Link
          href="/workflows/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-foreground)] transition-transform active:scale-[0.98]"
        >
          <Plus size={14} />
          New workflow
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {error && <ErrorState message="Could not load workflows." onRetry={() => mutate()} />}

      {!isLoading && !error && data && data.workflows.length === 0 && (
        <EmptyState
          icon={WorkflowIcon}
          title="No workflows yet"
          description="Create your first workflow to define an ordered pipeline of steps."
          actionLabel="New workflow"
          actionHref="/workflows/new"
        />
      )}

      {!isLoading && !error && data && data.workflows.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {data.workflows.map((wf) => (
            <WorkflowCard key={wf.id} workflow={wf} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
