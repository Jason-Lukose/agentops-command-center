// Shared Framer Motion tokens + variants per docs/UX_FLOW.md "Visual & Motion Design System".
// Transform/opacity ONLY — no width/height/top/left animation, no CLS.
import type { Transition, Variants } from "framer-motion";

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

/** Returns motion props with durations zeroed out when the user prefers reduced motion. */
export function withReducedMotion(reduced: boolean | null) {
  const mult = reduced ? 0 : 1;
  return {
    fast: duration.fast * mult,
    base: duration.base * mult,
    slow: duration.slow * mult,
  };
}

// Page/content transitions — fade + rise 8px on route change.
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.enter },
  },
  exit: {
    opacity: 0,
    y: 4,
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
