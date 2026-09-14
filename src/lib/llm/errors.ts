export function friendlyLlmError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("openai_api_key")) {
    return "ChatGPT is not configured. Add OPENAI_API_KEY in .env.local, or switch to Ollama.";
  }
  if (lower.includes("429") || lower.includes("rate limit")) {
    return "The model provider rate-limited this request. Wait a minute and try again.";
  }
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("abort")
  ) {
    return "The model took too long. Retry, or switch providers / use a smaller model.";
  }
  if (lower.includes("econnrefused") || lower.includes("fetch failed")) {
    return "Could not reach the model server. If using Ollama, confirm it is running locally.";
  }
  if (lower.includes("not valid json") || lower.includes("zod")) {
    return "The model returned an unexpected format. Retrying usually fixes this.";
  }
  if (lower.includes("empty response")) {
    return "The model returned an empty response. Retry the analysis.";
  }
  return message || "Analysis failed.";
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 2,
  delayMs = 600,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      const retryable =
        msg.includes("json") ||
        msg.includes("429") ||
        msg.includes("timeout") ||
        msg.includes("empty response") ||
        msg.includes("503") ||
        msg.includes("502");
      if (!retryable || i === attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw last;
}
