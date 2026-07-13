"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, ListChecks, Play, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/runs", label: "Runs", icon: Play },
  { href: "/evaluations", label: "Evaluations", icon: ListChecks },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-16 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] xl:w-56">
      <div className="flex h-14 items-center gap-2 border-b border-[var(--color-border)] px-3 xl:px-5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)] font-mono text-sm font-bold text-[var(--color-accent-foreground)]">
          A
        </div>
        <span className="hidden text-sm font-semibold tracking-tight xl:inline">AgentOps</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2 xl:p-3">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className="relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md bg-[var(--color-muted)]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {active && (
                <motion.span
                  layoutId="sidebar-active-bar"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-accent)]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon
                size={18}
                strokeWidth={1.75}
                className={`relative shrink-0 ${active ? "text-[var(--color-foreground)]" : ""}`}
              />
              <span className={`relative hidden xl:inline ${active ? "text-[var(--color-foreground)]" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
