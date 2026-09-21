import type { StructuredResume } from "../structured";
import { contactLine, escapeTypst, resolveStructured } from "./shared";

export const TYPST_TEMPLATES = [
  {
    id: "classic",
    label: "Classic",
    description: "Serif letter, centered header.",
  },
  {
    id: "jake",
    label: "Jake",
    description: "Single-column dense tech resume.",
  },
  {
    id: "engineering",
    label: "Engineering",
    description: "Tight rules, small caps sections.",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Accent header bar + sans body.",
  },
  {
    id: "sidebar",
    label: "Sidebar",
    description: "Two-column skills rail + experience.",
  },
] as const;

export type TypstTemplateId = (typeof TYPST_TEMPLATES)[number]["id"];

function section(title: string, body: string) {
  if (!body.trim()) return "";
  return `== ${title}\n${body}\n`;
}

function contentBlocks(r: StructuredResume): string {
  const e = escapeTypst;
  const summary = r.summary ? `${e(r.summary)}\n` : "";
  const skills = r.skills.length
    ? r.skills.map((s) => e(s)).join(" · ") + "\n"
    : "";
  const experience = r.experience
    .map((job) => {
      const head = `*${e(job.title)}* — ${e(job.company)}`
        + (job.location ? ` | ${e(job.location)}` : "")
        + (job.dates ? ` | ${e(job.dates)}` : "");
      const bullets = job.bullets.map((b) => `- ${e(b)}`).join("\n");
      return `${head}\n${bullets}`;
    })
    .join("\n\n");
  const education = r.education
    .map((ed) => {
      const head = `*${e(ed.degree)}* — ${e(ed.school)}`
        + (ed.location ? ` | ${e(ed.location)}` : "")
        + (ed.dates ? ` | ${e(ed.dates)}` : "");
      const details = ed.details.map((d) => `- ${e(d)}`).join("\n");
      return details ? `${head}\n${details}` : head;
    })
    .join("\n\n");
  const projects = r.projects
    .map((p) => {
      const head = p.tech ? `*${e(p.name)}* — ${e(p.tech)}` : `*${e(p.name)}*`;
      return `${head}\n${p.bullets.map((b) => `- ${e(b)}`).join("\n")}`;
    })
    .join("\n\n");
  const certs = r.certifications.map((c) => `- ${e(c)}`).join("\n");

  return [
    summary && section("Summary", summary),
    skills && section("Skills", skills),
    experience && section("Experience", experience),
    education && section("Education", education),
    projects && section("Projects", projects),
    certs && section("Certifications", certs),
  ]
    .filter(Boolean)
    .join("\n");
}

function prelude(id: TypstTemplateId): string {
  switch (id) {
    case "classic":
      return `#set page(paper: "us-letter", margin: 0.65in)
#set text(font: "Libertinus Serif", size: 10.5pt)
#set par(leading: 0.45em)
#show heading.where(level: 1): set align(center)
#show heading.where(level: 2): it => {
  v(6pt)
  text(size: 11pt, weight: "bold", tracking: 0.8pt, upper(it.body))
  v(2pt)
  line(length: 100%, stroke: 0.6pt)
  v(4pt)
}
`;
    case "jake":
      return `#set page(paper: "us-letter", margin: (x: 0.5in, y: 0.45in))
#set text(font: "New Computer Modern", size: 10pt)
#set par(leading: 0.38em)
#show heading.where(level: 1): set align(center)
#show heading.where(level: 2): it => {
  v(5pt)
  text(size: 10.5pt, weight: "bold", it.body)
  v(1pt)
  line(length: 100%, stroke: 0.45pt)
  v(3pt)
}
`;
    case "engineering":
      return `#set page(paper: "us-letter", margin: 0.5in)
#set text(font: "TeX Gyre Heros", size: 9.5pt)
#set par(leading: 0.36em)
#show heading.where(level: 1): set align(center)
#show heading.where(level: 2): it => {
  v(4pt)
  text(size: 9pt, weight: "bold", tracking: 1.4pt, upper(it.body))
  v(1pt)
  line(length: 100%, stroke: 0.8pt + rgb("#1f2933"))
  v(3pt)
}
`;
    case "modern":
      return `#set page(paper: "us-letter", margin: (x: 0.55in, y: 0.5in))
#set text(font: "Liberation Sans", size: 10pt)
#set par(leading: 0.42em)
#show heading.where(level: 1): it => block(
  fill: rgb("#0f4c5c"),
  width: 100%,
  inset: 10pt,
  text(fill: white, size: 18pt, it.body),
)
#show heading.where(level: 2): it => {
  v(8pt)
  text(fill: rgb("#0f4c5c"), size: 11pt, weight: "bold", it.body)
  v(3pt)
}
`;
    case "sidebar":
      return `#set page(paper: "us-letter", margin: 0.45in)
#set text(font: "Liberation Sans", size: 9.8pt)
#set par(leading: 0.4em)
#show heading.where(level: 2): it => {
  v(4pt)
  text(size: 10pt, weight: "bold", fill: rgb("#16324f"), it.body)
  v(2pt)
}
`;
  }
}

export function buildResumeTypst(
  rawOrStructured: string | StructuredResume,
  templateId: TypstTemplateId = "jake",
): string {
  const r = resolveStructured(rawOrStructured);
  if (!r) {
    return `#set page(paper: "us-letter")\n= Resume\nCould not parse structured resume.\n`;
  }
  const e = escapeTypst;
  const contact = e(contactLine(r));
  const body = contentBlocks(r);

  if (templateId === "sidebar") {
    const side = [
      r.location && `*Location*\n${e(r.location)}`,
      r.email && `*Email*\n${e(r.email)}`,
      r.phone && `*Phone*\n${e(r.phone)}`,
      r.skills.length && `*Skills*\n${r.skills.map((s) => `- ${e(s)}`).join("\n")}`,
      r.education.length &&
        `*Education*\n${r.education.map((ed) => `${e(ed.degree)} — ${e(ed.school)}`).join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const main = [
      r.summary && `== Summary\n${e(r.summary)}`,
      ...r.experience.map((job) => {
        return `== ${e(job.title)}\n*${e(job.company)}* ${e(job.dates)}\n${job.bullets.map((b) => `- ${e(b)}`).join("\n")}`;
      }),
    ]
      .filter(Boolean)
      .join("\n\n");
    return `${prelude("sidebar")}
= ${e(r.name)}
#grid(columns: (0.32fr, 0.68fr), gutter: 16pt, [
${side}
], [
${main}
])
`;
  }

  return `${prelude(templateId)}
= ${e(r.name)}
#align(center)[${contact}]

${body}
`;
}
