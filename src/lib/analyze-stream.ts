import type { AnalysisResult } from "@/lib/client-types";

export const ANALYZE_STEPS = [
  { id: "parse", label: "Parsing resume" },
  { id: "keywords", label: "Extracting JD keywords" },
  { id: "score", label: "Scoring match & ATS" },
  { id: "suggestions", label: "Writing rewrites & extras" },
] as const;

export type AnalyzeStepId = (typeof ANALYZE_STEPS)[number]["id"];

export type AnalyzeStreamEvent =
  | { type: "step"; step: AnalyzeStepId }
  | { type: "result"; data: AnalysisResult }
  | { type: "error"; error: string };

export async function readAnalyzeStream(
  response: Response,
  onEvent: (event: AnalyzeStreamEvent) => void,
): Promise<AnalysisResult> {
  if (!response.body) {
    throw new Error("No response body from analyze endpoint.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AnalysisResult | null = null;
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: AnalyzeStreamEvent;
      try {
        event = JSON.parse(trimmed) as AnalyzeStreamEvent;
      } catch {
        continue;
      }
      onEvent(event);
      if (event.type === "result") result = event.data;
      if (event.type === "error") streamError = event.error;
    }
  }

  if (buffer.trim()) {
    try {
      const event = JSON.parse(buffer.trim()) as AnalyzeStreamEvent;
      onEvent(event);
      if (event.type === "result") result = event.data;
      if (event.type === "error") streamError = event.error;
    } catch {
      /* ignore trailing junk */
    }
  }

  if (streamError) throw new Error(streamError);
  if (!result) throw new Error("Analysis finished without a result.");
  return result;
}
