import type { LlmClient, LlmCompleteOptions } from "./types";
import { emptyUsage, usageFromCounts } from "./usage";

export function createOllamaClient(): LlmClient {
  const baseUrl = (
    process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
  ).replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";

  return {
    provider: "ollama",
    model,
    async complete(prompt: string, options: LlmCompleteOptions = {}) {
      const messages = [
        ...(options.system
          ? [{ role: "system", content: options.system }]
          : []),
        { role: "user", content: prompt },
      ];

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: options.json ? "json" : undefined,
          options: {
            temperature: options.temperature ?? 0.2,
          },
          messages,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Ollama request failed (${response.status}). Is Ollama running at ${baseUrl}? ${detail}`.trim(),
        );
      }

      const data = (await response.json()) as {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };
      const content = data.message?.content;
      if (!content) {
        throw new Error("Ollama returned an empty response.");
      }

      const usage =
        typeof data.prompt_eval_count === "number" ||
        typeof data.eval_count === "number"
          ? usageFromCounts(
              data.prompt_eval_count ?? 0,
              data.eval_count ?? 0,
            )
          : { ...emptyUsage(), calls: 1 };

      return { text: content, usage };
    },
  };
}
