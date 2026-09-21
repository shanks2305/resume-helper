import type { StructuredResume } from "../structured";
import { contactLine, escapeHtml, resolveStructured } from "./shared";

export const MARKDOWN_TEMPLATES = [
  {
    id: "classic",
    label: "Classic",
    description: "ATX headings — pandoc to PDF/DOCX.",
  },
  {
    id: "compact",
    label: "Compact",
    description: "Tight spacing, YAML geometry for one page.",
  },
  {
    id: "academic",
    label: "Academic",
    description: "Education first, reference-letter style.",
  },
  {
    id: "skills-table",
    label: "Skills table",
    description: "Pandoc pipe table for skills.",
  },
  {
    id: "html-div",
    label: "Pandoc HTML",
    description: "Raw HTML blocks for two-column HTML/PDF.",
  },
] as const;

export type MarkdownTemplateId = (typeof MARKDOWN_TEMPLATES)[number]["id"];

function yamlFrontMatter(r: StructuredResume, extra: Record<string, string>) {
  const lines = [
    "---",
    `title: ${JSON.stringify(r.name)}`,
    `author: ${JSON.stringify(r.name)}`,
    "geometry: margin=0.6in",
    "fontsize: 11pt",
    "colorlinks: true",
    ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`),
    "---",
    "",
  ];
  return lines.join("\n");
}

function bullets(items: string[]) {
  return items.map((b) => `- ${b}`).join("\n");
}

function experienceMd(r: StructuredResume) {
  return r.experience
    .map((job) => {
      const line = `**${job.title}** — ${job.company}${job.location ? ` | ${job.location}` : ""} | ${job.dates}`;
      return `${line}\n\n${bullets(job.bullets)}`;
    })
    .join("\n\n");
}

function educationMd(r: StructuredResume) {
  return r.education
    .map((ed) => {
      const line = `**${ed.degree}** — ${ed.school}${ed.location ? ` | ${ed.location}` : ""} | ${ed.dates}`;
      const extra = ed.details.length ? `\n\n${bullets(ed.details)}` : "";
      return line + extra;
    })
    .join("\n\n");
}

export function buildResumeMarkdown(
  rawOrStructured: string | StructuredResume,
  templateId: MarkdownTemplateId = "classic",
): string {
  const r = resolveStructured(rawOrStructured);
  if (!r) return "";

  if (templateId === "compact") {
    return (
      yamlFrontMatter(r, { fontsize: "10pt", "linestretch": "1.05" }) +
      `# ${r.name}\n\n${contactLine(r)}\n\n` +
      (r.summary ? `${r.summary}\n\n` : "") +
      (r.skills.length ? `**Skills:** ${r.skills.join(" · ")}\n\n` : "") +
      (r.experience.length
        ? `## Experience\n\n${experienceMd(r)}\n\n`
        : "") +
      (r.education.length ? `## Education\n\n${educationMd(r)}\n` : "")
    );
  }

  if (templateId === "academic") {
    return (
      yamlFrontMatter(r, { documentclass: "article" }) +
      `# ${r.name}\n\n${contactLine(r)}\n\n` +
      (r.education.length ? `## Education\n\n${educationMd(r)}\n\n` : "") +
      (r.summary ? `## Research / profile\n\n${r.summary}\n\n` : "") +
      (r.experience.length ? `## Appointments\n\n${experienceMd(r)}\n\n` : "") +
      (r.skills.length ? `## Methods & skills\n\n${bullets(r.skills)}\n` : "")
    );
  }

  if (templateId === "skills-table") {
    const rows = r.skills.map((s, i) => `| ${i + 1} | ${s.replace(/\|/g, "\\|")} |`).join("\n");
    return (
      yamlFrontMatter(r, {}) +
      `# ${r.name}\n\n${contactLine(r)}\n\n` +
      (r.summary ? `## Summary\n\n${r.summary}\n\n` : "") +
      (r.skills.length
        ? `## Skills\n\n| # | Skill |\n| --- | --- |\n${rows}\n\n`
        : "") +
      (r.experience.length ? `## Experience\n\n${experienceMd(r)}\n\n` : "") +
      (r.education.length ? `## Education\n\n${educationMd(r)}\n` : "")
    );
  }

  if (templateId === "html-div") {
    const e = escapeHtml;
    const side = [
      r.location && `<p><strong>Location</strong><br>${e(r.location)}</p>`,
      r.email && `<p><strong>Email</strong><br>${e(r.email)}</p>`,
      r.phone && `<p><strong>Phone</strong><br>${e(r.phone)}</p>`,
      r.skills.length &&
        `<p><strong>Skills</strong></p><ul>${r.skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`,
    ]
      .filter(Boolean)
      .join("\n");
    return (
      yamlFrontMatter(r, { html_math_method: "mathjax" }) +
      `<div style="display:flex;gap:24px">
<div style="width:30%">${side}</div>
<div style="width:70%">
<h1>${e(r.name)}</h1>
${r.summary ? `<p>${e(r.summary)}</p>` : ""}
${r.experience
  .map(
    (job) =>
      `<p><strong>${e(job.title)}</strong> — ${e(job.company)} | ${e(job.dates)}</p><ul>${job.bullets.map((b) => `<li>${e(b)}</li>`).join("")}</ul>`,
  )
  .join("\n")}
</div>
</div>
`
    );
  }

  return (
    yamlFrontMatter(r, {}) +
    `# ${r.name}\n\n*${contactLine(r)}*\n\n` +
    (r.summary ? `## Summary\n\n${r.summary}\n\n` : "") +
    (r.skills.length ? `## Skills\n\n${r.skills.join(" · ")}\n\n` : "") +
    (r.experience.length ? `## Experience\n\n${experienceMd(r)}\n\n` : "") +
    (r.education.length ? `## Education\n\n${educationMd(r)}\n\n` : "") +
    (r.projects.length
      ? `## Projects\n\n${r.projects
          .map(
            (p) =>
              `**${p.name}**${p.tech ? ` — ${p.tech}` : ""}\n\n${bullets(p.bullets)}`,
          )
          .join("\n\n")}\n\n`
      : "") +
    (r.certifications.length
      ? `## Certifications\n\n${bullets(r.certifications)}\n`
      : "")
  );
}
