import type { LlmUsage } from "./usage";

export type LlmProvider = "openai" | "ollama";

export type { LlmUsage };

export interface LlmCompleteOptions {
  system?: string;
  json?: boolean;
  temperature?: number;
}

export interface LlmCompleteResult {
  text: string;
  usage: LlmUsage;
}

export interface LlmClient {
  provider: LlmProvider;
  model: string;
  complete(prompt: string, options?: LlmCompleteOptions): Promise<LlmCompleteResult>;
}
