import { matchKeywords } from "@/lib/ats/keyword-match";
import type { JdKeywords } from "@/lib/schemas";
import {
  plainTextToStructured,
  structuredToPlainText,
  type StructuredResume,
} from "@/lib/resume/structured";

function skillKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function foundTermKeys(resumeText: string, keywords: JdKeywords): Set<string> {
  return new Set(
    matchKeywords(resumeText, keywords)
      .filter((m) => m.found)
      .map((m) => m.term.toLowerCase()),
  );
}

/** JD terms the source resume already supports (synonyms count). */
export function supportedJdTerms(
  sourceResumeText: string,
  keywords: JdKeywords,
): string[] {
  const supported = foundTermKeys(sourceResumeText, keywords);
  const ordered = [
    ...keywords.required,
    ...keywords.tools,
    ...keywords.preferred,
    ...keywords.titles,
    ...keywords.softSkills,
  ];
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const term of ordered) {
    const key = term.toLowerCase().trim();
    if (!key || seen.has(key) || !supported.has(key)) continue;
    seen.add(key);
    terms.push(term.trim());
  }
  return terms;
}

function mergeDroppedOriginalSkills(
  generated: string[],
  original: string[],
): string[] {
  if (original.length === 0) return generated;
  const generatedBlob = generated.join(" ").toLowerCase();
  const keys = new Set(generated.map(skillKey));
  const extra: string[] = [];
  for (const skill of original) {
    const key = skillKey(skill);
    if (!key || keys.has(key)) continue;
    if (generatedBlob.includes(key)) continue;
    keys.add(key);
    extra.push(skill);
  }
  return extra.length ? [...generated, ...extra] : generated;
}

function prependExactJdSkillLabels(
  skills: string[],
  sourceResumeText: string,
  keywords: JdKeywords,
): string[] {
  const have = new Set(skills.map(skillKey));
  const front: string[] = [];
  for (const term of supportedJdTerms(sourceResumeText, keywords)) {
    if (have.has(skillKey(term))) continue;
    have.add(skillKey(term));
    front.push(term);
  }
  return front.length ? [...front, ...skills] : skills;
}

/** Keep JD keyword spelling the ATS scorer looks for, without inventing skills. */
export function ensureKeywordCoverage(
  resume: StructuredResume,
  sourceResumeText: string,
  keywords: JdKeywords,
): StructuredResume {
  const original = plainTextToStructured(sourceResumeText);
  const merged = mergeDroppedOriginalSkills(
    resume.skills,
    original?.skills ?? [],
  );
  const skills = prependExactJdSkillLabels(
    merged,
    sourceResumeText,
    keywords,
  );
  if (skills === resume.skills) return resume;
  return { ...resume, skills };
}

export function ensureKeywordCoverageInDraft(
  draft: string,
  sourceResumeText: string,
  keywords: JdKeywords,
): { draft: string; structured: StructuredResume | null } {
  const structured = plainTextToStructured(draft);
  if (structured) {
    const repaired = ensureKeywordCoverage(
      structured,
      sourceResumeText,
      keywords,
    );
    return { draft: structuredToPlainText(repaired), structured: repaired };
  }

  const already = foundTermKeys(draft, keywords);
  const missingSupported = supportedJdTerms(sourceResumeText, keywords).filter(
    (term) => !already.has(term.toLowerCase()),
  );
  if (missingSupported.length === 0) {
    return { draft: draft.trim(), structured: null };
  }

  const bullets = missingSupported.map((t) => `- ${t}`).join("\n");
  if (/^skills$/im.test(draft)) {
    return {
      draft: draft.replace(/^skills$/im, `SKILLS\n${bullets}`),
      structured: null,
    };
  }
  return {
    draft: `${draft.trim()}\n\nSKILLS\n${bullets}`,
    structured: null,
  };
}
