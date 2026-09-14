import type { AtsCheck } from "@/lib/schemas";

const STANDARD_SECTIONS = [
  { id: "experience", patterns: [/experience/i, /work history/i, /employment/i] },
  { id: "education", patterns: [/education/i, /academic/i] },
  { id: "skills", patterns: [/skills/i, /technical skills/i, /technologies/i] },
];

export function runAtsChecks(resumeText: string): AtsCheck[] {
  const text = resumeText.trim();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const checks: AtsCheck[] = [];

  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
  checks.push({
    id: "contact-email",
    label: "Email address present",
    passed: hasEmail,
    detail: hasEmail
      ? "Found an email address ATS systems can parse."
      : "Add a plain-text email in the header.",
    severity: hasEmail ? "info" : "fail",
  });

  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  checks.push({
    id: "contact-phone",
    label: "Phone number present",
    passed: hasPhone,
    detail: hasPhone
      ? "Found a phone number."
      : "Include a phone number in plain text.",
    severity: hasPhone ? "info" : "warn",
  });

  for (const section of STANDARD_SECTIONS) {
    const found = section.patterns.some((p) => p.test(text));
    checks.push({
      id: `section-${section.id}`,
      label: `Standard section: ${section.id}`,
      passed: found,
      detail: found
        ? `Detected a ${section.id} section heading.`
        : `Add a clear "${section.id}" heading so ATS parsers categorize content.`,
      severity: found ? "info" : section.id === "skills" ? "warn" : "fail",
    });
  }

  const bulletCount = (text.match(/(^|\n)\s*([•●▪◦*-]|\d+[.)])\s+/g) || [])
    .length;
  const hasBullets = bulletCount >= 3;
  checks.push({
    id: "bullets",
    label: "Uses bullet points",
    passed: hasBullets,
    detail: hasBullets
      ? `Found about ${bulletCount} bullet-style lines.`
      : "Use plain bullet points for achievements instead of dense paragraphs.",
    severity: hasBullets ? "info" : "warn",
  });

  const tableLike = (text.match(/\|/g) || []).length >= 8;
  checks.push({
    id: "tables",
    label: "Avoids table-heavy layout",
    passed: !tableLike,
    detail: tableLike
      ? "Lots of | characters suggest a table layout that many ATS parsers mishandle."
      : "No strong table markers detected in extracted text.",
    severity: tableLike ? "warn" : "info",
  });

  const longLines = lines.filter((l) => l.length > 180).length;
  const multiColumnRisk = longLines > 8 && lines.length > 20;
  checks.push({
    id: "columns",
    label: "Likely single-column text",
    passed: !multiColumnRisk,
    detail: multiColumnRisk
      ? "Extracted text has many very long lines — multi-column PDFs often parse poorly."
      : "Line lengths look compatible with a single-column layout.",
    severity: multiColumnRisk ? "warn" : "info",
  });

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lengthOk = wordCount >= 150 && wordCount <= 1200;
  checks.push({
    id: "length",
    label: "Reasonable length",
    passed: lengthOk,
    detail: lengthOk
      ? `About ${wordCount} words — a solid ATS range.`
      : `About ${wordCount} words. Aim for roughly 300–900 words for most roles.`,
    severity: lengthOk ? "info" : "warn",
  });

  return checks;
}

export function scoreAtsChecks(checks: AtsCheck[]): number {
  if (checks.length === 0) return 0;
  const weights = { info: 1, warn: 2, fail: 3 } as const;
  let earned = 0;
  let total = 0;
  for (const check of checks) {
    const w = weights[check.severity];
    total += w;
    if (check.passed) earned += w;
  }
  return Math.round((earned / total) * 100);
}
