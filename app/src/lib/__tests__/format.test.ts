import { describe, it, expect } from "vitest";
import {
  formatCost,
  formatLatency,
  formatPercent,
  formatScore,
  formatTokens,
  prettyJson,
  relativeTime,
  titleCase,
} from "@/lib/format";

describe("formatLatency", () => {
  it("renders sub-second latencies in ms", () => {
    expect(formatLatency(450)).toBe("450ms");
  });
  it("renders >=1000ms in seconds with 2 decimals", () => {
    expect(formatLatency(1500)).toBe("1.50s");
    expect(formatLatency(14030031)).toBe("14030.03s");
  });
  it("renders missing values as an em dash, never NaN", () => {
    expect(formatLatency(null)).toBe("—");
    expect(formatLatency(undefined)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("formats a 0-1 ratio as a percentage with one decimal", () => {
    expect(formatPercent(0.733)).toBe("73.3%");
    expect(formatPercent(1)).toBe("100.0%");
    expect(formatPercent(0)).toBe("0.0%");
  });
  it("never renders NaN for missing/invalid input", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
    expect(formatPercent(NaN)).toBe("—");
  });
});

describe("formatScore", () => {
  it("formats to 2 decimal places", () => {
    expect(formatScore(0.9)).toBe("0.90");
    expect(formatScore(1)).toBe("1.00");
  });
  it("handles missing values", () => {
    expect(formatScore(null)).toBe("—");
    expect(formatScore(undefined)).toBe("—");
  });
});

describe("formatCost", () => {
  it("formats costs >= $0.01 to 2 decimals", () => {
    expect(formatCost(0.0532)).toBe("$0.05");
    expect(formatCost(1.2)).toBe("$1.20");
  });
  it("formats costs >= $0.0001 and < $0.01 to 4 decimals", () => {
    expect(formatCost(0.000501)).toBe("$0.0005");
    expect(formatCost(0.0001)).toBe("$0.0001");
  });
  it("formats Prisma Decimal-as-string costs (common over JSON)", () => {
    expect(formatCost("0.000501")).toBe("$0.0005");
  });
  it("shows a floor indicator instead of $0.0000 for sub-$0.0001 costs", () => {
    expect(formatCost(0.00005)).toBe("<$0.0001");
    expect(formatCost(0.000097)).toBe("<$0.0001");
  });
  it("special-cases exactly zero", () => {
    expect(formatCost(0)).toBe("$0.00");
  });
  it("handles missing/invalid values without throwing", () => {
    expect(formatCost(null)).toBe("—");
    expect(formatCost(undefined)).toBe("—");
    expect(formatCost("not-a-number")).toBe("—");
  });
});

describe("formatTokens", () => {
  it("adds thousands separators", () => {
    expect(formatTokens(1234567)).toBe("1,234,567");
  });
  it("handles missing values", () => {
    expect(formatTokens(null)).toBe("—");
  });
});

describe("prettyJson", () => {
  it("pretty-prints objects with 2-space indent", () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
  it("renders null explicitly instead of throwing", () => {
    expect(prettyJson(null)).toBe("null");
    expect(prettyJson(undefined)).toBe("null");
  });
});

describe("titleCase", () => {
  it("converts snake_case and space-separated strings to Title Case", () => {
    expect(titleCase("llm_prompt")).toBe("Llm Prompt");
    expect(titleCase("awaiting approval")).toBe("Awaiting Approval");
  });
});

describe("relativeTime", () => {
  it("returns an em dash for missing input instead of throwing", () => {
    expect(relativeTime(null)).toBe("—");
    expect(relativeTime(undefined)).toBe("—");
  });
  it("returns an em dash for unparsable input", () => {
    expect(relativeTime("not-a-date")).toBe("—");
  });
  it("returns a human-relative string for a valid date", () => {
    const result = relativeTime(new Date().toISOString());
    expect(result).toMatch(/ago|in /);
  });
});
