import { formatDistanceToNow } from "date-fns";

/** Relative time, e.g. "3 minutes ago". Falls back gracefully on bad input. */
export function relativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return "—";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "—";
  }
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatPercent(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export function formatScore(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(2);
}

export function formatCost(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return "—";
  if (n === 0) return "$0.00";
  const abs = Math.abs(n);
  // Small per-call costs (mock provider often prices in fractions of a cent)
  // need more than 2dp or they all render as "$0.00" — meaningless for an
  // MVP whose whole point is to show cost per run. Below $0.0001 there's no
  // meaningful precision left to show, so say so explicitly instead of
  // rendering "$0.0000".
  if (abs >= 0.01) return `$${n.toFixed(2)}`;
  if (abs >= 0.0001) return `$${n.toFixed(4)}`;
  return "<$0.0001";
}

export function formatTokens(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString();
}

export function prettyJson(v: unknown): string {
  if (v === null || v === undefined) return "null";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function titleCase(s: string): string {
  return s
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
