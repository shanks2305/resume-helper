import { NextResponse } from "next/server";
import { resolveProvider } from "@/lib/llm";

export const runtime = "nodejs";

export async function GET() {
  const configured = resolveProvider();
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const ollamaBase = (
    process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
  ).replace(/\/$/, "");

  let ollamaOk = false;
  let ollamaDetail = "unreachable";

  try {
    const response = await fetch(`${ollamaBase}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    ollamaOk = response.ok;
    ollamaDetail = response.ok ? "ready" : `status ${response.status}`;
  } catch {
    ollamaDetail = "unreachable";
  }

  return NextResponse.json({
    defaultProvider: configured,
    openai: {
      configured: openaiConfigured,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    },
    ollama: {
      ready: ollamaOk,
      detail: ollamaDetail,
      baseUrl: ollamaBase,
      model: process.env.OLLAMA_MODEL || "llama3.1:8b",
    },
  });
}
