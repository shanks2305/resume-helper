export type ResumeBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

import {
  parseContactLines,
  sanitizeResumeText,
  stripIconTokens,
  type ContactItem,
} from "./contact";

export type ParsedResumeSection = {
  title: string;
  blocks: ResumeBlock[];
};

export type ParsedResume = {
  name: string;
  contact: ContactItem[];
  sections: ParsedResumeSection[];
};

const KNOWN_SECTIONS = new Set([
  "CONTACT",
  "SUMMARY",
  "PROFESSIONAL SUMMARY",
  "OBJECTIVE",
  "SKILLS",
  "TECHNICAL SKILLS",
  "KEY SKILLS",
  "CORE COMPETENCIES",
  "EXPERIENCE",
  "WORK EXPERIENCE",
  "PROFESSIONAL EXPERIENCE",
  "EMPLOYMENT",
  "EDUCATION",
  "PROJECTS",
  "CERTIFICATIONS",
  "AWARDS",
  "PUBLICATIONS",
]);

function normalizeSectionTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("-") || trimmed.startsWith("•")) {
    return false;
  }

  const upper = trimmed.toUpperCase();
  if (KNOWN_SECTIONS.has(upper)) return true;

  if (
    trimmed.length >= 3 &&
    trimmed.length <= 45 &&
    trimmed === upper &&
    /[A-Z]/.test(trimmed) &&
    !/\d{4}/.test(trimmed)
  ) {
    return true;
  }

  return false;
}

function isBullet(line: string): boolean {
  return /^[-•*]\s+/.test(line.trim());
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[-•*]\s+/, "");
}

function linesToBlocks(lines: string[]): ResumeBlock[] {
  const blocks: ResumeBlock[] = [];
  let bulletBuf: string[] = [];

  const flushBullets = () => {
    if (bulletBuf.length === 0) return;
    blocks.push({ type: "ul", items: bulletBuf });
    bulletBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      continue;
    }
    if (isBullet(trimmed)) {
      bulletBuf.push(stripIconTokens(stripBullet(trimmed)));
      continue;
    }
    flushBullets();
    blocks.push({ type: "p", text: stripIconTokens(trimmed) });
  }
  flushBullets();
  return blocks;
}

/** @deprecated Prefer ParsedResume.sections[].blocks — kept for tests/compat */
export type LegacyParsedResumeSection = {
  title: string;
  lines: string[];
};

export function parseResumeDraft(raw: string): ParsedResume {
  const lines = sanitizeResumeText(raw).replace(/\r\n/g, "\n").split("\n");
  const header: string[] = [];
  const rawSections: Array<{ title: string; lines: string[] }> = [];

  let current: { title: string; lines: string[] } | null = null;
  let seenSection = false;

  for (const line of lines) {
    if (isSectionHeader(line)) {
      seenSection = true;
      current = {
        title: normalizeSectionTitle(line.trim()),
        lines: [],
      };
      rawSections.push(current);
      continue;
    }

    if (!seenSection) {
      if (line.trim() || header.length > 0) header.push(line);
    } else if (current) {
      current.lines.push(line);
    }
  }

  const headerLines = trimSectionLines(header);
  const name = stripIconTokens(headerLines[0] || "");
  const contact = parseContactLines(headerLines.slice(1));

  if (rawSections.length === 0) {
    return {
      name,
      contact,
      sections: [{ title: "RESUME", blocks: linesToBlocks(lines) }],
    };
  }

  return {
    name,
    contact,
    sections: rawSections.map((s) => ({
      title: s.title,
      blocks: linesToBlocks(s.lines),
    })),
  };
}

export function titleCaseSection(title: string): string {
  return title
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function trimSectionLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed && out.length > 0 && out[out.length - 1] === "") continue;
    out.push(trimmed);
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sectionToPlainLines(section: {
  title: string;
  blocks: ResumeBlock[];
}): string[] {
  const lines: string[] = [];
  for (const block of section.blocks) {
    if (block.type === "p") lines.push(stripIconTokens(block.text));
    else
      for (const item of block.items)
        lines.push(`- ${stripIconTokens(item)}`);
  }
  return lines;
}
