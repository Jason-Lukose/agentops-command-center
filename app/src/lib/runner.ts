import { Prisma, type PrismaClient } from "@prisma/client";
import { runExecutor, isRetryable } from "./executors";
import { persistEvaluationResult } from "./evaluators";
import { getProvider } from "./providers";
import { ProviderTransientError } from "./providers/provider";
import type { JsonValue, Provider, RunStatus } from "./types";

// 3 retries: the mock provider intentionally fails ~8% of calls, so a 3-call
// rubric attempt fails ~22% of the time; 4 total attempts puts run-level
// exhaustion at ~0.2% (measured live at 2 retries: 3 exhaustions in 40 runs).
const MAX_RETRIES = 3;
const TERMINAL_RUN_STATUSES = new Set<RunStatus>(["succeeded", "failed", "canceled"]);
const TERMINAL_RUN_STATUS_LIST: RunStatus[] = Array.from(TERMINAL_RUN_STATUSES);
const DONE_STEP_STATUSES = new Set(["succeeded", "skipped"]);

export interface RunnerDeps {
  prisma: PrismaClient;
  provider?: Provider;
}

/**
 * Executes (or resumes) a run: loads the workflow's ordered steps, resumes
 * from the first non-terminal StepExecution, runs each step's executor,
 * persists the trace, and stops cleanly on approval-pause or failure.
 *
 * ASSUMPTION: the "config mapping" that pipes prior output into the next
 * step's input (docs/ARCHITECTURE.md step 3) is: step 0's input is the run's
 * input payload; step N (N>0)'s input is step N-1's output. Steps that need
 * to reach further back reference `{{steps[i].output...}}` directly in their
 * config templates (see src/lib/template.ts), which executors resolve
 * against the full prior-output list, not just the immediate predecessor.
 */
export async function executeRun(runId: string, deps: RunnerDeps): Promise<void> {
  const { prisma } = deps;
  const provider = deps.provider ?? getProvider();

  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    console.error(`runner: run ${runId} not found`);
    return;
  }
  if (TERMINAL_RUN_STATUSES.has(run.status)) {
    return; // Already finished — idempotent no-op (e.g. a duplicate/late job).
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: run.workflowId },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!workflow) {
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: "failed",
        errorMessage: `Workflow ${run.workflowId} not found`,
        finishedAt: new Date(),
      },
    });
    return;
  }

  let executions = await prisma.stepExecution.findMany({ where: { runId }, orderBy: { position: "asc" } });

  if (executions.length === 0) {
    await prisma.stepExecution.createMany({
      data: workflow.steps.map((step) => ({
        runId,
        stepId: step.id,
        position: step.position,
        status: "pending" as const,
      })),
    });
    executions = await prisma.stepExecution.findMany({ where: { runId }, orderBy: { position: "asc" } });
  }

  const startedAt = run.startedAt ?? new Date();
  const runningUpdate = await prisma.run.updateMany({
    where: { id: runId, status: { notIn: TERMINAL_RUN_STATUS_LIST } },
    data: run.startedAt ? { status: "running" } : { status: "running", startedAt },
  });
  if (runningUpdate.count === 0) {
    // The run reached a terminal status (e.g. canceled) between our initial
    // load and this write — most likely the worker-start/cancel TOCTOU race.
    // Bail out without resurrecting it.
    console.warn(`runner: run ${runId} left terminal status before start-running write; aborting`);
    return;
  }

  // Approval steps are gates, not transformers: their pipeline contribution is
  // their input (the payload under review), not the {decision, note} blob the
  // approve/reject route writes to their output.
  const stepTypeByPosition = new Map(workflow.steps.map((s) => [s.position, s.type]));
  const priorOutputs: JsonValue[] = executions
    .filter((e) => e.status === "succeeded")
    .map((e) =>
      stepTypeByPosition.get(e.position) === "approval" ? (e.input as JsonValue) : (e.output as JsonValue),
    );

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const execution = executions[i];

    if (DONE_STEP_STATUSES.has(execution.status)) {
      continue; // Already completed in a prior worker pass.
    }
    if (execution.status === "failed") {
      // Defensive guard: a failed step should already have short-circuited
      // the run on the pass that produced it.
      break;
    }

    const resolvedInput: JsonValue = i === 0 ? (run.input as JsonValue) : priorOutputs[priorOutputs.length - 1] ?? null;
    const stepStart = Date.now();

    await prisma.stepExecution.update({
      where: { id: execution.id },
      data: { status: "running", input: (resolvedInput ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    });

    let retryCount = 0;
    let outcome: Awaited<ReturnType<typeof runExecutor>> | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        outcome = await runExecutor(step.type, {
          input: resolvedInput,
          config: step.config as JsonValue,
          priorOutputs,
          runInput: run.input as JsonValue,
          provider,
        });
        break;
      } catch (err) {
        const transient = err instanceof ProviderTransientError;
        if (transient && isRetryable(step.type) && attempt < MAX_RETRIES) {
          retryCount += 1;
          continue;
        }
        outcome = {
          status: "failed",
          output: null,
          errorMessage: err instanceof Error ? err.message : "step execution failed",
        };
        break;
      }
    }

    // outcome is always assigned by the loop above (break on success, or on
    // final failure); this satisfies TypeScript's control-flow analysis.
    const result = outcome!;
    const latencyMs = Date.now() - stepStart;

    await prisma.stepExecution.update({
      where: { id: execution.id },
      data: {
        status: result.status,
        output: (result.output ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        errorMessage: result.errorMessage ?? null,
        retryCount,
        latencyMs,
        tokensIn: result.tokensIn ?? null,
        tokensOut: result.tokensOut ?? null,
        costEstimate: result.costEstimate ?? null,
      },
    });

    if (step.type === "eval" && result.status === "succeeded" && result.output && typeof result.output === "object") {
      const evalOutput = result.output as { score?: unknown; passed?: unknown; details?: unknown };
      const evaluatorType = (step.config as { evaluatorType?: string }).evaluatorType;
      if (
        typeof evalOutput.score === "number" &&
        typeof evalOutput.passed === "boolean" &&
        (evaluatorType === "deterministic" || evaluatorType === "rubric" || evaluatorType === "llm_judge")
      ) {
        await persistEvaluationResult(prisma, {
          runId,
          stepExecutionId: execution.id,
          evaluatorType,
          result: { score: evalOutput.score, passed: evalOutput.passed, details: (evalOutput.details ?? {}) as JsonValue },
        });
      }
    }

    if (result.status === "awaiting_approval") {
      const guarded = await prisma.run.updateMany({
        where: { id: runId, status: { notIn: TERMINAL_RUN_STATUS_LIST } },
        data: { status: "awaiting_approval" },
      });
      if (guarded.count === 0) {
        console.warn(`runner: run ${runId} already terminal; skipping awaiting_approval write`);
      }
      return; // Job completes cleanly; resume is driven by approve/reject.
    }

    if (result.status === "failed") {
      const remainingSteps = workflow.steps.slice(i + 1);
      if (remainingSteps.length > 0) {
        await prisma.stepExecution.updateMany({
          where: { runId, position: { in: remainingSteps.map((s) => s.position) } },
          data: { status: "skipped" },
        });
      }
      const finishedAt = new Date();
      const guarded = await prisma.run.updateMany({
        where: { id: runId, status: { notIn: TERMINAL_RUN_STATUS_LIST } },
        data: {
          status: "failed",
          errorMessage: result.errorMessage ?? "Step failed",
          finishedAt,
          latencyMs: await executionLatencyMs(prisma, runId),
        },
      });
      if (guarded.count === 0) {
        console.warn(`runner: run ${runId} already terminal; skipping failed write`);
      }
      return;
    }

    priorOutputs.push(result.output);
  }

  const finishedAt = new Date();
  const finalOutput = priorOutputs.length > 0 ? priorOutputs[priorOutputs.length - 1] : null;
  const guarded = await prisma.run.updateMany({
    where: { id: runId, status: { notIn: TERMINAL_RUN_STATUS_LIST } },
    data: {
      status: "succeeded",
      output: (finalOutput ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      finishedAt,
      latencyMs: await executionLatencyMs(prisma, runId),
    },
  });
  if (guarded.count === 0) {
    console.warn(`runner: run ${runId} already terminal; skipping succeeded write`);
  }
}

// Run latency = sum of step execution time. Wall-clock (finishedAt - startedAt)
// would count human approval wait, which is dwell time, not performance.
// Shared by the runner and the reject/cancel routes so the dashboard's
// avg(latencyMs) compares like with like. Returns null when nothing executed.
export async function executionLatencyMs(
  prisma: { stepExecution: Pick<PrismaClient["stepExecution"], "aggregate"> },
  runId: string,
): Promise<number | null> {
  const agg = await prisma.stepExecution.aggregate({
    where: { runId },
    _sum: { latencyMs: true },
  });
  return agg._sum.latencyMs ?? null;
}
