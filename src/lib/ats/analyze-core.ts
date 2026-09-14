import { runAtsChecks, scoreAtsChecks } from "@/lib/ats/format-checks";
import { findUnquantifiedBullets } from "@/lib/ats/bullet-metrics";
import { findKeywordLocations } from "@/lib/ats/keyword-locations";
import { matchKeywords, scoreKeywordMatches } from "@/lib/ats/keyword-match";
import { checkSeniority } from "@/lib/ats/years-check";
import {
  computeOverallScore,
  failingAtsLabels,
  missingByCategory,
  scoreSections,
} from "@/lib/ats/score";
import type { AnalysisResult, JdKeywords } from "@/lib/schemas";

export function scoreResumeAgainstKeywords(
  resumeText: string,
  keywords: JdKeywords,
  jdText?: string,
) {
  const matches = matchKeywords(resumeText, keywords);
  const atsChecks = runAtsChecks(resumeText);
  const keywordScore = scoreKeywordMatches(matches);
  const atsScore = scoreAtsChecks(atsChecks);
  const sectionScore = scoreSections(resumeText);
  const overall = computeOverallScore({
    keyword: keywordScore,
    ats: atsScore,
    section: sectionScore,
  });

  const missingRequired = missingByCategory(matches, "required");
  const missingPreferred = [
    ...missingByCategory(matches, "preferred"),
    ...missingByCategory(matches, "tools"),
  ];

  const foundTerms = matches.filter((m) => m.found).map((m) => m.term);
  const keywordLocations = findKeywordLocations(resumeText, foundTerms);
  const seniority = jdText ? checkSeniority(jdText, resumeText) : undefined;
  const bulletTips = findUnquantifiedBullets(resumeText);

  return {
    matches,
    atsChecks,
    scores: {
      overall,
      keyword: keywordScore,
      ats: atsScore,
      section: sectionScore,
    },
    missingRequired,
    missingPreferred: [...new Set(missingPreferred)],
    keywordLocations,
    seniority,
    bulletTips,
    atsFails: failingAtsLabels(atsChecks),
  };
}

export function toAnalysisPartial(
  scored: ReturnType<typeof scoreResumeAgainstKeywords>,
): Pick<
  AnalysisResult,
  | "scores"
  | "matches"
  | "missingRequired"
  | "missingPreferred"
  | "keywordLocations"
  | "seniority"
  | "bulletTips"
  | "atsChecks"
> {
  return {
    scores: scored.scores,
    matches: scored.matches,
    missingRequired: scored.missingRequired,
    missingPreferred: scored.missingPreferred,
    keywordLocations: scored.keywordLocations,
    seniority: scored.seniority,
    bulletTips: scored.bulletTips,
    atsChecks: scored.atsChecks,
  };
}
