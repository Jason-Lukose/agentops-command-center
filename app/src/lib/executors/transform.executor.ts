import type { ExecutorContext, ExecutorResult, JsonValue } from "../types";
import { buildStepContext, getPath } from "../template";

/**
 * Transform executor. Supports a tiny, explicit set of safe operations over
 * the step context — NEVER eval()'d arbitrary code:
 *   - "JSON.parse(<path>)"      parse the string value at <path> as JSON
 *   - "JSON.stringify(<path>)"  stringify the value at <path>
 *   - "<path>"                  resolve <path> directly (identity passthrough)
 *
 * config: { expression: string }
 */
export async function runTransformStep(ctx: ExecutorContext): Promise<ExecutorResult> {
  const config = (ctx.config ?? {}) as { expression?: unknown };
  const expression = typeof config.expression === "string" ? config.expression.trim() : undefined;

  if (!expression) {
    return {
      status: "failed",
      output: null,
      errorMessage: "transform step config.expression must be a non-empty string",
    };
  }

  const context = buildStepContext(ctx.runInput, ctx.priorOutputs);
  // Also allow referencing this step's own resolved input directly as "input".
  (context as Record<string, unknown>).input = ctx.input;

  try {
    const output = evaluateSafeExpression(expression, context);
    return { status: "succeeded", output: output as JsonValue };
  } catch (err) {
    return {
      status: "failed",
      output: null,
      errorMessage: err instanceof Error ? err.message : "transform expression failed",
    };
  }
}

function evaluateSafeExpression(expression: string, context: Record<string, unknown>): unknown {
  const parseMatch = expression.match(/^JSON\.parse\(\s*(.+?)\s*\)$/);
  if (parseMatch) {
    const raw = getPath(context, parseMatch[1]);
    if (typeof raw !== "string") {
      throw new Error(`JSON.parse target "${parseMatch[1]}" did not resolve to a string`);
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`JSON.parse failed: value at "${parseMatch[1]}" is not valid JSON`);
    }
  }

  const stringifyMatch = expression.match(/^JSON\.stringify\(\s*(.+?)\s*\)$/);
  if (stringifyMatch) {
    const value = getPath(context, stringifyMatch[1]);
    return JSON.stringify(value ?? null);
  }

  // Plain path resolve (identity passthrough).
  if (/^[a-zA-Z0-9_$.[\]]+$/.test(expression)) {
    const value = getPath(context, expression);
    if (value === undefined) {
      throw new Error(`transform path "${expression}" did not resolve to a value`);
    }
    return value;
  }

  throw new Error(
    `Unsupported transform expression "${expression}". Only JSON.parse(path), JSON.stringify(path), ` +
      `and plain paths are allowed — arbitrary code is not evaluated.`
  );
}
