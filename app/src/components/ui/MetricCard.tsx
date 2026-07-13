"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { staggerItem } from "@/lib/motion";

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { direction: "up" | "down"; label: string; positive?: boolean };
}) {
  return (
    <motion.div
      variants={staggerItem}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-foreground-muted)]">
          {label}
        </span>
        <Icon size={16} strokeWidth={1.75} className="text-[var(--color-foreground-muted)]" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tabular-nums text-3xl font-semibold">{value}</span>
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
