import { z } from "zod";

/** Common one-page resume format — fill slots from JD + source resume. */
export const structuredResumeSchema = z.object({
  name: z.string().min(1),
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
});

export type StructuredResume = z.infer<typeof structuredResumeSchema>;

export function structuredToPlainText(r: StructuredResume): string {
  const lines: string[] = [];
  lines.push(r.name);

  const contactParts: string[] = [];
  if (r.email) contactParts.push(`Email: ${r.email}`);
  if (r.phone) contactParts.push(`Ph: ${r.phone}`);
  if (r.location) contactParts.push(`Loc: ${r.location}`);
  for (const link of r.links) {
    const lower = link.toLowerCase();
    if (lower.includes("linkedin")) contactParts.push(`LinkedIn: ${link}`);
    else if (lower.includes("github")) contactParts.push(`GitHub: ${link}`);
    else contactParts.push(`Web: ${link}`);
  }
  if (contactParts.length) lines.push(contactParts.join(" · "));

  if (r.summary) {
    lines.push("", "SUMMARY", r.summary);
  }

  if (r.skills.length) {
    lines.push("", "SKILLS");
    for (const s of r.skills) lines.push(`- ${s}`);
  }

  if (r.experience.length) {
    lines.push("", "EXPERIENCE");
    for (const job of r.experience) {
      const left = [job.title, job.company].filter(Boolean).join(" — ");
      const right = [job.location, job.dates].filter(Boolean).join(" | ");
      lines.push(right ? `${left} | ${right}` : left);
      for (const b of job.bullets) lines.push(`- ${b}`);
    }
  }

  if (r.education.length) {
    lines.push("", "EDUCATION");
    for (const ed of r.education) {
      const left = [ed.degree, ed.school].filter(Boolean).join(" — ");
      const right = [ed.location, ed.dates].filter(Boolean).join(" | ");
      lines.push(right ? `${left} | ${right}` : left);
      for (const d of ed.details) lines.push(`- ${d}`);
    }
  }

  if (r.projects.length) {
    lines.push("", "PROJECTS");
    for (const p of r.projects) {
      lines.push(p.tech ? `${p.name} — ${p.tech}` : p.name);
      for (const b of p.bullets) lines.push(`- ${b}`);
    }
  }

  if (r.certifications.length) {
    lines.push("", "CERTIFICATIONS");
    for (const c of r.certifications) lines.push(`- ${c}`);
  }

  return lines.join("\n").trim();
}

/** Try to lift a freeform ATS draft into the common format (best-effort). */
export function plainTextToStructured(raw: string): StructuredResume | null {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (text.length < 40) return null;

  const lines = text.split("\n");
  const name = lines[0]?.trim() || "";
  if (!name || /^SUMMARY|SKILLS|EXPERIENCE/i.test(name)) return null;

  const email =
    text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone =
    text.match(
      /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
    )?.[0] || "";

  const sectionMap = new Map<string, string[]>();
  let current = "";
  const header: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.trim().toUpperCase();
    if (
      [
        "SUMMARY",
        "PROFESSIONAL SUMMARY",
        "SKILLS",
        "TECHNICAL SKILLS",
        "EXPERIENCE",
        "WORK EXPERIENCE",
        "PROFESSIONAL EXPERIENCE",
        "EDUCATION",
        "PROJECTS",
        "CERTIFICATIONS",
      ].includes(upper)
    ) {
      current = upper.replace(/^PROFESSIONAL |^WORK |^TECHNICAL /, "");
      if (current === "PROFESSIONAL SUMMARY") current = "SUMMARY";
      sectionMap.set(current, []);
      continue;
    }
    if (!current) {
      if (line.trim()) header.push(line.trim());
      continue;
    }
    sectionMap.get(current)?.push(line);
  }

  const location =
    header
      .join(" ")
      .match(
        /(?:Loc:\s*)?([A-Za-z .'-]+,\s*[A-Z]{2}(?:\s+\d{5})?|[A-Za-z .'-]+,\s*[A-Za-z .'-]+)/,
      )?.[1] || "";

  const links: string[] = [];
  const linkMatches = text.matchAll(
    /(?:linkedin\.com\/[^\s|,]+|github\.com\/[^\s|,]+)/gi,
  );
  for (const m of linkMatches) links.push(m[0]);

  const summaryLines = (sectionMap.get("SUMMARY") || [])
    .map((l) => l.trim())
    .filter(Boolean);
  const skills = (sectionMap.get("SKILLS") || [])
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  const experience = parseRoleBlocks(sectionMap.get("EXPERIENCE") || []);
  const education = parseEducationBlocks(sectionMap.get("EDUCATION") || []);
  const projects = parseProjectBlocks(sectionMap.get("PROJECTS") || []);
  const certifications = (sectionMap.get("CERTIFICATIONS") || [])
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  return structuredResumeSchema.parse({
    name,
    email,
    phone,
    location,
    links,
    summary: summaryLines.join(" "),
    skills,
    experience,
    education,
    projects,
    certifications,
  });
}

function parseRoleBlocks(lines: string[]) {
  const jobs: StructuredResume["experience"] = [];
  let current: StructuredResume["experience"][number] | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-•*]/.test(line)) {
      current?.bullets.push(line.replace(/^[-•*]\s*/, ""));
      continue;
    }
    // Title — Company | Location | Dates  OR  Company — Title | Dates
    const parts = line.split(/\s*[|·]\s*/);
    const left = parts[0] || "";
    const rest = parts.slice(1);
    const dash = left.split(/\s+[—–-]\s+/);
    let title = left;
    let company = "";
    if (dash.length >= 2) {
      title = dash[0].trim();
      company = dash.slice(1).join(" — ").trim();
    }
    const dates =
      rest.find((p) => /\d{4}|present|current/i.test(p)) || rest[rest.length - 1] || "";
    const location =
      rest.find((p) => p !== dates && !/\d{4}|present/i.test(p)) || "";

    current = {
      title,
      company,
      location,
      dates,
      bullets: [],
    };
    jobs.push(current);
  }
  return jobs;
}

function parseEducationBlocks(lines: string[]) {
  const items: StructuredResume["education"] = [];
  let current: StructuredResume["education"][number] | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-•*]/.test(line)) {
      current?.details.push(line.replace(/^[-•*]\s*/, ""));
      continue;
    }
    const parts = line.split(/\s*[|·]\s*/);
    const left = parts[0] || "";
    const dash = left.split(/\s+[—–-]\s+/);
    current = {
      degree: dash[0]?.trim() || left,
      school: dash.slice(1).join(" — ").trim(),
      location: parts.find((p, i) => i > 0 && !/\d{4}/.test(p)) || "",
      dates: parts.find((p) => /\d{4}/.test(p)) || "",
      details: [],
    };
    items.push(current);
  }
  return items;
}

function parseProjectBlocks(lines: string[]) {
  const items: StructuredResume["projects"] = [];
  let current: StructuredResume["projects"][number] | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-•*]/.test(line)) {
      current?.bullets.push(line.replace(/^[-•*]\s*/, ""));
      continue;
    }
    const dash = line.split(/\s+[—–-]\s+/);
    current = {
      name: dash[0]?.trim() || line,
      tech: dash.slice(1).join(" — ").trim(),
      bullets: [],
    };
    items.push(current);
  }
  return items;
}
