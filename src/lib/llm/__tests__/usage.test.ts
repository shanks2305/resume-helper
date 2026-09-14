import { describe, expect, it } from "vitest";
import {
  addUsage,
  emptyUsage,
  estimateCostUsd,
  formatUsd,
  usageFromCounts,
} from "@/lib/llm/usage";

describe("llm usage", () => {
  it("adds usage across calls", () => {
    const total = addUsage(
      usageFromCounts(100, 50),
      usageFromCounts(200, 80),
    );
    expect(total).toEqual({
      promptTokens: 300,
      completionTokens: 130,
      totalTokens: 430,
      calls: 2,
    });
  });

  it("estimates openai cost for gpt-4o-mini", () => {
    const usage = usageFromCounts(1_000_000, 1_000_000);
    expect(estimateCostUsd("openai", "gpt-4o-mini", usage)).toBeCloseTo(0.75);
  });

  it("returns 0 cost for ollama", () => {
    expect(estimateCostUsd("ollama", "llama3.1:8b", usageFromCounts(9, 9))).toBe(
      0,
    );
  });

  it("formats tiny costs", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.00004)).toBe("<$0.0001");
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(undefined)).toBe("—");
    expect(emptyUsage().calls).toBe(0);
  });
});
