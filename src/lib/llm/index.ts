import { createOllamaClient } from "./ollama";
import { createOpenAiClient } from "./openai";
import type { LlmClient, LlmProvider } from "./types";

export type { LlmClient, LlmCompleteResult, LlmProvider } from "./types";
export type { LlmUsage } from "./usage";
export {
  addUsage,
  emptyUsage,
  estimateCostUsd,
  formatTokenCount,
  formatUsd,
} from "./usage";

export function resolveProvider(
  override?: string | null,
): LlmProvider {
  const value = (override || process.env.LLM_PROVIDER || "openai").toLowerCase();
  if (value === "ollama") return "ollama";
  return "openai";
}

export function createLlmClient(provider?: LlmProvider): LlmClient {
  const selected = provider || resolveProvider();
  return selected === "ollama" ? createOllamaClient() : createOpenAiClient();
}

export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error("Model response was not valid JSON.");
  }
}
