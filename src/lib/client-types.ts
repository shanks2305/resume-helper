export type LlmProvider = "openai" | "ollama";

export type AnalysisResult = {
  provider: LlmProvider;
  model: string;
  jdHash: string;
  scores: {
    overall: number;
    keyword: number;
    ats: number;
    section: number;
  };
  keywords: {
    required: string[];
    preferred: string[];
    tools: string[];
    titles: string[];
    softSkills: string[];
  };
  matches: Array<{
    term: string;
    category: "required" | "preferred" | "tools" | "titles" | "softSkills";
    found: boolean;
    matchedAs?: string;
    importance?: "critical" | "high" | "medium" | "low";
  }>;
  missingRequired: string[];
  missingPreferred: string[];
  keywordLocations: Array<{
    term: string;
    section: string;
    snippet: string;
  }>;
  seniority?: {
    jdYears: number | null;
    resumeYears: number | null;
    jdLevel: string | null;
    gap: "ok" | "short" | "unknown";
    detail: string;
  };
  bulletTips: Array<{
    original: string;
    issue: string;
    tip: string;
  }>;
  atsChecks: Array<{
    id: string;
    label: string;
    passed: boolean;
    detail: string;
    severity: "info" | "warn" | "fail";
  }>;
  suggestions: {
    summary: string;
    priorities: string[];
    suggestions: Array<{
      original: string;
      revised: string;
      keywordsAdded: string[];
      rationale: string;
    }>;
    tailoredSummary: string;
    skillsReorder: string[];
    fullDraft: string;
    /** Structured fill-in resume when generated via /api/generate-resume */
    structuredResume?: {
      name: string;
      email: string;
      phone: string;
      location: string;
      links: string[];
      summary: string;
      skills: string[];
      experience: Array<{
        company: string;
        title: string;
        location: string;
        dates: string;
        bullets: string[];
      }>;
      education: Array<{
        school: string;
        degree: string;
        location: string;
        dates: string;
        details: string[];
      }>;
      projects: Array<{
        name: string;
        tech: string;
        bullets: string[];
      }>;
      certifications: string[];
    };
    coverLetter: string;
    interviewPrep: string[];
    learningTopics: Array<{
      topic: string;
      why: string;
      priority: "high" | "medium" | "low";
    }>;
    commonQuestions: Array<{
      question: string;
      skill: string;
      tip: string;
    }>;
    recruiterView: {
      indexed: string[];
      humanSees: string[];
      notes: string;
    };
  };
  resumePreview: string;
  jdCleaned: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    calls: number;
    estimatedCostUsd?: number | null;
  };
};

export type ScoreOnlyResult = {
  scores: AnalysisResult["scores"];
  matches: AnalysisResult["matches"];
  missingRequired: string[];
  missingPreferred: string[];
  atsChecks: AnalysisResult["atsChecks"];
  delta?: AnalysisResult["scores"];
};
