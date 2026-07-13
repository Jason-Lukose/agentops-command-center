"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, RotateCw } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JsonPanel } from "@/components/ui/JsonPanel";
import { ApprovalActions } from "@/components/runs/ApprovalActions";
import { STEP_ICONS } from "@/components/workflows/WorkflowCard";
import { formatCost, formatLatency, formatTokens, titleCase } from "@/lib/format";
import { springBouncy, duration, shakeOnce, staggerItem } from "@/lib/motion";
import type { StepExecution, StepType } from "@/components/types";

export function StepCard({
  step,
  index,
  onApprovalDecided,
  stepDef,
}: {
  step: StepExecution;
  index: number;
  onApprovalDecided: () => void;
  /** Step definition (type/name) looked up from the parent workflow — the
   *  run trace API does not join this in, see docs/API_SPEC.md GET /api/runs/{id}. */
  stepDef?: { type: StepType; name: string };
}) {
  const [open, setOpen] = useState(step.status === "awaiting_approval" || step.status === "failed");
  const reduce = useReducedMotion();
  const type = stepDef?.type ?? step.stepType ?? ("llm_prompt" as StepType);
  const stepName = stepDef?.name ?? step.stepName;
  const Icon = STEP_ICONS[type] ?? STEP_ICONS.llm_prompt;
  const hasCost = step.tokensIn != null || step.tokensOut != null || step.costEstimate != null;

  return (
    <motion.div variants={staggerItem} className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground-muted)]">
          <Icon size={15} strokeWidth={1.75} />
        </span>
        <motion.span
          className="mt-1 w-px flex-1 bg-[var(--color-border)]"
          style={{ transformOrigin: "top" }}
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: duration.base, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : 0.1 }}
          aria-hidden
        />
      </div>

      <div className="mb-5 flex-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--color-border-strong)]"
        >
          <span className="text-xs font-mono text-[var(--color-foreground-muted)]">#{index + 1}</span>
          <span className="flex-1 truncate text-sm font-medium">
            {stepName ?? titleCase(type)}
          </span>
          {step.retryCount > 0 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
              {step.retryCount} retr{step.retryCount === 1 ? "y" : "ies"}
            </span>
          )}
          <span className="text-xs tabular-nums text-[var(--color-foreground-muted)]">
            {formatLatency(step.latencyMs)}
          </span>
          <StatusBadge status={step.status} />
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: duration.fast }}
            className="text-[var(--color-foreground-muted)]"
          >
            <ChevronRight size={16} />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={reduce ? { duration: 0 } : springBouncy}
              className="overflow-hidden"
            >
              <div className="mt-2 flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                {hasCost && (
                  <div className="flex flex-wrap gap-4 text-xs text-[var(--color-foreground-muted)]">
                    <span>
                      Tokens in/out:{" "}
                      <span className="tabular-nums text-[var(--color-foreground)]">
                        {formatTokens(step.tokensIn)} / {formatTokens(step.tokensOut)}
                      </span>
                    </span>
                    <span>
                      Cost (est.):{" "}
                      <span className="tabular-nums text-[var(--color-foreground)]">
                        {formatCost(step.costEstimate)}
                      </span>
                    </span>
                  </div>
                )}

                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: duration.base, ease: [0.16, 1, 0.3, 1] }}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  <JsonPanel label="Input" value={step.input} />
                  <JsonPanel label="Output" value={step.output} />
                </motion.div>

                {step.status === "failed" && (
                  <motion.div
                    initial={reduce ? false : { opacity: 0 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, ...shakeOnce }}
                    className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
                  >
                    <RotateCw size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Step failed</p>
                      <p className="mt-0.5 text-red-300/90">
                        {step.errorMessage ?? "No error message provided."}
                      </p>
                      {step.retryCount > 0 && (
                        <p className="mt-1 text-xs text-red-300/70">
                          Retried {step.retryCount} time{step.retryCount === 1 ? "" : "s"} before failing.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {step.status === "awaiting_approval" && (
                  <ApprovalActions runId={step.runId} onDecided={onApprovalDecided} />
                )}

                {step.approvalDecidedAt && (
                  <p className="text-xs text-[var(--color-foreground-muted)]">
                    Decision recorded {new Date(step.approvalDecidedAt).toLocaleString()}.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
