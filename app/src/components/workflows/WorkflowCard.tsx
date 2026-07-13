"use client";

import Link from "next/link";
import { Bot, Wrench, Shuffle, UserCheck, ClipboardCheck } from "lucide-react";
import type { StepType, WorkflowSummary } from "@/components/types";
import { relativeTime } from "@/lib/format";
import { motion } from "framer-motion";
import { staggerItem } from "@/lib/motion";

const STEP_ICONS: Record<StepType, typeof Bot> = {
  llm_prompt: Bot,
  tool_api: Wrench,
  transform: Shuffle,
  approval: UserCheck,
  eval: ClipboardCheck,
};

export function WorkflowCard({
  workflow,
  stepTypes = [],
}: {
  workflow: WorkflowSummary;
  stepTypes?: StepType[];
}) {
  return (
    <motion.div variants={staggerItem}>
      <Link
        href={`/workflows/${workflow.id}`}
        className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-border-strong)]"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium">{workflow.name}</h3>
            {workflow.description && (
              <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-foreground-muted)]">
                {workflow.description}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-foreground-muted)]">
            {workflow.stepCount} step{workflow.stepCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {stepTypes.slice(0, 6).map((t, i) => {
              const Icon = STEP_ICONS[t];
              return (
                <span
                  key={i}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-muted)] text-[var(--color-foreground-muted)]"
                  title={t}
                >
                  <Icon size={13} strokeWidth={1.75} />
                </span>
              );
            })}
          </div>
          <span className="text-xs text-[var(--color-foreground-muted)]">
            Updated {relativeTime(workflow.updatedAt)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export { STEP_ICONS };
