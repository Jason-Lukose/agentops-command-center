"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cardHover, cardTap, staggerItem, useCountUp } from "@/lib/motion";

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  countTo,
  format,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { direction: "up" | "down"; label: string; positive?: boolean };
  /** Raw numeric target — when provided, the card animates a count-up and
   *  renders `format(displayValue)` instead of the static `value` string. */
  countTo?: number;
  format?: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const counted = useCountUp(countTo ?? 0, reduce || countTo === undefined);
  const shown = countTo !== undefined && format ? format(counted) : value;

  return (
    <motion.div
      variants={staggerItem}
      whileHover={reduce ? undefined : cardHover}
      whileTap={reduce ? undefined : cardTap}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-none transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-foreground-muted)]">
          {label}
        </span>
        <Icon size={16} strokeWidth={1.75} className="text-[var(--color-foreground-muted)]" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tabular-nums text-3xl font-semibold">{shown}</span>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium ${
              trend.positive ? "text-[var(--color-accent)]" : "text-[var(--color-destructive)]"
            }`}
          >
            {trend.direction === "up" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {trend.label}
          </span>
        )}
      </div>
    </motion.div>
  );
}
