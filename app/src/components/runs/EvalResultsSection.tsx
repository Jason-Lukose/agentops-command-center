import { CheckCircle2, XCircle } from "lucide-react";
import { formatScore, titleCase } from "@/lib/format";
import type { EvaluationResult } from "@/components/types";

export function EvalResultsSection({ evaluations }: { evaluations: EvaluationResult[] }) {
  if (evaluations.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Evaluation results</h2>
      <div className="flex flex-col gap-2">
        {evaluations.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
          >
            {ev.passed ? (
              <CheckCircle2 size={16} className="shrink-0 text-[var(--color-accent)]" />
            ) : (
              <XCircle size={16} className="shrink-0 text-[var(--color-destructive)]" />
            )}
            <span className="font-medium">{titleCase(ev.evaluatorType)}</span>
            <span className="tabular-nums text-[var(--color-foreground-muted)]">
              score {formatScore(ev.score)}
            </span>
            <span className="ml-auto text-xs text-[var(--color-foreground-muted)]">
              {ev.passed ? "Passed" : "Failed"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
