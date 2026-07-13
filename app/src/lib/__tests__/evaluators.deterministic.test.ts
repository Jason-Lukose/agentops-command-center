import { describe, it, expect } from "vitest";
import { evaluateDeterministic } from "@/lib/evaluators/deterministic";

describe("evaluateDeterministic", () => {
  it("passes with score 1 when all checks pass", () => {
    const result = evaluateDeterministic("hello world", {
      checks: [
        { type: "contains", value: "hello" },
        { type: "max_length", max: 100 },
      ],
    });
    expect(result.score).toBe(1);
    expect(result.passed).toBe(true);
  });

  it("fails with score 0 when any check fails", () => {
    const result = evaluateDeterministic("hello world", {
      checks: [
        { type: "contains", value: "goodbye" },
        { type: "max_length", max: 100 },
      ],
    });
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.details).toMatchObject({ checks: expect.any(Array) });
  });

  it("regex check passes/fails correctly", () => {
    const pass = evaluateDeterministic("abc123", { checks: [{ type: "regex", pattern: "^abc\\d+$" }] });
    expect(pass.passed).toBe(true);
    const fail = evaluateDeterministic("xyz", { checks: [{ type: "regex", pattern: "^abc\\d+$" }] });
    expect(fail.passed).toBe(false);
  });

  it("json_valid check passes/fails correctly", () => {
    const pass = evaluateDeterministic('{"a":1}', { checks: [{ type: "json_valid" }] });
    expect(pass.passed).toBe(true);
    const fail = evaluateDeterministic("not json", { checks: [{ type: "json_valid" }] });
    expect(fail.passed).toBe(false);
  });

  it("min_length and max_length boundary checks", () => {
    const exact = evaluateDeterministic("12345", {
      checks: [
        { type: "min_length", min: 5 },
        { type: "max_length", max: 5 },
      ],
    });
    expect(exact.passed).toBe(true);

    const tooShort = evaluateDeterministic("1234", { checks: [{ type: "min_length", min: 5 }] });
    expect(tooShort.passed).toBe(false);
  });

  it("throws a validation error when no checks configured (no vacuous pass)", () => {
    expect(() => evaluateDeterministic("anything", {})).toThrow(/no recognizable checks/i);
  });

  it("throws a validation error when checks is an empty array", () => {
    expect(() => evaluateDeterministic("anything", { checks: [] })).toThrow(/no recognizable checks/i);
  });

  it("evaluates non-string input by stringifying it", () => {
    const result = evaluateDeterministic({ foo: "bar" }, { checks: [{ type: "contains", value: "bar" }] });
    expect(result.passed).toBe(true);
  });
});
