"use client";

import { motion, useReducedMotion } from "framer-motion";
import { fadeRise } from "@/lib/motion";

// Next.js re-mounts `template.tsx` on every navigation (unlike layout.tsx),
// giving us a route-change fade+rise per the motion choreography spec.
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeRise}
      transition={reduce ? { duration: 0 } : undefined}
    >
      {children}
    </motion.div>
  );
}
