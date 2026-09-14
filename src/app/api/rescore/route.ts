import { NextResponse } from "next/server";
import { scoreResumeAgainstKeywords } from "@/lib/ats/analyze-core";
import {
  getCachedKeywords,
  hashJd,
  setCachedKeywords,
} from "@/lib/cache/jd-keywords";
import { cleanJobDescription } from "@/lib/jd/cleanup";
import {
  createLlmClient,
  extractJson,
  resolveProvider,
} from "@/lib/llm";
import { friendlyLlmError, withRetry } from "@/lib/llm/errors";
import { extractResumeText } from "@/lib/parse/resume";
import { KEYWORD_SYSTEM, buildKeywordPrompt } from "@/lib/prompts";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";
import {
  jdKeywordsSchema,
  type ScoreOnlyResult,
} from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

type RescoreInput = {
  jd?: string;
  jdHash?: string;
  resumeText?: string;
  previousScores?: ScoreOnlyResult["scores"];
  provider?: string;
  keywords?: unknown;
  resumeFile?: File | null;
};

async function readRescoreInput(request: Request): Promise<RescoreInput> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("resume");
    let previousScores: ScoreOnlyResult["scores"] | undefined;
    let keywords: unknown;
    try {
      const rawScores = form.get("previousScores");
      if (typeof rawScores === "string" && rawScores.trim()) {
        previousScores = JSON.parse(rawScores) as ScoreOnlyResult["scores"];
      }
    } catch {
      previousScores = undefined;
    }
    try {
      const rawKeywords = form.get("keywords");
      if (typeof rawKeywords === "string" && rawKeywords.trim()) {
        keywords = JSON.parse(rawKeywords);
      }
    } catch {
      keywords = undefined;
    }

    return {
      jd: String(form.get("jd") || ""),
      jdHash: String(form.get("jdHash") || "") || undefined,
      resumeText: String(form.get("resumeText") || ""),
      provider: String(form.get("provider") || "") || undefined,
      previousScores,
      keywords,
      resumeFile: file instanceof File && file.size > 0 ? file : null,
    };
  }

  const body = (await request.json()) as RescoreInput;
  return {
    ...body,
    resumeFile: null,
  };
}

export async function POST(request: Request) {
  const limited = rateLimit(`rescore:${clientKeyFromRequest(request)}`, 20);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Rate limit reached. Try again in ${limited.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  try {
    const body = await readRescoreInput(request);

    if (body.resumeFile && body.resumeFile.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Resume file must be under 5MB." },
        { status: 400 },
      );
    }

    const extracted = await extractResumeText(
      body.resumeFile || null,
      String(body.resumeText || ""),
      { allowOcr: true },
    );
    const resumeText = extracted.text.trim();
    if (resumeText.length < 40) {
      return NextResponse.json(
        {
          error:
            "Provide a revised resume file or paste text (at least ~40 characters).",
        },
        { status: 400 },
      );
    }

    let keywords =
      (body.jdHash && getCachedKeywords(body.jdHash)) ||
      (body.keywords
        ? jdKeywordsSchema.safeParse(body.keywords).success
          ? jdKeywordsSchema.parse(body.keywords)
          : null
        : null);

    const jdRaw = String(body.jd || "").trim();
    const jd = jdRaw ? cleanJobDescription(jdRaw).cleaned : "";

    if (!keywords) {
      if (!jd) {
        return NextResponse.json(
          { error: "Provide jdHash from a prior analysis, keywords, or a JD." },
          { status: 400 },
        );
      }
      const provider = resolveProvider(body.provider || null);
      const llm = createLlmClient(provider);
      const keywordResult = await withRetry(() =>
        llm.complete(buildKeywordPrompt(jd), {
          system: KEYWORD_SYSTEM,
          json: true,
          temperature: 0.1,
        }),
      );
      keywords = jdKeywordsSchema.parse(extractJson(keywordResult.text));
      setCachedKeywords(hashJd(jd), keywords);
    }

    const scored = scoreResumeAgainstKeywords(
      resumeText,
      keywords,
      jd || undefined,
    );
    const result: ScoreOnlyResult = {
      scores: scored.scores,
      matches: scored.matches,
      missingRequired: scored.missingRequired,
      missingPreferred: scored.missingPreferred,
      atsChecks: scored.atsChecks,
    };

    if (body.previousScores) {
      result.delta = {
        overall: scored.scores.overall - body.previousScores.overall,
        keyword: scored.scores.keyword - body.previousScores.keyword,
        ats: scored.scores.ats - body.previousScores.ats,
        section: scored.scores.section - body.previousScores.section,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: friendlyLlmError(error) },
      { status: 500 },
    );
  }
}
