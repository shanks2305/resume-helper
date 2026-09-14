import type { LlmProvider } from "./types";

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Number of LLM calls that contributed to this usage. */
  calls: number;
};

/** USD per 1M tokens. Approximate list prices; update as models change. */
const OPENAI_PRICES: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.6 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-2024-08-06": { input: 2.5, output: 10.0 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "o3-mini": { input: 1.1, output: 4.4 },
};

export function emptyUsage(): LlmUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    calls: 0,
  };
}

export function addUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    calls: a.calls + b.calls,
  };
}

export function usageFromCounts(
  promptTokens: number,
  completionTokens: number,
): LlmUsage {
  const prompt = Math.max(0, Math.round(promptTokens));
  const completion = Math.max(0, Math.round(completionTokens));
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: prompt + completion,
    calls: 1,
  };
}

function lookupOpenAiPrice(model: string): { input: number; output: number } | null {
  const exact = OPENAI_PRICES[model];
  if (exact) return exact;
  const key = Object.keys(OPENAI_PRICES).find(
    (k) => model === k || model.startsWith(`${k}-`) || model.startsWith(k),
  );
  return key ? OPENAI_PRICES[key] : null;
}

/**
 * Estimate USD cost for the given usage.
 * Returns 0 for local (Ollama) runs; null when the model price is unknown.
 */
export function estimateCostUsd(
  provider: LlmProvider,
  model: string,
  usage: LlmUsage,
): number | null {
  if (provider === "ollama") return 0;
  const price = lookupOpenAiPrice(model);
  if (!price) return null;
  return (
    (usage.promptTokens / 1_000_000) * price.input +
    (usage.completionTokens / 1_000_000) * price.output
  );
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null) return "—";
  if (amount === 0) return "$0.00";
  if (amount < 0.0001) return "<$0.0001";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(3)}`;
}

export function formatTokenCount(n: number): string {
  return n.toLocaleString("en-US");
}
