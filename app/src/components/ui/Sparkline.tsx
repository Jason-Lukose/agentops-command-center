"use client";

import { motion, useReducedMotion } from "framer-motion";
import { growBar } from "@/lib/motion";

/** Minimal inline SVG bar sparkline — no chart library. */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  passed,
}: {
  values: number[];
  width?: number;
  height?: number;
  passed?: boolean[];
}) {
  const reduce = useReducedMotion();

  if (values.length === 0) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-xs text-[var(--color-foreground-muted)]"
      >
        No data
      </div>
    );
  }
  const barWidth = width / values.length;
  return (
    <svg width={width} height={height} role="img" aria-label="Score history sparkline">
      {values.map((v, i) => {
        const clamped = Math.max(0, Math.min(1, v));
        const barHeight = Math.max(2, clamped * height);
        const color =
          passed === undefined
            ? "var(--color-info)"
            : passed[i]
              ? "var(--color-accent)"
              : "var(--color-destructive)";
        return (
          <motion.rect
            key={i}
            x={i * barWidth + 1}
            y={height - barHeight}
            width={Math.max(2, barWidth - 2)}
            height={barHeight}
            fill={color}
            rx={1}
            style={{ transformOrigin: `bottom`, transformBox: "fill-box" }}
            custom={i}
            variants={reduce ? undefined : growBar}
            initial={reduce ? undefined : "hidden"}
            animate={reduce ? undefined : "visible"}
          />
        );
      })}
    </svg>
  );
}
