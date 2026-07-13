"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronRight, ClipboardCheck, XCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { JsonPanel } from "@/components/ui/JsonPanel";
import { Sparkline } from "@/components/ui/Sparkline";
import { fetcher } from "@/lib/fetcher";
import { formatPercent, formatScore, relativeTime, titleCase } from "@/lib/format";
import { spring } from "@/lib/motion";
import type { EvaluationResult, EvaluatorType } from "@/components/types";

const EVALUATOR_TYPES: EvaluatorType[] = ["deterministic", "rubric", "llm_judge"];

export default function EvaluationsPage() {
  const { data, error, isLoading, mutate } = useSWR<{ evaluations: EvaluationResult[] }>(
    "/api/evaluations?limit=100",
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message="Could not load evaluations." onRetry={() => mutate()} />;
  }

  const evaluations = data?.evaluations ?? [];

  if (evaluations.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No evaluations yet"
        description="Run a workflow that includes an evaluation step to see scores here."
        actionLabel="Go to workflows"
        actionHref="/workflows"
      />
    );
  }

  const sorted = [...evaluations].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const passRate = evaluations.filter((e) => e.passed).length / evaluations.length;
  const scores = sorted.map((e) => e.score);
  const passed = sorted.map((e) => e.passed);
  const recent = [...evaluations]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 25);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryTile label="Total evaluations" value={evaluations.length.toLocaleString()} />
        <SummaryTile label="Pass rate" value={formatPercent(passRate)} />
        {EVALUATOR_TYPES.map((t) => {
          const forType = evaluations.filter((e) => e.evaluatorType === t);
          const avg =
            forType.length > 0 ? forType.reduce((s, e) => s + e.score, 0) / forType.length : null;
          return (
            <SummaryTile key={t} label={titleCase(t)} value={formatScore(avg)} sub={`${forType.length} runs`} />
          );
        })}
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold">Score history</h2>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <Sparkline values={scores} passed={passed} width={480} height={48} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Recent results</h2>
        <div className="flex flex-col gap-2">
          {recent.map((ev) => (
            <EvalRow key={ev.id} ev={ev} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs text-[var(--color-foreground-muted)]">{label}</p>
      <p className="tabular-nums mt-1 text-xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-[var(--color-foreground-muted)]">{sub}</p>}
    </div>
  );
}

function EvalRow({ ev }: { ev: EvaluationResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm"
      >
        {ev.passed ? (
          <CheckCircle2 size={15} className="shrink-0 text-[var(--color-accent)]" />
        ) : (
          <XCircle size={15} className="shrink-0 text-[var(--color-destructive)]" />
        )}
        <span className="font-medium">{titleCase(ev.evaluatorType)}</span>
        <span className="tabular-nums text-[var(--color-foreground-muted)]">
          score {formatScore(ev.score)}
        </span>
        <Link
          href={`/runs/${ev.runId}`}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto text-xs text-[var(--color-info)] hover:underline"
        >
          View run
        </Link>
        <span className="text-xs text-[var(--color-foreground-muted)]">{relativeTime(ev.createdAt)}</span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-[var(--color-foreground-muted)]">
          <ChevronRight size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="overflow-hidden px-4 pb-4"
          >
            <JsonPanel label="Details" value={ev.details} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
