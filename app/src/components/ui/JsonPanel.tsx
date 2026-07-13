"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { prettyJson } from "@/lib/format";

export function JsonPanel({ label, value }: { label: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = prettyJson(value);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — no-op, non-critical
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-background)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-foreground-muted)]">
          {label}
        </span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)]"
          aria-label={`Copy ${label} JSON`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-72 overflow-auto p-3 font-mono text-xs leading-relaxed text-[var(--color-foreground)]">
        {text}
      </pre>
    </div>
  );
}
