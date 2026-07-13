"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { STEP_TYPES } from "@/components/types";
import type { StepType } from "@/components/types";
import { STEP_ICONS } from "@/components/workflows/WorkflowCard";
import { listItem, pressScale, springBouncy } from "@/lib/motion";

export interface DraftStep {
  key: string;
  type: StepType;
  name: string;
  config: Record<string, unknown>;
}

export function StepEditor({
  steps,
  onChange,
  errors,
}: {
  steps: DraftStep[];
  onChange: (steps: DraftStep[]) => void;
  errors?: Record<string, string>;
}) {
  // Stable, non-impure key generation for newly added steps (avoids
  // Date.now()/Math.random() calls flagged by the React purity lint rule).
  const instanceId = useId();
  const nextKeyRef = useRef(0);

  function updateStep(index: number, patch: Partial<DraftStep>) {
    const next = steps.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function updateConfig(index: number, key: string, value: unknown) {
    const next = steps.slice();
    // Spread the existing config so keys the editor doesn't render (e.g. a
    // seeded step's model/temperature/timeoutMs) survive an edit — only the
    // key being edited is overlaid.
    next[index] = {
      ...next[index],
      config: { ...next[index].config, [key]: value },
    };
    onChange(next);
  }

  function removeStep(index: number) {
    const next = steps.slice();
    next.splice(index, 1);
    onChange(next);
  }

  function moveStep(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = steps.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function addStep(type: StepType) {
    const key = `${instanceId}-${nextKeyRef.current++}`;
    onChange([
      ...steps,
      { key, type, name: `${STEP_TYPES.find((t) => t.value === type)?.label} step`, config: {} },
    ]);
  }

  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.type];
          const err = errors?.[step.key];
          return (
            <motion.div
              key={step.key}
              layout
              transition={{ layout: reduce ? { duration: 0 } : springBouncy }}
              variants={listItem}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-start gap-3">
                <motion.span
                  whileHover={reduce ? undefined : { rotate: 12 }}
                  transition={{ duration: 0.15 }}
                  className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-muted)] text-[var(--color-foreground-muted)]"
                >
                  <Icon size={15} strokeWidth={1.75} />
                </motion.span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-foreground-muted)]">
                      {step.type.replace("_", " ")}
                    </span>
                    <input
                      value={step.name}
                      onChange={(e) => updateStep(index, { name: e.target.value })}
                      placeholder="Step name"
                      aria-label="Step name"
                      className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium focus-visible:border-[var(--color-border)] focus-visible:bg-[var(--color-background)]"
                    />
                  </div>
                  <StepConfigFields
                    key={step.key}
                    type={step.type}
                    config={step.config}
                    onChange={(k, v) => updateConfig(index, k, v)}
                  />
                  {err && <p className="mt-1.5 text-xs text-[var(--color-destructive)]">{err}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-center gap-0.5">
                  <motion.button
                    whileTap={pressScale}
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                    aria-label="Move step up"
                    className="rounded p-1 text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-30"
                  >
                    <ChevronUp size={15} />
                  </motion.button>
                  <motion.button
                    whileTap={pressScale}
                    onClick={() => moveStep(index, 1)}
                    disabled={index === steps.length - 1}
                    aria-label="Move step down"
                    className="rounded p-1 text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-30"
                  >
                    <ChevronDown size={15} />
                  </motion.button>
                  <motion.button
                    whileTap={pressScale}
                    onClick={() => removeStep(index)}
                    aria-label="Remove step"
                    className="rounded p-1 text-[var(--color-foreground-muted)] transition-colors hover:bg-red-500/15 hover:text-[var(--color-destructive)]"
                  >
                    <Trash2 size={15} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2 pt-1">
        {STEP_TYPES.map(({ value, label }) => {
          const Icon = STEP_ICONS[value];
          return (
            <button
              key={value}
              type="button"
              onClick={() => addStep(value)}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-foreground-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-foreground)]"
            >
              <Icon size={13} strokeWidth={1.75} />
              Add {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FIELD_CLASSNAME =
  "mt-1.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 font-mono text-xs text-[var(--color-foreground)] focus-visible:outline-none";
const LABEL_CLASSNAME = "mt-2 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-foreground-muted)]";

type EvaluatorType = "deterministic" | "rubric" | "llm_judge";
const EVALUATOR_TYPES: { value: EvaluatorType; label: string }[] = [
  { value: "deterministic", label: "Deterministic (checks)" },
  { value: "rubric", label: "Rubric (weighted criteria)" },
  { value: "llm_judge", label: "LLM judge" },
];

function StepConfigFields({
  type,
  config,
  onChange,
}: {
  type: StepType;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const field = (
    key: string,
    label: string,
    placeholder: string,
    opts: { multiline?: boolean; asNumber?: boolean } = {}
  ) => {
    const raw = config[key];
    const value =
      opts.asNumber
        ? typeof raw === "number"
          ? String(raw)
          : ""
        : typeof raw === "string"
          ? raw
          : "";
    const commonProps = {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (opts.asNumber) {
          const v = e.target.value;
          onChange(key, v === "" ? undefined : Number(v));
        } else {
          onChange(key, e.target.value);
        }
      },
      placeholder,
      "aria-label": label,
      className: FIELD_CLASSNAME,
    };
    return opts.multiline ? (
      <textarea {...commonProps} rows={2} />
    ) : (
      <input {...commonProps} type={opts.asNumber ? "number" : "text"} step={opts.asNumber ? "0.01" : undefined} />
    );
  };

  switch (type) {
    case "llm_prompt":
      return (
        <div>{field("promptTemplate", "Prompt template", "Prompt template, e.g. Summarize: {{input}}", { multiline: true })}</div>
      );
    case "tool_api": {
      const method = typeof config.method === "string" ? config.method : "GET";
      return (
        <div className="flex gap-2">
          <div className="flex-1">{field("url", "API URL", "https://api.example.com/endpoint")}</div>
          <div>
            <label className={LABEL_CLASSNAME} style={{ marginTop: 0 }}>
              Method
            </label>
            <select
              value={method}
              onChange={(e) => onChange("method", e.target.value)}
              aria-label="HTTP method"
              className={`${FIELD_CLASSNAME} mt-1.5`}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </div>
        </div>
      );
    }
    case "transform":
      return <div>{field("expression", "Transform expression", "e.g. output.trim().toUpperCase()")}</div>;
    case "approval":
      return <div>{field("prompt", "Approval prompt", "What should the approver review?")}</div>;
    case "eval":
      return <EvalConfigFields config={config} onChange={onChange} />;
    default:
      return null;
  }
}

function EvalConfigFields({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const evaluatorType: EvaluatorType | "" =
    config.evaluatorType === "deterministic" || config.evaluatorType === "rubric" || config.evaluatorType === "llm_judge"
      ? config.evaluatorType
      : "";

  return (
    <div>
      <label className={LABEL_CLASSNAME} style={{ marginTop: 0 }}>
        Evaluator type
      </label>
      <select
        value={evaluatorType}
        onChange={(e) => onChange("evaluatorType", e.target.value || undefined)}
        aria-label="Evaluator type"
        className={`${FIELD_CLASSNAME} mt-1.5`}
      >
        <option value="" disabled>
          Select evaluator type…
        </option>
        {EVALUATOR_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {evaluatorType === "deterministic" && <DeterministicChecksField config={config} onChange={onChange} />}

      {evaluatorType === "rubric" && (
        <>
          <label className={LABEL_CLASSNAME}>Criteria (comma-separated)</label>
          <input
            type="text"
            value={
              Array.isArray(config.criteria)
                ? (config.criteria as unknown[])
                    .map((c) => (typeof c === "string" ? c : (c as { name?: string })?.name ?? ""))
                    .join(", ")
                : ""
            }
            onChange={(e) => {
              const criteria = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              onChange("criteria", criteria);
            }}
            placeholder="e.g. tone, accuracy, completeness"
            aria-label="Rubric criteria"
            className={FIELD_CLASSNAME}
          />
          <label className={LABEL_CLASSNAME}>Threshold (0-1, optional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={typeof config.threshold === "number" ? String(config.threshold) : ""}
            onChange={(e) => onChange("threshold", e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder="0.7"
            aria-label="Rubric pass threshold"
            className={FIELD_CLASSNAME}
          />
        </>
      )}

      {evaluatorType === "llm_judge" && (
        <>
          <label className={LABEL_CLASSNAME}>Rubric</label>
          <textarea
            value={typeof config.rubric === "string" ? config.rubric : ""}
            onChange={(e) => onChange("rubric", e.target.value)}
            placeholder="Does the output satisfy the intent of the task?"
            aria-label="Judge rubric"
            rows={2}
            className={FIELD_CLASSNAME}
          />
          <label className={LABEL_CLASSNAME}>Threshold (0-1, optional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={typeof config.threshold === "number" ? String(config.threshold) : ""}
            onChange={(e) => onChange("threshold", e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder="0.7"
            aria-label="Judge pass threshold"
            className={FIELD_CLASSNAME}
          />
        </>
      )}
    </div>
  );
}

/**
 * JSON textarea for deterministic evaluator `checks`. Keeps a local text
 * buffer so invalid-but-in-progress JSON doesn't get clobbered by the
 * parent's config (which only ever holds the last *valid* parse) and shows
 * an inline parse error instead of silently discarding keystrokes.
 */
function DeterministicChecksField({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const initial = Array.isArray(config.checks) ? JSON.stringify(config.checks, null, 2) : "";
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <label className={LABEL_CLASSNAME}>
        Checks (JSON array — e.g. {"[{"}&quot;type&quot;: &quot;contains&quot;, &quot;value&quot;: &quot;ok&quot;{"}]"})
      </label>
      <textarea
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (v.trim() === "") {
            setError(null);
            onChange("checks", undefined);
            return;
          }
          try {
            const parsed = JSON.parse(v);
            if (!Array.isArray(parsed)) {
              setError("Checks must be a JSON array.");
              return;
            }
            setError(null);
            onChange("checks", parsed);
          } catch {
            setError("Invalid JSON — fix syntax to save this check list.");
          }
        }}
        placeholder='[{"type": "max_length", "max": 500}]'
        aria-label="Deterministic checks (JSON)"
        rows={4}
        className={FIELD_CLASSNAME}
      />
      {error && <p className="mt-1 text-xs text-[var(--color-destructive)]">{error}</p>}
    </>
  );
}
