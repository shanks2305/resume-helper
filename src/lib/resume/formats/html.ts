import type { StructuredResume } from "../structured";
import { escapeHtml, resolveStructured } from "./shared";

export const HTML_TEMPLATES = [
  {
    id: "serif",
    label: "Serif",
    description: "Times-like centered ATS page.",
  },
  {
    id: "sans",
    label: "Sans",
    description: "Clean Inter-style single column.",
  },
  {
    id: "sidebar",
    label: "Sidebar",
    description: "Navy rail for contact + skills.",
  },
  {
    id: "compact",
    label: "Compact",
    description: "Dense one-pager, small type.",
  },
  {
    id: "banner",
    label: "Banner",
    description: "Teal header band, print-friendly.",
  },
] as const;

export type HtmlTemplateId = (typeof HTML_TEMPLATES)[number]["id"];

function cssFor(id: HtmlTemplateId): string {
  const base = `
    * { box-sizing: border-box; }
    body { margin: 0; color: #1a1a1a; }
    h1,h2,h3 { margin: 0; font-weight: 650; }
    ul { margin: 0.2rem 0 0; padding-left: 1.1rem; }
    li { margin: 0.12rem 0; }
    .meta { color: #444; }
    .job { margin: 0.65rem 0 0; }
    .job-head { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  `;
  switch (id) {
    case "serif":
      return `${base}
        body { font: 11pt/1.35 "Iowan Old Style", "Palatino Linotype", Palatino, serif; padding: 0.65in; }
        h1 { text-align: center; font-size: 22pt; letter-spacing: 0.04em; }
        .meta { text-align: center; margin-top: 0.2rem; font-size: 10pt; }
        h2 { font-size: 11.5pt; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 1px solid #222; margin: 0.9rem 0 0.35rem; }
      `;
    case "sans":
      return `${base}
        body { font: 10.5pt/1.4 "Segoe UI", "Helvetica Neue", sans-serif; padding: 0.6in; max-width: 8.2in; margin: 0 auto; }
        h1 { font-size: 20pt; }
        .meta { margin-top: 0.25rem; font-size: 9.5pt; }
        h2 { font-size: 10.5pt; color: #0f4c5c; border-bottom: 1.5px solid #0f4c5c; margin: 0.85rem 0 0.35rem; }
      `;
    case "sidebar":
      return `${base}
        body { font: 10pt/1.4 "Segoe UI", sans-serif; display: flex; min-height: 11in; }
        aside { width: 2.4in; background: #16324f; color: #eef4fa; padding: 0.55in 0.35in; }
        aside h1 { font-size: 16pt; color: white; }
        aside a { color: #c5d8ee; }
        main { flex: 1; padding: 0.55in 0.5in; }
        h2 { font-size: 10.5pt; color: #16324f; letter-spacing: 0.08em; text-transform: uppercase; margin: 0.7rem 0 0.3rem; }
        .aside-label { margin-top: 1rem; font-size: 9pt; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.8; }
      `;
    case "compact":
      return `${base}
        body { font: 9.5pt/1.28 "Segoe UI", sans-serif; padding: 0.45in 0.5in; }
        h1 { font-size: 16pt; }
        .meta { font-size: 9pt; }
        h2 { font-size: 9.5pt; letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 0.8px solid #333; margin: 0.55rem 0 0.2rem; }
        li { margin: 0.06rem 0; }
      `;
    case "banner":
      return `${base}
        body { font: 10.5pt/1.38 "Segoe UI", sans-serif; }
        header { background: #0f4c5c; color: white; padding: 0.45in 0.65in 0.35in; }
        header h1 { font-size: 22pt; }
        header .meta { color: #d5ecef; margin-top: 0.2rem; }
        .wrap { padding: 0.4in 0.65in 0.65in; }
        h2 { font-size: 11pt; color: #0f4c5c; margin: 0.8rem 0 0.3rem; }
      `;
  }
}

function innerHtml(r: StructuredResume, id: HtmlTemplateId): string {
  const e = escapeHtml;
  const jobs = r.experience
    .map(
      (job) => `<article class="job">
      <div class="job-head"><strong>${e(job.title)}</strong> — ${e(job.company)}<span>${e(job.dates)}</span></div>
      ${job.location ? `<div class="meta">${e(job.location)}</div>` : ""}
      <ul>${job.bullets.map((b) => `<li>${e(b)}</li>`).join("")}</ul>
    </article>`,
    )
    .join("");
  const edu = r.education
    .map(
      (ed) => `<article class="job">
      <div class="job-head"><strong>${e(ed.degree)}</strong> — ${e(ed.school)}<span>${e(ed.dates)}</span></div>
      ${ed.details.length ? `<ul>${ed.details.map((d) => `<li>${e(d)}</li>`).join("")}</ul>` : ""}
    </article>`,
    )
    .join("");
  const projects = r.projects
    .map(
      (p) => `<article class="job"><strong>${e(p.name)}</strong>${p.tech ? ` — ${e(p.tech)}` : ""}
      <ul>${p.bullets.map((b) => `<li>${e(b)}</li>`).join("")}</ul></article>`,
    )
    .join("");

  if (id === "sidebar") {
    return `<aside>
      <h1>${e(r.name)}</h1>
      ${r.location ? `<p class="aside-label">Location</p><p>${e(r.location)}</p>` : ""}
      ${r.email ? `<p class="aside-label">Email</p><p>${e(r.email)}</p>` : ""}
      ${r.phone ? `<p class="aside-label">Phone</p><p>${e(r.phone)}</p>` : ""}
      ${r.links.map((l) => `<p><a href="${e(l)}">${e(l)}</a></p>`).join("")}
      ${r.skills.length ? `<p class="aside-label">Skills</p><ul>${r.skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>` : ""}
    </aside>
    <main>
      ${r.summary ? `<h2>Summary</h2><p>${e(r.summary)}</p>` : ""}
      ${jobs ? `<h2>Experience</h2>${jobs}` : ""}
      ${edu ? `<h2>Education</h2>${edu}` : ""}
      ${projects ? `<h2>Projects</h2>${projects}` : ""}
    </main>`;
  }

  const header = `<h1>${e(r.name)}</h1>
    <p class="meta">${e([r.email, r.phone, r.location, ...r.links].filter(Boolean).join(" · "))}</p>`;
  const body = `
    ${r.summary ? `<h2>Summary</h2><p>${e(r.summary)}</p>` : ""}
    ${r.skills.length ? `<h2>Skills</h2><p>${e(r.skills.join(" · "))}</p>` : ""}
    ${jobs ? `<h2>Experience</h2>${jobs}` : ""}
    ${edu ? `<h2>Education</h2>${edu}` : ""}
    ${projects ? `<h2>Projects</h2>${projects}` : ""}
    ${r.certifications.length ? `<h2>Certifications</h2><ul>${r.certifications.map((c) => `<li>${e(c)}</li>`).join("")}</ul>` : ""}
  `;

  if (id === "banner") {
    return `<header>${header}</header><div class="wrap">${body}</div>`;
  }
  return `${header}${body}`;
}

export function buildResumeHtml(
  rawOrStructured: string | StructuredResume,
  templateId: HtmlTemplateId = "sans",
): string {
  const r = resolveStructured(rawOrStructured);
  if (!r) {
    return "<!doctype html><title>Resume</title><p>Could not parse resume.</p>";
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(r.name)} — Resume</title>
  <style>${cssFor(templateId)}</style>
</head>
<body>
${innerHtml(r, templateId)}
</body>
</html>
`;
}
