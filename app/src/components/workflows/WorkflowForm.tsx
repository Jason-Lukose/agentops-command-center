"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Play, Save } from "lucide-react";
import { StepEditor, type DraftStep } from "@/components/workflows/StepEditor";
import { ErrorState } from "@/components/ui/ErrorState";
import { RunWorkflowModal } from "@/components/workflows/RunWorkflowModal";
import { postJson, putJson, ApiRequestError } from "@/lib/fetcher";
import { duration } from "@/lib/motion";
import type { Workflow } from "@/components/types";

export function WorkflowForm({ workflow }: { workflow?: Workflow }) {
  const router = useRouter();
  const isEdit = Boolean(workflow);

  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(
    (workflow?.steps ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ key: s.id, type: s.type, name: s.name, config: s.config }))
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(workflow?.id ?? null);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const reduce = useReducedMotion();
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function validate(): boolean {
    let ok = true;
    if (!name.trim()) {
      setNameError("Workflow name is required.");
      ok = false;
    } else {
      setNameError(null);
    }
    const errs: Record<string, string> = {};
    for (const s of steps) {
      if (!s.name.trim()) {
        errs[s.key] = "Step name is required.";
        ok = false;
      }
    }
    setStepErrors(errs);
    return ok;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      steps: steps.map((s) => ({ type: s.type, name: s.name.trim(), config: s.config })),
    };
    try {
      if (isEdit && workflow) {
        const res = await putJson<{ workflow: Workflow }>(`/api/workflows/${workflow.id}`, body);
        setSavedId(res.workflow.id);
      } else {
        const res = await postJson<{ workflow: Workflow }>("/api/workflows", body);
        setSavedId(res.workflow.id);
        router.replace(`/workflows/${res.workflow.id}`);
      }
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), 1500);
    } catch (e) {
      setSaveError(e instanceof ApiRequestError ? e.message : "Failed to save workflow.");
    } finally {
      setSaving(false);
    }
  }

  const canRun = Boolean(savedId) && steps.length > 0;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div>
          <label htmlFor="wf-name" className="mb-1 block text-xs font-medium text-[var(--color-foreground-muted)]">
            Name
          </label>
          <input
            id="wf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Release Notes Summarizer"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus-visible:outline-none"
          />
          {nameError && <p className="mt-1 text-xs text-[var(--color-destructive)]">{nameError}</p>}
        </div>
        <div>
          <label htmlFor="wf-desc" className="mb-1 block text-xs font-medium text-[var(--color-foreground-muted)]">
            Description (optional)
          </label>
          <textarea
            id="wf-desc"
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What does this workflow do?"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus-visible:outline-none"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">Steps</h2>
        {steps.length === 0 && (
          <p className="mb-3 text-sm text-[var(--color-foreground-muted)]">
            Add your first step to make this workflow runnable.
          </p>
        )}
        <StepEditor steps={steps} onChange={setSteps} errors={stepErrors} />
      </div>

      {saveError && <ErrorState message={saveError} onRetry={handleSave} />}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-foreground)] transition-transform disabled:opacity-60 active:scale-[0.98]"
        >
          <AnimatePresence mode="wait" initial={false}>
            {saving ? (
              <motion.span
                key="saving"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.fast }}
                className="flex items-center gap-2"
              >
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Save workflow
              </motion.span>
            ) : justSaved ? (
              <motion.span
                key="saved"
                initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.fast }}
                className="flex items-center gap-2"
              >
                <Check size={15} />
                Saved
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.fast }}
                className="flex items-center gap-2"
              >
                <Save size={15} />
                Save workflow
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button
          onClick={() => setRunModalOpen(true)}
          disabled={!canRun}
          title={canRun ? undefined : "Save a workflow with at least one step to run it"}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play size={15} />
          Run
        </button>
      </div>

      {savedId && (
        <RunWorkflowModal
          open={runModalOpen}
          onClose={() => setRunModalOpen(false)}
          workflowId={savedId}
          onRun={(runId) => {
            setRunModalOpen(false);
            router.push(`/runs/${runId}`);
          }}
        />
      )}
    </div>
  );
}
