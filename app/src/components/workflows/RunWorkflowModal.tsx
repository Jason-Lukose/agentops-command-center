"use client";

import { useState } from "react";
import useSWR from "swr";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/ErrorState";
import { fetcher, postJson, ApiRequestError } from "@/lib/fetcher";
import type { WorkflowSummary } from "@/components/types";

// Sample payloads matched against the resolved workflow's name. Each seed
// workflow expects a distinct input contract (see prisma/seed.ts step
// configs), so a single generic sample cannot satisfy both — falls back to
// a generic placeholder for user-created workflows we don't recognize.
const SAMPLE_INPUTS: { match: RegExp; input: unknown }[] = [
  {
    // Support Ticket Triage Pipeline: {{ticket.body}}, {{ticket.customerId}}
    match: /triage/i,
    input: {
      ticket: {
        subject: "Billing discrepancy on March invoice",
        body: "I was charged twice for my March subscription. Please refund the duplicate charge.",
        customerId: "cust_1042",
      },
    },
  },
  {
    // Content Summarizer QA: {{article.body}}
    match: /summariz/i,
    input: {
      article: {
        title: "AgentOps Command Center launches workflow tracing",
        body: "AgentOps Command Center now ships with end-to-end workflow tracing, letting teams inspect every step of an agent run, review evaluation scores, and approve or reject sensitive actions before they execute.",
      },
    },
  },
];
const FALLBACK_SAMPLE_INPUT = { message: "Summarize the latest release notes." };

function sampleInputFor(name: string | undefined): unknown {
  if (!name) return FALLBACK_SAMPLE_INPUT;
  return SAMPLE_INPUTS.find((s) => s.match.test(name))?.input ?? FALLBACK_SAMPLE_INPUT;
}

export function RunWorkflowModal({
  open,
  onClose,
  onRun,
  workflowId,
}: {
  open: boolean;
  onClose: () => void;
  onRun: (runId: string) => void;
  /** If omitted, defaults to the Support Ticket Triage Pipeline (falls back to the
   * first workflow if it doesn't exist) — powers "Run demo workflow". */
  workflowId?: string;
}) {
  const { data, error, isLoading } = useSWR<{ workflows: WorkflowSummary[] }>(
    open ? "/api/workflows" : null,
    fetcher
  );
  const demoWorkflow =
    data?.workflows?.find((w) => /triage/i.test(w.name)) ?? data?.workflows?.[0];
  const resolvedWorkflowId = workflowId ?? demoWorkflow?.id;
  // Display name only for the auto-selected demo workflow (unchanged UI behavior);
  // the sample-input lookup below also needs the name when an explicit
  // workflowId is passed, so it's resolved separately from the list data.
  const resolvedWorkflowName = workflowId ? undefined : demoWorkflow?.name;
  const sampleInputWorkflowName = workflowId
    ? data?.workflows?.find((w) => w.id === workflowId)?.name
    : demoWorkflow?.name;
  const sampleInput = sampleInputFor(sampleInputWorkflowName);

  const [inputText, setInputText] = useState(JSON.stringify(sampleInput, null, 2));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Reset the form fields when the modal transitions from closed -> open, or
  // when the resolved workflow's sample input changes (e.g. workflow list
  // finishes loading after the modal opens).
  // (Adjusting state during render instead of an effect, per React's
  // "you might not need an effect" guidance — avoids a cascading render.)
  const [wasOpen, setWasOpen] = useState(open);
  const [lastSampleText, setLastSampleText] = useState(inputText);
  const sampleText = JSON.stringify(sampleInput, null, 2);
  if (open !== wasOpen || (open && sampleText !== lastSampleText)) {
    const reopened = open !== wasOpen;
    setWasOpen(open);
    setLastSampleText(sampleText);
    if (open) {
      setInputText(sampleText);
      if (reopened) {
        setSubmitError(null);
        setJsonError(null);
      }
    }
  }

  async function handleConfirm() {
    if (!resolvedWorkflowId) return;
    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(inputText);
    } catch {
      setJsonError("Input must be valid JSON.");
      return;
    }
    setJsonError(null);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await postJson<{ run: { id: string } }>("/api/runs", {
        workflowId: resolvedWorkflowId,
        input: parsedInput,
      });
      onRun(res.run.id);
    } catch (e) {
      setSubmitError(e instanceof ApiRequestError ? e.message : "Failed to start run.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Run workflow">
      {!workflowId && isLoading && (
        <p className="text-sm text-[var(--color-foreground-muted)]">Loading sample workflow…</p>
      )}
      {!workflowId && error && (
        <ErrorState message="Could not load a workflow to run." compact />
      )}
      {!workflowId && !isLoading && !error && !resolvedWorkflowId && (
        <p className="text-sm text-[var(--color-foreground-muted)]">
          No workflows exist yet. Create one from the Workflows page first.
        </p>
      )}
      {resolvedWorkflowId && (
        <div className="flex flex-col gap-3">
          {resolvedWorkflowName && (
            <p className="text-sm text-[var(--color-foreground-muted)]">
              Workflow: <span className="text-[var(--color-foreground)]">{resolvedWorkflowName}</span>
            </p>
          )}
          <div>
            <label htmlFor="run-input" className="mb-1 block text-xs font-medium text-[var(--color-foreground-muted)]">
              Input (JSON)
            </label>
            <textarea
              id="run-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-2.5 font-mono text-xs text-[var(--color-foreground)] focus-visible:outline-none"
            />
            {jsonError && <p className="mt-1 text-xs text-[var(--color-destructive)]">{jsonError}</p>}
          </div>
          {submitError && <ErrorState message={submitError} compact />}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-muted)]"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-foreground)] transition-transform disabled:opacity-60 active:scale-[0.98]"
            >
              {submitting && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              Confirm &amp; run
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
