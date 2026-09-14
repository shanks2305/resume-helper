import OpenAI from "openai";
import type { LlmClient, LlmCompleteOptions } from "./types";
import { usageFromCounts } from "./usage";

export function createOpenAiClient(): LlmClient {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.local or switch LLM_PROVIDER to ollama.",
    );
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  return {
    provider: "openai",
    model,
    async complete(prompt: string, options: LlmCompleteOptions = {}) {
      const response = await client.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.2,
        response_format: options.json ? { type: "json_object" } : undefined,
        messages: [
          ...(options.system
            ? [{ role: "system" as const, content: options.system }]
            : []),
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("OpenAI returned an empty response.");
      }

      const usage = usageFromCounts(
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0,
      );

      return { text: content, usage };
    },
  };
}
