// Shared Framer Motion tokens + variants per docs/UX_FLOW.md "Visual & Motion Design System".
// Transform/opacity ONLY — no width/height/top/left animation, no CLS.
// Intensified pass (2026-07-12): motion dial moved from ~4/10 to ~6-7/10 —
// see docs/UX_FLOW.md "Intensified pass 2026-07-12" for the full choreography map.
import { animate, type Transition, type Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export const duration = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

export const easing = {
  enter: [0.16, 1, 0.3, 1] as const, // easeOut-ish
  exit: [0.4, 0, 1, 1] as const, // easeIn-ish
};

export const spring: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 28,
};

// Bouncier spring for expand/collapse + reorder pops (intensified pass) —
// still settles well under the 400ms ceiling.
export const springBouncy: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 24,
};

/** Returns motion props with durations zeroed out when the user prefers reduced motion. */
export function withReducedMotion(reduced: boolean | null) {
  const mult = reduced ? 0 : 1;
  return {
    fast: duration.fast * mult,
    base: duration.base * mult,
    slow: duration.slow * mult,
  };
}

// Page/content transitions — fade + rise on route change. Intensified pass:
// a touch more travel (12px) while staying within the `slow` (0.4s) budget.
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.enter },
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: { duration: duration.slow * 0.65, ease: easing.exit },
  },
};

// Dashboard metric cards — stagger entrance 40ms/card.
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.enter },
  },
};

// Faster cascade for table rows (recent runs, runs list, eval results) —
// still short enough that a 6-row page finishes staggering in <400ms.
export const rowContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.045 },
  },
};

export const rowItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.enter },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast },
  },
};

// Metric/workflow card hover lift + press feedback.
export const cardHover = { y: -2, transition: { duration: duration.fast, ease: easing.enter } };
export const cardTap = { scale: 0.98 };

// Sparkline / eval bars draw-in — scaleY from 0, transform-origin bottom.
export const growBar: Variants = {
  hidden: { scaleY: 0 },
  visible: (i: number = 0) => ({
    scaleY: 1,
    transition: { duration: duration.base, ease: easing.enter, delay: i * 0.03 },
  }),
};

// Failure reveal — subtle shake-once on error panel mount.
export const shakeOnce = {
  x: [0, -4, 4, -2, 0],
  transition: { duration: 0.3, ease: easing.enter },
};

// Success reveal — SVG checkmark draw (pathLength 0 -> 1).
export const checkDraw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: duration.slow, ease: easing.enter },
  },
};

// Running-step / running-badge breathing glow — opacity-only pulse on a
// static-shadow overlay (never animates box-shadow itself, so it stays
// transform/opacity-only per the motion constraints).
export const glowPulse: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: [0.25, 0.7, 0.25],
    transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
  },
};

// Expand/collapse (trace step cards, accordions).
export const expand: Variants = {
  collapsed: { opacity: 0, height: 0 },
  expanded: {
    opacity: 1,
    height: "auto",
    transition: { ...spring },
  },
};

// Modal overlay + panel.
export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
};

export const modalPanel: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.enter },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: { duration: duration.fast, ease: easing.exit },
  },
};

// Result reveal (success/fail panel).
export const resultReveal: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.base, ease: easing.enter },
  },
};

// List item add/remove (workflow builder steps).
export const listItem: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.enter },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: duration.fast, ease: easing.exit },
  },
};

export const pressScale = { scale: 0.98 };

/**
 * Animated number count-up for metric values. Respects reduced-motion by
 * jumping straight to the target (no tween). Callers format the raw number
 * at render time (e.g. formatPercent, toLocaleString) so this stays
 * unit-agnostic.
 */
export function useCountUp(target: number, reduced: boolean | null | undefined): number {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  const hasMounted = useRef(false);

  useEffect(() => {
    // Reduced motion: skip the tween entirely — render() below returns
    // `target` directly, no setState needed here.
    if (reduced) return;
    const from = hasMounted.current ? prevTarget.current : 0;
    hasMounted.current = true;
    const controls = animate(from, target, {
      duration: duration.slow,
      ease: easing.enter,
      onUpdate: (v) => setValue(v),
    });
    prevTarget.current = target;
    return () => controls.stop();
  }, [target, reduced]);

  return reduced ? target : value;
}
