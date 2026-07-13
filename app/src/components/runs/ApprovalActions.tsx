"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { ErrorState } from "@/components/ui/ErrorState";
import { postJson, ApiRequestError } from "@/lib/fetcher";

export function ApprovalActions({
  runId,
  onDecided,
}: {
  runId: string;
  onDecided: () => void;
}) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    setPending(action);
    setError(null);
    try {
      await postJson(`/api/runs/${runId}/${action}`);
      onDecided();
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : `Failed to ${action} — please try again.`
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
      <p className="text-sm font-medium text-amber-200">Approval required to continue this run.</p>
      <div className="flex gap-2">
        <button
          onClick={() => decide("approve")}
          disabled={pending !== null}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-foreground)] transition-transform disabled:opacity-60 active:scale-[0.98]"
        >
          {pending === "approve" ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Check size={14} />
          )}
          Approve
        </button>
        <button
          onClick={() => decide("reject")}
          disabled={pending !== null}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-200 transition-transform disabled:opacity-60 active:scale-[0.98]"
        >
          {pending === "reject" ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <X size={14} />
          )}
          Reject
        </button>
      </div>
      {error && <ErrorState message={error} compact />}
    </div>
  );
}
