export const KEYWORD_SYSTEM = `You extract hiring keywords from job descriptions for ATS resume matching.
Return ONLY valid JSON. Prefer concrete skills, tools, frameworks, certifications, and role titles.
Normalize synonyms to a common form (e.g. "k8s" -> "Kubernetes", "JS" -> "JavaScript").
Do not invent requirements that are not in the JD.`;

export function buildKeywordPrompt(jd: string) {
  return `Extract keywords from this job description.

Return JSON with this exact shape:
{
  "required": string[],
  "preferred": string[],
  "tools": string[],
  "titles": string[],
  "softSkills": string[]
}

Put must-have skills in required. Put nice-to-haves in preferred.
Put software, platforms, and languages in tools when relevant.
Keep each item short (1-4 words).

JOB DESCRIPTION:
"""
${jd.slice(0, 12000)}
"""`;
}

export const SUGGESTION_SYSTEM = `You help candidates improve resume ATS match against a specific job description.
Rules:
- Never invent employers, job titles, degrees, dates, or metrics the resume does not support.
- Only suggest wording changes that could reasonably reflect experience already implied.
- Prefer weaving missing keywords into existing bullets over keyword stuffing.
- Be specific and actionable.
- tailoredSummary must be a short professional summary grounded only in the resume.
- skillsReorder should list skills/tools from the resume ordered for this JD (required terms first).
- fullDraft is an ATS-safe plain-text resume that fills a common one-page format (name, contact, SUMMARY, SKILLS, EXPERIENCE with "Title — Company | Location | Dates" then "-" bullets, EDUCATION). Contact uses plain values or Email:/Ph:/Loc: labels — never icon names. Dense and factual. Keep every skill already on the source resume. Use the JD's exact keyword spelling in SKILLS when the source resume supports that skill (including synonyms like k8s → Kubernetes). Target roughly 350–900 words. If the user opted out of ATS resume generation, set fullDraft to "".
- coverLetter is a short tailored cover letter (150-250 words) with no invented experience.
- interviewPrep is 4-6 talking points or study prompts based on keyword gaps.
- learningTopics: 5-8 concrete topics/skills the candidate should study for THIS JD. Prioritize missing required/tools, then important JD skills they only weakly cover. Each item needs topic, why (tied to the JD), and priority.
- commonQuestions: 6-10 frequently asked interview questions for the skills/tech this JD requires (languages, frameworks, tools, system design, role-specific). Include skill label and a short tip on what a strong answer covers. Questions should be realistic screen/onsite questions, not trivia dumps.
- recruiterView.indexed = phrases an ATS may index; humanSees = what a recruiter notices; notes = brief contrast.
Return ONLY valid JSON.`;

export function buildSuggestionPrompt(input: {
  jd: string;
  resume: string;
  missingRequired: string[];
  missingPreferred: string[];
  presentKeywords: string[];
  requiredSkills: string[];
  tools: string[];
  preferredSkills: string[];
  atsFails: string[];
  bulletTips: string[];
  seniorityDetail: string;
  includeAtsResume?: boolean;
}) {
  const includeAtsResume = input.includeAtsResume !== false;
  return `Analyze this resume against the JD gaps and propose fixes.

Return JSON with this exact shape:
{
  "summary": string,
  "priorities": string[],
  "suggestions": [
    {
      "original": string,
      "revised": string,
      "keywordsAdded": string[],
      "rationale": string
    }
  ],
  "tailoredSummary": string,
  "skillsReorder": string[],
  "fullDraft": string,
  "coverLetter": string,
  "interviewPrep": string[],
  "learningTopics": [
    {
      "topic": string,
      "why": string,
      "priority": "high" | "medium" | "low"
    }
  ],
  "commonQuestions": [
    {
      "question": string,
      "skill": string,
      "tip": string
    }
  ],
  "recruiterView": {
    "indexed": string[],
    "humanSees": string[],
    "notes": string
  }
}

Provide 3-6 rewrite suggestions when possible. If nothing can be truthfully rewritten, explain that in summary and leave suggestions empty.
Priorities should be the top actions ranked by impact.

For learningTopics: focus on what THIS JD expects. Mark missing required/tools as high priority.
For commonQuestions: base questions on required skills + tools from the JD (not generic soft-skill fluff).
${
  includeAtsResume
    ? "Include a complete ATS-safe fullDraft tailored to this JD. Keep evidenced keywords using the JD's exact spelling in SKILLS."
    : 'Set fullDraft to "" (user opted out of ATS resume generation for this run).'
}

Keywords already evidenced in the resume — keep these JD spellings in fullDraft SKILLS: ${JSON.stringify(input.presentKeywords)}
Missing required keywords: ${JSON.stringify(input.missingRequired)}
Missing preferred keywords: ${JSON.stringify(input.missingPreferred)}
JD required skills: ${JSON.stringify(input.requiredSkills)}
JD tools / tech: ${JSON.stringify(input.tools)}
JD preferred skills: ${JSON.stringify(input.preferredSkills)}
ATS issues: ${JSON.stringify(input.atsFails)}
Bullets lacking metrics: ${JSON.stringify(input.bulletTips)}
Seniority note: ${JSON.stringify(input.seniorityDetail)}

JOB DESCRIPTION:
"""
${input.jd.slice(0, 8000)}
"""

RESUME:
"""
${input.resume.slice(0, 14000)}
"""`;
}

export const OCR_SYSTEM = `You extract plain text from resume documents that may be scanned or image-based.
Return ONLY the resume text. Preserve section order. Do not invent content.`;

export const ATS_RESUME_SYSTEM = `You fill a common one-page resume FORMAT with content from the candidate's existing resume, tailored to a job description.
Think like Jake's Resume / moderncv: dense, factual, ATS-safe. You fill slots — you do not invent a freeform layout.

Rules:
- Never invent employers, titles, degrees, dates, certifications, metrics, or employers not in the source resume.
- Keep every real employer, education entry, project, and skill group from the source; only improve wording and JD keyword coverage.
- Prefer 3–6 bullets per role. Action + scope + outcome when the resume supports metrics. Target ~350–900 words so ATS length scoring stays healthy.
- ATS matchers look for the JD's exact phrases. In skills[], use those exact strings (e.g. "Kubernetes" not only "k8s", "CI/CD" not only "pipelines") whenever the CURRENT RESUME already shows that skill or a synonym.
- Copy every source skill. Then put JD required + tools first. Do not shrink the skills list to look "clean".
- Weave missing JD keywords into existing bullets and the summary when the source experience reasonably supports them. Do not invent projects to justify a keyword.
- Keywords listed as already present MUST still appear in the rewritten resume (skills plus at least summary or one bullet).
- Contact fields: plain values only (no icon names like envelope/phone/map-marker).
- Omit empty optional arrays.
Return ONLY valid JSON.`;

export function buildAtsResumePrompt(input: {
  jd: string;
  resume: string;
  missingRequired: string[];
  missingPreferred: string[];
  presentKeywords: string[];
  requiredSkills: string[];
  tools: string[];
  preferredSkills: string[];
  atsFails: string[];
}) {
  return `Fill this common resume format using ONLY facts from the CURRENT RESUME, tailored to the JOB DESCRIPTION.

Return JSON with this exact shape:
{
  "resume": {
    "name": string,
    "email": string,
    "phone": string,
    "location": string,
    "links": string[],
    "summary": string,
    "skills": string[],
    "experience": [
      {
        "company": string,
        "title": string,
        "location": string,
        "dates": string,
        "bullets": string[]
      }
    ],
    "education": [
      {
        "school": string,
        "degree": string,
        "location": string,
        "dates": string,
        "details": string[]
      }
    ],
    "projects": [
      {
        "name": string,
        "tech": string,
        "bullets": string[]
      }
    ],
    "certifications": string[]
  },
  "notes": string
}

notes = 1–2 sentences on what you changed for this JD.
dates examples: "Jan 2021 – Present", "2019 – 2021".
links = LinkedIn/GitHub/portfolio URLs only if present in the source.

Keywords already evidenced in CURRENT RESUME — you MUST keep these exact JD spellings in skills[]: ${JSON.stringify(input.presentKeywords)}
Missing required keywords to weave in when the source reasonably supports them: ${JSON.stringify(input.missingRequired)}
Missing preferred / tools keywords: ${JSON.stringify(input.missingPreferred)}
JD required skills: ${JSON.stringify(input.requiredSkills)}
JD tools / tech: ${JSON.stringify(input.tools)}
JD preferred skills: ${JSON.stringify(input.preferredSkills)}
ATS format issues: ${JSON.stringify(input.atsFails)}

JOB DESCRIPTION:
"""
${input.jd.slice(0, 8000)}
"""

CURRENT RESUME:
"""
${input.resume.slice(0, 14000)}
"""`;
}
