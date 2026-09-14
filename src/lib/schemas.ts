import { z } from "zod";

export const jdKeywordsSchema = z.object({
  required: z.array(z.string()).default([]),
  preferred: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  titles: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
});

export type JdKeywords = z.infer<typeof jdKeywordsSchema>;

export const rewriteSuggestionSchema = z.object({
  original: z.string(),
  revised: z.string(),
  keywordsAdded: z.array(z.string()).default([]),
  rationale: z.string(),
});

export const recruiterViewSchema = z.object({
  indexed: z.array(z.string()).default([]),
  humanSees: z.array(z.string()).default([]),
  notes: z.string().default(""),
});

export const learningTopicSchema = z.object({
  topic: z.string(),
  why: z.string().default(""),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
});

export const commonQuestionSchema = z.object({
  question: z.string(),
  skill: z.string().default(""),
  tip: z.string().default(""),
});

export const suggestionsSchema = z.object({
  summary: z.string(),
  priorities: z.array(z.string()).default([]),
  suggestions: z.array(rewriteSuggestionSchema).default([]),
  tailoredSummary: z.string().default(""),
  skillsReorder: z.array(z.string()).default([]),
  fullDraft: z.string().default(""),
  structuredResume: z
    .object({
      name: z.string(),
      email: z.string().default(""),
      phone: z.string().default(""),
      location: z.string().default(""),
      links: z.array(z.string()).default([]),
      summary: z.string().default(""),
      skills: z.array(z.string()).default([]),
      experience: z
        .array(
          z.object({
            company: z.string(),
            title: z.string(),
            location: z.string().default(""),
            dates: z.string(),
            bullets: z.array(z.string()).default([]),
          }),
        )
        .default([]),
      education: z
        .array(
          z.object({
            school: z.string(),
            degree: z.string(),
            location: z.string().default(""),
            dates: z.string().default(""),
            details: z.array(z.string()).default([]),
          }),
        )
        .default([]),
      projects: z
        .array(
          z.object({
            name: z.string(),
            tech: z.string().default(""),
            bullets: z.array(z.string()).default([]),
          }),
        )
        .default([]),
      certifications: z.array(z.string()).default([]),
    })
    .optional(),
  coverLetter: z.string().default(""),
  interviewPrep: z.array(z.string()).default([]),
  learningTopics: z.array(learningTopicSchema).default([]),
  commonQuestions: z.array(commonQuestionSchema).default([]),
  recruiterView: recruiterViewSchema.default({
    indexed: [],
    humanSees: [],
    notes: "",
  }),
});

export type SuggestionsResult = z.infer<typeof suggestionsSchema>;

export const atsCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  detail: z.string(),
  severity: z.enum(["info", "warn", "fail"]),
});

export type AtsCheck = z.infer<typeof atsCheckSchema>;

export const keywordMatchSchema = z.object({
  term: z.string(),
  category: z.enum(["required", "preferred", "tools", "titles", "softSkills"]),
  found: z.boolean(),
  matchedAs: z.string().optional(),
  importance: z.enum(["critical", "high", "medium", "low"]).optional(),
});

export type KeywordMatch = z.infer<typeof keywordMatchSchema>;

export const keywordLocationSchema = z.object({
  term: z.string(),
  section: z.string(),
  snippet: z.string(),
});

export const senioritySchema = z.object({
  jdYears: z.number().nullable(),
  resumeYears: z.number().nullable(),
  jdLevel: z.string().nullable(),
  gap: z.enum(["ok", "short", "unknown"]),
  detail: z.string(),
});

export const bulletTipSchema = z.object({
  original: z.string(),
  issue: z.string(),
  tip: z.string(),
});

export const llmUsageSchema = z.object({
  promptTokens: z.number().nonnegative(),
  completionTokens: z.number().nonnegative(),
  totalTokens: z.number().nonnegative(),
  calls: z.number().int().nonnegative(),
  /** Estimated USD; 0 for local models, null when price is unknown. */
  estimatedCostUsd: z.number().nonnegative().nullable().optional(),
});

export const analysisResultSchema = z.object({
  provider: z.enum(["openai", "ollama"]),
  model: z.string(),
  jdHash: z.string(),
  scores: z.object({
    overall: z.number(),
    keyword: z.number(),
    ats: z.number(),
    section: z.number(),
  }),
  keywords: jdKeywordsSchema,
  matches: z.array(keywordMatchSchema),
  missingRequired: z.array(z.string()),
  missingPreferred: z.array(z.string()),
  keywordLocations: z.array(keywordLocationSchema).default([]),
  seniority: senioritySchema.optional(),
  bulletTips: z.array(bulletTipSchema).default([]),
  atsChecks: z.array(atsCheckSchema),
  suggestions: suggestionsSchema,
  resumePreview: z.string(),
  jdCleaned: z.boolean().default(false),
  usage: llmUsageSchema.optional(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const scoreOnlyResultSchema = z.object({
  scores: z.object({
    overall: z.number(),
    keyword: z.number(),
    ats: z.number(),
    section: z.number(),
  }),
  matches: z.array(keywordMatchSchema),
  missingRequired: z.array(z.string()),
  missingPreferred: z.array(z.string()),
  atsChecks: z.array(atsCheckSchema),
  delta: z
    .object({
      overall: z.number(),
      keyword: z.number(),
      ats: z.number(),
      section: z.number(),
    })
    .optional(),
});

export type ScoreOnlyResult = z.infer<typeof scoreOnlyResultSchema>;
