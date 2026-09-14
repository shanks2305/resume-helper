import type { AtsCheck, KeywordMatch } from "@/lib/schemas";

export function scoreSections(resumeText: string): number {
  const checks = [
    /summary|profile|objective/i.test(resumeText),
    /experience|employment|work history/i.test(resumeText),
    /education/i.test(resumeText),
    /skills|technologies|tech stack/i.test(resumeText),
    /project/i.test(resumeText) || /certification/i.test(resumeText),
  ];
  const hit = checks.filter(Boolean).length;
  return Math.round((hit / checks.length) * 100);
}

export function computeOverallScore(parts: {
  keyword: number;
  ats: number;
  section: number;
}): number {
  return Math.round(
    parts.keyword * 0.5 + parts.ats * 0.3 + parts.section * 0.2,
  );
}

export function missingByCategory(
  matches: KeywordMatch[],
  category: KeywordMatch["category"],
): string[] {
  return matches
    .filter((m) => m.category === category && !m.found)
    .map((m) => m.term);
}

export function failingAtsLabels(checks: AtsCheck[]): string[] {
  return checks.filter((c) => !c.passed).map((c) => c.label);
}
