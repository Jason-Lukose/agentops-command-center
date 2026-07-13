"use client";

import { Play } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { RunWorkflowModal } from "@/components/workflows/RunWorkflowModal";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/workflows": "Workflows",
  "/runs": "Runs",
  "/evaluations": "Evaluations",
};

function pageTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/workflows/new")) return "New Workflow";
  if (pathname.startsWith("/workflows/")) return "Workflow";
  if (pathname.startsWith("/runs/")) return "Run Trace";
  return "AgentOps";
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [runModalOpen, setRunModalOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)]/90 pl-16 pr-4 backdrop-blur xl:pl-56">
      <div className="flex items-center gap-3 px-4">
        <h1 className="text-lg font-semibold tracking-tight">{pageTitle(pathname)}</h1>
      </div>
      <div className="flex items-center gap-3 px-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-foreground-muted)] sm:flex">
          <span className="status-pulse h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          Local &middot; Mock Provider
        </span>
        <button
          onClick={() => setRunModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-foreground)] transition-transform active:scale-[0.98]"
        >
          <Play size={14} fill="currentColor" />
          Run demo workflow
        </button>
      </div>
      <RunWorkflowModal
        open={runModalOpen}
        onClose={() => setRunModalOpen(false)}
        onRun={(runId) => {
          setRunModalOpen(false);
          router.push(`/runs/${runId}`);
        }}
      />
    </header>
  );
}
