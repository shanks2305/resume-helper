import { NextResponse } from "next/server";
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
  ATS_RESUME_SYSTEM,
  KEYWORD_SYSTEM,
  buildAtsResumePrompt,
  buildKeywordPrompt,
} from "@/lib/prompts";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";
import {
  structuredResumeSchema,
  structuredToPlainText,
} from "@/lib/resume/structured";
import { jdKeywordsSchema } from "@/lib/schemas";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 90;

const atsResumeResponseSchema = z.object({
  resume: structuredResumeSchema,
  notes: z.string().default(""),
});

/** Backward-compatible: older models may still return { draft }. */
const legacyDraftSchema = z.object({
  draft: z.string().min(40),
  notes: z.string().default(""),
});

export async function POST(request: Request) {
  const limited = rateLimit(`generate-resume:${clientKeyFromRequest(request)}`, 10);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Rate limit reached. Try again in ${limited.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  try {
    const form = await request.formData();
    const jdRaw = String(form.get("jd") || "").trim();
    const resumePaste = String(form.get("resumeText") || "");
    const providerOverride = form.get("provider");
    const file = form.get("resume");
    const resumeFile =
      file instanceof File && file.size > 0 ? file : null;

    if (!jdRaw) {
      return NextResponse.json(
        { error: "Job description is required." },
        { status: 400 },
      );
    }

    if (resumeFile && resumeFile.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Resume file must be under 5MB." },
        { status: 400 },
      );
    }

    const { cleaned: jd } = cleanJobDescription(jdRaw);
    const { text: resumeText } = await extractResumeText(
      resumeFile,
      resumePaste,
      { allowOcr: true },
    );

    if (resumeText.trim().length < 40) {
      return NextResponse.json(
        { error: "Provide a resume file or paste text (at least ~40 characters)." },
        { status: 400 },
      );
    }

    const provider = resolveProvider(
      typeof providerOverride === "string" ? providerOverride : null,
    );
    const llm = createLlmClient(provider);
    const jdHash = hashJd(jd);
    let usage = emptyUsage();

    let keywords = getCachedKeywords(jdHash);
    if (!keywords) {
      const rawKeywords = form.get("keywords");
      if (typeof rawKeywords === "string" && rawKeywords.trim()) {
        try {
          keywords = jdKeywordsSchema.parse(JSON.parse(rawKeywords));
          setCachedKeywords(jdHash, keywords);
        } catch {
          keywords = null;
        }
      }
    }
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

    const scored = scoreResumeAgainstKeywords(resumeText, keywords, jd);

    const draftResult = await withRetry(() =>
      llm.complete(
        buildAtsResumePrompt({
          jd,
          resume: resumeText,
          missingRequired: scored.missingRequired,
          missingPreferred: scored.missingPreferred,
          requiredSkills: keywords.required,
          tools: keywords.tools,
          atsFails: scored.atsFails,
        }),
        {
          system: ATS_RESUME_SYSTEM,
          json: true,
          temperature: 0.25,
        },
      ),
    );
    usage = addUsage(usage, draftResult.usage);

    const usagePayload = {
      ...usage,
      estimatedCostUsd: estimateCostUsd(llm.provider, llm.model, usage),
    };

    const json = extractJson(draftResult.text);
    const structured = atsResumeResponseSchema.safeParse(json);
    if (structured.success) {
      const draft = structuredToPlainText(structured.data.resume);
      return NextResponse.json({
        draft,
        structured: structured.data.resume,
        notes: structured.data.notes.trim(),
        provider: llm.provider,
        model: llm.model,
        jdHash,
        usage: usagePayload,
      });
    }

    const legacy = legacyDraftSchema.safeParse(json);
    if (legacy.success) {
      return NextResponse.json({
        draft: legacy.data.draft.trim(),
        notes: legacy.data.notes.trim(),
        provider: llm.provider,
        model: llm.model,
        jdHash,
        usage: usagePayload,
      });
    }

    throw new Error("Could not parse structured resume from the model.");
  } catch (error) {
    return NextResponse.json(
      { error: friendlyLlmError(error) },
      { status: 500 },
    );
  }
}
