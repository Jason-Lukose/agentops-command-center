// Safe template substitution for step prompts/configs, e.g. "{{ticket.body}}"
// or "{{steps[0].output.summary}}". No eval() — pure property-path traversal.

/** Splits a path like "steps[0].output.summary" into ["steps", 0, "output", "summary"]. */
function tokenizePath(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const parts = path.split(".");
  for (const part of parts) {
    const bracketMatch = part.match(/^([a-zA-Z0-9_$]+)((?:\[\d+\])*)$/);
    if (!bracketMatch) {
      // Fall back to treating the whole segment as a key (defensive; shouldn't
      // normally happen given the regex used by resolveTemplate/getPath callers).
      tokens.push(part);
      continue;
    }
    tokens.push(bracketMatch[1]);
    const indices = bracketMatch[2].match(/\[(\d+)\]/g) ?? [];
    for (const idx of indices) {
      tokens.push(Number(idx.slice(1, -1)));
    }
  }
  return tokens;
}

/** Resolves a dot/bracket path against a plain-object context. Returns undefined if any segment is missing. */
export function getPath(context: unknown, path: string): unknown {
  const tokens = tokenizePath(path.trim());
  let current: unknown = context;
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;
    if (typeof token === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[token];
    } else {
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[token];
    }
  }
  return current;
}

/** Replaces every "{{path}}" occurrence in a string template with the resolved value (stringified). */
export function resolveTemplate(template: string, context: unknown): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, path: string) => {
    const value = getPath(context, path);
    if (value === undefined || value === null) return "";
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

/** Builds the substitution context shared by prompt templates and transform expressions. */
export function buildStepContext(runInput: unknown, priorOutputs: unknown[]): Record<string, unknown> {
  const base: Record<string, unknown> =
    runInput && typeof runInput === "object" && !Array.isArray(runInput)
      ? { ...(runInput as Record<string, unknown>) }
      : { input: runInput };
  base.steps = priorOutputs.map((output) => ({ output }));
  return base;
}
