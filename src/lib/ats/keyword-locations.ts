export type KeywordLocation = {
  term: string;
  section: string;
  snippet: string;
};

const SECTION_HEADERS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Summary", pattern: /^(summary|profile|objective|about)\b/i },
  { name: "Experience", pattern: /^(experience|work history|employment|professional experience)\b/i },
  { name: "Education", pattern: /^(education|academic)\b/i },
  { name: "Skills", pattern: /^(skills|technical skills|technologies|tech stack|core competencies)\b/i },
  { name: "Projects", pattern: /^(projects|selected projects)\b/i },
  { name: "Certifications", pattern: /^(certifications?|licenses?)\b/i },
];

function splitSections(resumeText: string): Array<{ name: string; body: string }> {
  const lines = resumeText.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ name: string; body: string }> = [];
  let current = { name: "Header", body: "" };

  for (const line of lines) {
    const trimmed = line.trim();
    const header = SECTION_HEADERS.find((h) => h.pattern.test(trimmed));
    if (header && trimmed.length < 60) {
      if (current.body.trim()) sections.push(current);
      current = { name: header.name, body: "" };
      continue;
    }
    current.body += `${line}\n`;
  }
  if (current.body.trim()) sections.push(current);
  return sections;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findKeywordLocations(
  resumeText: string,
  terms: string[],
): KeywordLocation[] {
  const sections = splitSections(resumeText);
  const locations: KeywordLocation[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    const normalized = term.trim();
    if (!normalized) continue;
    const re = new RegExp(
      normalized.includes(" ")
        ? escapeRegex(normalized)
        : `(^|[^a-z0-9])${escapeRegex(normalized)}([^a-z0-9]|$)`,
      "i",
    );

    for (const section of sections) {
      const match = section.body.match(re);
      if (!match || match.index === undefined) continue;
      const key = `${normalized}:${section.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const start = Math.max(0, match.index - 40);
      const end = Math.min(section.body.length, match.index + normalized.length + 60);
      locations.push({
        term: normalized,
        section: section.name,
        snippet: section.body.slice(start, end).replace(/\s+/g, " ").trim(),
      });
      break;
    }
  }

  return locations;
}
