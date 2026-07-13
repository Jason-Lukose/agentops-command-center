import type { EvaluatorResult, JsonValue } from "../types";

export type DeterministicCheck =
  | { type: "contains"; value: string; caseSensitive?: boolean }
  | { type: "regex"; pattern: string; flags?: string }
  | { type: "json_valid" }
  | { type: "max_length"; max: number }
  | { type: "min_length"; min: number };

export interface DeterministicConfig {
  checks?: DeterministicCheck[];
}

function toText(input: JsonValue): string {
  return typeof input === "string" ? input : JSON.stringify(input ?? null);
}

function runCheck(check: DeterministicCheck, text: string): { passed: boolean; detail: string } {
  switch (check.type) {
    case "contains": {
      const haystack = check.caseSensitive === false ? text.toLowerCase() : text;
      const needle = check.caseSensitive === false ? check.value.toLowerCase() : check.value;
      const passed = haystack.includes(needle);
      return { passed, detail: passed ? `contains "${check.value}"` : `missing "${check.value}"` };
    }
    case "regex": {
      let passed = false;
      try {
        passed = new RegExp(check.pattern, check.flags).test(text);
      } catch {
        return { passed: false, detail: `invalid regex pattern "${check.pattern}"` };
      }
      return { passed, detail: passed ? `matches /${check.pattern}/` : `does not match /${check.pattern}/` };
    }
    case "json_valid": {
      try {
        JSON.parse(text);
        return { passed: true, detail: "valid JSON" };
      } catch {
        return { passed: false, detail: "invalid JSON" };
      }
    }
    case "max_length": {
      const passed = text.length <= check.max;
      return { passed, detail: `length ${text.length} ${passed ? "<=" : ">"} ${check.max}` };
    }
    case "min_length": {
      const passed = text.length >= check.min;
      return { passed, detail: `length ${text.length} ${passed ? ">=" : "<"} ${check.min}` };
    }
  }
}

/**
 * Deterministic evaluator: pure, exact pass/fail checks (contains, regex,
 * json_valid, max/min_length). Score is 0 or 1 per docs/DATA_MODEL.md — 1 iff
 * every configured check passes. Canonical config shape is
 * `{ checks: DeterministicCheck[] }`. A missing or empty `checks` array is a
 * configuration error (not a vacuous pass) and throws, so the eval executor
 * surfaces it as a failed step with a clear errorMessage instead of silently
 * reporting score 1.
 */
export function evaluateDeterministic(input: JsonValue, config: DeterministicConfig): EvaluatorResult {
  const checks = config.checks ?? [];
  if (checks.length === 0) {
    throw new Error(
      'deterministic evaluator config has no recognizable checks: expected a non-empty "checks" array (e.g. { "checks": [{ "type": "contains", "value": "..." }] }), got ' +
        JSON.stringify(config)
    );
  }
  const text = toText(input);
  const results = checks.map((check) => ({ check, ...runCheck(check, text) }));
  const passed = results.every((r) => r.passed);

  return {
    score: passed ? 1 : 0,
    passed,
    details: { checks: results.map((r) => ({ type: r.check.type, passed: r.passed, detail: r.detail })) },
  };
}
