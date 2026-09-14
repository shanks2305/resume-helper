export type SeniorityFinding = {
  jdYears: number | null;
  resumeYears: number | null;
  jdLevel: string | null;
  gap: "ok" | "short" | "unknown";
  detail: string;
};

function maxYearsMentioned(text: string): number | null {
  const re =
    /(\d+)\s*\+?\s*(?:\+|plus)?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:experience|exp))?/gi;
  let max: number | null = null;
  for (const match of text.matchAll(re)) {
    const n = Number(match[1]);
    if (!Number.isFinite(n)) continue;
    max = max === null ? n : Math.max(max, n);
  }
  return max;
}

function detectLevel(text: string): string | null {
  if (/\b(staff|principal|distinguished)\b/i.test(text)) return "staff+";
  if (/\b(senior|sr\.?)\b/i.test(text)) return "senior";
  if (/\b(mid[- ]?level|intermediate)\b/i.test(text)) return "mid";
  if (/\b(junior|jr\.?|entry[- ]level|new grad)\b/i.test(text)) return "junior";
  return null;
}

/** Heuristic years/seniority check from JD vs resume text. */
export function checkSeniority(jd: string, resume: string): SeniorityFinding {
  const jdYears = maxYearsMentioned(jd);
  const resumeYears = maxYearsMentioned(resume);
  const jdLevel = detectLevel(jd);

  if (jdYears === null && !jdLevel) {
    return {
      jdYears,
      resumeYears,
      jdLevel,
      gap: "unknown",
      detail: "JD does not state a clear years or seniority requirement.",
    };
  }

  if (jdYears !== null && resumeYears !== null) {
    if (resumeYears + 1 < jdYears) {
      return {
        jdYears,
        resumeYears,
        jdLevel,
        gap: "short",
        detail: `JD asks for about ${jdYears}+ years; resume language suggests around ${resumeYears}. Emphasize overlapping scope if you have it.`,
      };
    }
    return {
      jdYears,
      resumeYears,
      jdLevel,
      gap: "ok",
      detail: `Years look compatible (JD ~${jdYears}+, resume mentions ~${resumeYears}).`,
    };
  }

  if (jdLevel === "senior" || jdLevel === "staff+") {
    return {
      jdYears,
      resumeYears,
      jdLevel,
      gap: resumeYears !== null && resumeYears < 4 ? "short" : "unknown",
      detail: `JD signals ${jdLevel} level. Make sure leadership, ownership, and depth show clearly.`,
    };
  }

  return {
    jdYears,
    resumeYears,
    jdLevel,
    gap: "unknown",
    detail: "Could not fully compare years — check seniority wording manually.",
  };
}
