"use client";

import Link from "next/link";
import { Bot, Wrench, Shuffle, UserCheck, ClipboardCheck } from "lucide-react";
import type { StepType, WorkflowSummary } from "@/components/types";
import { relativeTime } from "@/lib/format";
import { motion, useReducedMotion } from "framer-motion";
import { cardHover, cardTap, staggerItem } from "@/lib/motion";

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
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={staggerItem}
      whileHover={reduce ? undefined : cardHover}
      whileTap={reduce ? undefined : cardTap}
    >
      <Link
        href={`/workflows/${workflow.id}`}
        className="flex cursor-pointer flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-[border-color,box-shadow] duration-150 hover:border-[var(--color-accent)] hover:shadow-[0_0_0_1px_var(--color-accent),0_8px_24px_-12px_rgba(0,0,0,0.5)]"
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
