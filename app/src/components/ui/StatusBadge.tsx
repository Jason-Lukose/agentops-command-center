"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  OctagonX,
  PauseCircle,
  XCircle,
} from "lucide-react";
import type { RunStatus, StepStatus } from "@/components/types";
import { duration } from "@/lib/motion";
import { titleCase } from "@/lib/format";

type Status = RunStatus | StepStatus;

const STATUS_META: Record<
  Status,
  { label: string; className: string; Icon: typeof CheckCircle2; pulse?: boolean }
> = {
  queued: {
    label: "Queued",
    className: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    Icon: CircleDashed,
  },
  pending: {
    label: "Pending",
    className: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    Icon: CircleDashed,
  },
  running: {
    label: "Running",
    className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    Icon: Loader2,
    pulse: true,
  },
  awaiting_approval: {
    label: "Awaiting Approval",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    Icon: PauseCircle,
  },
  succeeded: {
    label: "Succeeded",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    Icon: XCircle,
  },
  canceled: {
    label: "Canceled",
    className: "bg-slate-600/15 text-slate-400 border-slate-600/30",
    Icon: OctagonX,
  },
  skipped: {
    label: "Skipped",
    className: "bg-slate-600/15 text-slate-400 border-slate-600/30",
    Icon: OctagonX,
  },
};

export function StatusBadge({ status, className = "" }: { status: Status; className?: string }) {
  const meta = STATUS_META[status] ?? {
    label: titleCase(status),
    className: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    Icon: CircleDashed,
  };
  const { Icon } = meta;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: duration.fast }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className} ${className}`}
      >
        <Icon
          size={12}
          strokeWidth={2}
          className={meta.pulse ? "status-pulse animate-spin" : undefined}
        />
        {meta.label}
      </motion.span>
    </AnimatePresence>
  );
}
