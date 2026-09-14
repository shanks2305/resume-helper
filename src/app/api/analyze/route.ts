import { scoreResumeAgainstKeywords } from "@/lib/ats/analyze-core";
import {
  getCachedKeywords,
  hashJd,
  setCachedKeywords,
} from "@/lib/cache/jd-keywords";
import { cleanJobDescription } from "@/lib/jd/cleanup";
import {
  addUsage,
  createLlmClient,
  emptyUsage,
  estimateCostUsd,
  extractJson,
  resolveProvider,
} from "@/lib/llm";
import { friendlyLlmError, withRetry } from "@/lib/llm/errors";
import { extractResumeText } from "@/lib/parse/resume";
import {
  KEYWORD_SYSTEM,
  SUGGESTION_SYSTEM,
  buildKeywordPrompt,
  buildSuggestionPrompt,
} from "@/lib/prompts";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";
import {
  jdKeywordsSchema,
  suggestionsSchema,
  type AnalysisResult,
  type JdKeywords,
} from "@/lib/schemas";
import { mergeKeywords } from "@/lib/ats/keyword-match";
import type {
  AnalyzeStepId,
  AnalyzeStreamEvent,
} from "@/lib/analyze-stream";

export const runtime = "nodejs";
export const maxDuration = 120;

function encodeEvent(event: AnalyzeStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function parseTemplateKeywords(raw: FormDataEntryValue | null): JdKeywords | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return jdKeywordsSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(clientKeyFromRequest(request));
  if (!limited.ok) {
    return new Response(
      `${JSON.stringify({
        type: "error",
        error: `Rate limit reached. Try again in ${limited.retryAfterSec}s.`,
      })}\n`,
      {
        status: 429,
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Retry-After": String(limited.retryAfterSec),
        },
      },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AnalyzeStreamEvent) => {
        controller.enqueue(encodeEvent(event));
      };
      const step = (id: AnalyzeStepId) => send({ type: "step", step: id });

      try {
        const form = await request.formData();
        const jdRaw = String(form.get("jd") || "").trim();
        const resumePaste = String(form.get("resumeText") || "");
        const providerOverride = form.get("provider");
        const file = form.get("resume");
        const templateKeywords = parseTemplateKeywords(form.get("templateKeywords"));
        const includeAtsResume =
          String(form.get("generateAtsResume") || "true") !== "false";

        if (!jdRaw) {
          send({ type: "error", error: "Job description is required." });
          controller.close();
          return;
        }

        const { cleaned: jd, removedBoilerplate } = cleanJobDescription(jdRaw);

        const resumeFile =
          file instanceof File && file.size > 0 ? file : null;

        if (resumeFile && resumeFile.size > 5 * 1024 * 1024) {
          send({ type: "error", error: "Resume file must be under 5MB." });
          controller.close();
          return;
        }

        step("parse");
        const { text: resumeText } = await extractResumeText(
          resumeFile,
          resumePaste,
          { allowOcr: true },
        );

        const provider = resolveProvider(
          typeof providerOverride === "string" ? providerOverride : null,
        );
        const llm = createLlmClient(provider);
        const jdHash = hashJd(jd);
        let usage = emptyUsage();

        step("keywords");
        let keywords = getCachedKeywords(jdHash);
        if (!keywords) {
          const keywordResult = await withRetry(() =>
            llm.complete(buildKeywordPrompt(jd), {
              system: KEYWORD_SYSTEM,
              json: true,
              temperature: 0.1,
            }),
          );
          usage = addUsage(usage, keywordResult.usage);
          keywords = jdKeywordsSchema.parse(extractJson(keywordResult.text));
          setCachedKeywords(jdHash, keywords);
        }
        if (templateKeywords) {
          keywords = mergeKeywords(keywords, templateKeywords);
        }

        step("score");
        const scored = scoreResumeAgainstKeywords(resumeText, keywords, jd);

        step("suggestions");
        const suggestionResult = await withRetry(() =>
          llm.complete(
            buildSuggestionPrompt({
              jd,
              resume: resumeText,
              missingRequired: scored.missingRequired,
              missingPreferred: scored.missingPreferred,
              requiredSkills: keywords.required,
              tools: keywords.tools,
              preferredSkills: keywords.preferred,
              atsFails: scored.atsFails,
              bulletTips: scored.bulletTips.map((b) => b.original),
              seniorityDetail: scored.seniority?.detail || "",
              includeAtsResume,
            }),
            {
              system: SUGGESTION_SYSTEM,
              json: true,
              temperature: 0.3,
            },
          ),
        );
        usage = addUsage(usage, suggestionResult.usage);
        const suggestions = suggestionsSchema.parse(
          extractJson(suggestionResult.text),
        );

        const result: AnalysisResult = {
          provider: llm.provider,
          model: llm.model,
          jdHash,
          scores: scored.scores,
          keywords,
          matches: scored.matches,
          missingRequired: scored.missingRequired,
          missingPreferred: scored.missingPreferred,
          keywordLocations: scored.keywordLocations,
          seniority: scored.seniority,
          bulletTips: scored.bulletTips,
          atsChecks: scored.atsChecks,
          suggestions,
          resumePreview: resumeText.slice(0, 1200),
          jdCleaned: removedBoilerplate,
          usage: {
            ...usage,
            estimatedCostUsd: estimateCostUsd(llm.provider, llm.model, usage),
          },
        };

        send({ type: "result", data: result });
      } catch (error) {
        send({ type: "error", error: friendlyLlmError(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
