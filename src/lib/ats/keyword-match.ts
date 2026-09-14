import type { JdKeywords, KeywordMatch } from "@/lib/schemas";

const SYNONYMS: Record<string, string[]> = {
  javascript: ["js", "ecmascript", "es6", "es2015"],
  typescript: ["ts"],
  kubernetes: ["k8s", "kube"],
  "node.js": ["nodejs", "node", "node js"],
  react: ["reactjs", "react.js"],
  "react native": ["reactnative"],
  "next.js": ["nextjs", "next js"],
  "ci/cd": ["cicd", "continuous integration", "continuous delivery", "continuous deployment"],
  aws: ["amazon web services", "amazon aws"],
  gcp: ["google cloud", "google cloud platform"],
  azure: ["microsoft azure"],
  postgresql: ["postgres", "psql", "postgre sql"],
  mongodb: ["mongo", "mongo db"],
  mysql: ["my sql"],
  redis: ["redis cache"],
  "machine learning": ["ml", "ml models"],
  "artificial intelligence": ["ai"],
  "rest api": ["restful", "rest apis", "restful apis", "rest endpoints"],
  graphql: ["graph ql", "gql"],
  docker: ["containers", "containerization"],
  terraform: ["tf", "iac"],
  python: ["py"],
  java: ["jvm"],
  golang: ["go lang", "go"],
  "c#": ["csharp", "c sharp", ".net", "dotnet"],
  ".net": ["dotnet", "asp.net", "csharp"],
  kafka: ["apache kafka"],
  spark: ["apache spark"],
  airflow: ["apache airflow"],
  elasticsearch: ["elastic search", "elk"],
  datadog: ["dd"],
  opentelemetry: ["o11y", "otel", "open telemetry"],
  "unit testing": ["unit tests", "jest", "pytest", "testing"],
  microservices: ["microservice", "service oriented"],
  agile: ["scrum", "sprint planning"],
  "system design": ["distributed systems", "architecture"],
  leadership: ["tech lead", "mentorship", "mentoring"],
};

function normalize(term: string): string {
  return term
    .toLowerCase()
    .replace(/[._/()+#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termVariants(term: string): string[] {
  const base = normalize(term);
  const extras = SYNONYMS[base] || [];
  // also reverse-lookup: if term is a synonym, include canonical
  const reverse: string[] = [];
  for (const [canonical, list] of Object.entries(SYNONYMS)) {
    if (list.map(normalize).includes(base) || canonical === base) {
      reverse.push(canonical, ...list);
    }
  }
  return Array.from(new Set([base, ...extras.map(normalize), ...reverse.map(normalize)]));
}

function resumeContains(resumeNorm: string, variant: string): boolean {
  if (!variant) return false;
  if (variant.includes(" ")) {
    return resumeNorm.includes(variant);
  }
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(variant)}([^a-z0-9]|$)`, "i");
  return re.test(resumeNorm);
}

function importanceFor(
  category: KeywordMatch["category"],
): NonNullable<KeywordMatch["importance"]> {
  if (category === "required") return "critical";
  if (category === "tools") return "high";
  if (category === "preferred") return "medium";
  return "low";
}

export function matchKeywords(
  resumeText: string,
  keywords: JdKeywords,
): KeywordMatch[] {
  const resumeNorm = normalize(resumeText);
  const matches: KeywordMatch[] = [];
  const seen = new Set<string>();

  const categories: Array<keyof JdKeywords> = [
    "required",
    "preferred",
    "tools",
    "titles",
    "softSkills",
  ];

  for (const category of categories) {
    for (const term of keywords[category]) {
      const key = `${category}:${normalize(term)}`;
      if (seen.has(key) || !term.trim()) continue;
      seen.add(key);

      const variants = termVariants(term);
      const hit = variants.find((v) => resumeContains(resumeNorm, v));
      matches.push({
        term,
        category,
        found: Boolean(hit),
        matchedAs: hit && hit !== normalize(term) ? hit : undefined,
        importance: importanceFor(category),
      });
    }
  }

  return matches;
}

export function scoreKeywordMatches(matches: KeywordMatch[]): number {
  const required = matches.filter((m) => m.category === "required");
  const preferred = matches.filter(
    (m) => m.category === "preferred" || m.category === "tools",
  );
  const soft = matches.filter(
    (m) => m.category === "softSkills" || m.category === "titles",
  );

  const ratio = (items: KeywordMatch[]) =>
    items.length === 0
      ? 1
      : items.filter((m) => m.found).length / items.length;

  const score =
    ratio(required) * 0.55 + ratio(preferred) * 0.3 + ratio(soft) * 0.15;
  return Math.round(score * 100);
}

export function mergeKeywords(
  base: JdKeywords,
  extra: JdKeywords,
): JdKeywords {
  const merge = (a: string[], b: string[]) =>
    Array.from(new Set([...a, ...b].map((s) => s.trim()).filter(Boolean)));
  return {
    required: merge(base.required, extra.required),
    preferred: merge(base.preferred, extra.preferred),
    tools: merge(base.tools, extra.tools),
    titles: merge(base.titles, extra.titles),
    softSkills: merge(base.softSkills, extra.softSkills),
  };
}
