import type { StructuredResume } from "../structured";
import { plainTextToStructured } from "../structured";

export type LatexTemplateId =
  | "deedy"
  | "sb2nov"
  | "modern"
  | "plushcv"
  | "harshibar";

export type LatexTemplate = {
  id: LatexTemplateId;
  label: string;
  description: string;
  /** Prefer pdflatex — all templates are self-contained. */
  engine: "pdflatex";
};

export const LATEX_TEMPLATES: LatexTemplate[] = [
  {
    id: "deedy",
    label: "Deedy",
    description: "Two-column (edu/skills | experience) — Deedy-inspired.",
    engine: "pdflatex",
  },
  {
    id: "sb2nov",
    label: "Jake / sb2nov",
    description: "Single-column classic ATS resume (Sourabh Bajaj).",
    engine: "pdflatex",
  },
  {
    id: "modern",
    label: "Modern macros",
    description: "Centered header + resumeHeading macros.",
    engine: "pdflatex",
  },
  {
    id: "plushcv",
    label: "PlushCV",
    description: "Wide experience column + side skills/education.",
    engine: "pdflatex",
  },
  {
    id: "harshibar",
    label: "Harshibar",
    description: "Sans-serif Jake style with icon contact line.",
    engine: "pdflatex",
  },
];

export function getLatexTemplate(id: LatexTemplateId): LatexTemplate {
  return LATEX_TEMPLATES.find((t) => t.id === id) ?? LATEX_TEMPLATES[1];
}

/** Escape LaTeX special characters in user content. */
export function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[{}]/g, (c) => `\\${c}`)
    .replace(/\$/g, "\\$")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function resolve(
  rawOrStructured: string | StructuredResume,
): StructuredResume | null {
  if (typeof rawOrStructured !== "string") return rawOrStructured;
  return plainTextToStructured(rawOrStructured);
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function linkOf(r: StructuredResume, kind: "github" | "linkedin" | "web"): string {
  for (const link of r.links) {
    const lower = link.toLowerCase();
    if (kind === "github" && lower.includes("github.com")) return link;
    if (kind === "linkedin" && lower.includes("linkedin.com")) return link;
    if (kind === "web" && !lower.includes("github") && !lower.includes("linkedin"))
      return link;
  }
  return "";
}

function githubUser(r: StructuredResume): string {
  const url = linkOf(r, "github");
  const m = url.match(/github\.com\/([^/\s]+)/i);
  return m?.[1] || "";
}

function linkedInUser(r: StructuredResume): string {
  const url = linkOf(r, "linkedin");
  const m = url.match(/linkedin\.com\/in\/([^/\s]+)/i);
  return m?.[1] || "";
}

function bullets(items: string[]): string {
  if (!items.length) return "";
  return [
    "\\begin{itemize}[leftmargin=*,itemsep=1pt,parsep=0pt,topsep=2pt]",
    ...items.map((b) => `  \\item ${escapeLatex(b)}`),
    "\\end{itemize}",
  ].join("\n");
}

function skillBullets(skills: string[]): string {
  if (!skills.length) return "";
  return escapeLatex(skills.join(" $\\bullet$ "));
}

const SHARED_PACKAGES = `\\usepackage[margin=0.5in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{xcolor}
\\pagestyle{empty}
\\urlstyle{same}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\setlist[itemize]{leftmargin=*,itemsep=1pt,parsep=0pt,topsep=2pt,partopsep=0pt}
`;

/** Sourabh Bajaj / Jake resume — closest to your template #2. */
function buildSb2nov(r: StructuredResume): string {
  const name = escapeLatex(r.name);
  const email = escapeLatex(r.email);
  const phone = escapeLatex(r.phone);
  const webRaw = linkOf(r, "web") || linkOf(r, "linkedin") || linkOf(r, "github");
  const webDisplay = escapeLatex(webRaw);
  const webHref = webRaw.replace(/^https?:\/\//i, "");

  const education = r.education
    .map((ed) => {
      return `    \\resumeSubheading
      {${escapeLatex(ed.school)}}{${escapeLatex(ed.location)}}
      {${escapeLatex(ed.degree)}${ed.details[0] ? `; ${escapeLatex(ed.details[0])}` : ""}}{${escapeLatex(ed.dates)}}`;
    })
    .join("\n");

  const experience = r.experience
    .map((job) => {
      const items = job.bullets
        .map((b) => `        \\item{\\small ${escapeLatex(b)} \\vspace{-2pt}}`)
        .join("\n");
      return `    \\resumeSubheading
      {${escapeLatex(job.company)}}{${escapeLatex(job.location)}}
      {${escapeLatex(job.title)}}{${escapeLatex(job.dates)}}
      \\resumeItemListStart
${items}
      \\resumeItemListEnd`;
    })
    .join("\n\n");

  const projects = r.projects
    .map((p) => {
      const desc =
        p.bullets[0] ||
        (p.tech ? p.tech : "");
      return `    \\resumeSubItem{${escapeLatex(p.name)}}
      {${escapeLatex(desc)}}`;
    })
    .join("\n");

  const skillsLine = r.skills.length
    ? `   \\item{
     \\textbf{Skills}{: ${escapeLatex(r.skills.join(", "))}}
   }`
    : "";

  return `%-------------------------
% Resume in Latex (sb2nov / Jake style)
% Filled by FitCheck from JD + source resume
%------------------------
\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.375in}
\\addtolength{\\evensidemargin}{-0.375in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\newcommand{\\resumeItem}[2]{
  \\item\\small{
    \\textbf{#1}{: #2 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}

\\newcommand{\\resumeSubItem}[2]{\\resumeItem{#1}{#2}\\vspace{-4pt}}

\\renewcommand{\\labelitemii}{$\\circ$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=*]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

\\begin{tabular*}{\\textwidth}{l@{\\extracolsep{\\fill}}r}
  \\textbf{\\Large ${name}} & Email : ${
    email ? `\\href{mailto:${email}}{${email}}` : ""
  }\\\\
  ${
    webHref
      ? `\\href{https://${escapeLatex(webHref)}}{${webDisplay}}`
      : ""
  } & Mobile : ${phone} \\\\
\\end{tabular*}

${
  r.summary
    ? `\\section{Summary}
{\\small ${escapeLatex(r.summary)}}
`
    : ""
}
${
  r.education.length
    ? `\\section{Education}
  \\resumeSubHeadingListStart
${education}
  \\resumeSubHeadingListEnd
`
    : ""
}
${
  r.experience.length
    ? `\\section{Experience}
  \\resumeSubHeadingListStart
${experience}
  \\resumeSubHeadingListEnd
`
    : ""
}
${
  r.projects.length
    ? `\\section{Projects}
  \\resumeSubHeadingListStart
${projects}
  \\resumeSubHeadingListEnd
`
    : ""
}
${
  r.skills.length
    ? `\\section{Skills}
 \\resumeSubHeadingListStart
${skillsLine}
 \\resumeSubHeadingListEnd
`
    : ""
}
${
  r.certifications.length
    ? `\\section{Certifications}
{\\small ${escapeLatex(r.certifications.join(" $\\bullet$ "))}}
`
    : ""
}
\\end{document}
`;
}

/** Deedy-inspired two-column (self-contained, no custom .cls). */
function buildDeedy(r: StructuredResume): string {
  const { first, last } = splitName(r.name);
  const email = escapeLatex(r.email);
  const phone = escapeLatex(r.phone);
  const gh = githubUser(r);
  const li = linkedInUser(r);
  const web = linkOf(r, "web");

  const edu = r.education
    .map(
      (ed) => `\\textbf{\\large ${escapeLatex(ed.school)}}\\\\
{\\itshape ${escapeLatex(ed.degree)}}\\\\
{\\footnotesize ${escapeLatex([ed.dates, ed.location].filter(Boolean).join(" | "))}}\\\\
${ed.details.map((d) => escapeLatex(d) + "\\\\").join("\n")}
\\vspace{6pt}
`,
    )
    .join("\n");

  const links = [
    gh ? `Github:// \\href{https://github.com/${escapeLatex(gh)}}{\\textbf{${escapeLatex(gh)}}}\\\\` : "",
    li
      ? `LinkedIn:// \\href{https://www.linkedin.com/in/${escapeLatex(li)}}{\\textbf{${escapeLatex(li)}}}\\\\`
      : "",
    web
      ? `Web:// \\href{${web.startsWith("http") ? web : `https://${web}`}}{\\textbf{${escapeLatex(web)}}}\\\\`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const skills = r.skills.length
    ? `{\\footnotesize ${skillBullets(r.skills)}}`
    : "";

  const experience = r.experience
    .map((job) => {
      return `\\textbf{\\large ${escapeLatex(job.company)}} {\\itshape| ${escapeLatex(job.title)}}\\\\
{\\footnotesize ${escapeLatex([job.dates, job.location].filter(Boolean).join(" | "))}}
${bullets(job.bullets)}
\\vspace{4pt}
`;
    })
    .join("\n");

  const projects = r.projects
    .map((p) => {
      return `\\textbf{\\large ${escapeLatex(p.name)}} ${
        p.tech ? `{\\itshape| ${escapeLatex(p.tech)}}` : ""
      }\\\\
${bullets(p.bullets.length ? p.bullets : p.tech ? [] : [])}
\\vspace{4pt}
`;
    })
    .join("\n");

  const contactBits = [
    web
      ? `\\href{${web.startsWith("http") ? web : `https://${web}`}}{${escapeLatex(web)}}`
      : "",
    email ? `\\href{mailto:${email}}{${email}}` : "",
    phone,
  ]
    .filter(Boolean)
    .join(" $|$ ");

  return `% Deedy-inspired two-column resume (self-contained)
% Original: Debarghya Das — adapted for FitCheck / pdflatex
\\documentclass[letterpaper,10pt]{article}
${SHARED_PACKAGES}
\\usepackage{multicol}

\\titleformat{\\section}{\\vspace{-2pt}\\scshape\\bfseries\\large\\raggedright}{}{0em}{}[\\titlerule\\vspace{3pt}]
\\titlespacing*{\\section}{0pt}{6pt}{4pt}

\\begin{document}

\\begin{center}
  {\\Huge\\bfseries ${escapeLatex(first)}${last ? ` ${escapeLatex(last)}` : ""}}\\\\[4pt]
  {\\small ${contactBits}}
\\end{center}
\\vspace{4pt}

\\begin{minipage}[t]{0.32\\textwidth}
\\section*{Education}
${edu || "{\\footnotesize ---}"}

${links ? `\\section*{Links}\n{\\footnotesize ${links}}` : ""}

\\section*{Skills}
${skills || "{\\footnotesize ---}"}
\\end{minipage}
\\hfill
\\begin{minipage}[t]{0.64\\textwidth}
${r.summary ? `\\section*{Summary}\n{\\small ${escapeLatex(r.summary)}}\\vspace{4pt}\n` : ""}
\\section*{Experience}
${experience || "{\\footnotesize ---}"}
${r.projects.length ? `\\section*{Projects}\n${projects}` : ""}
${
  r.certifications.length
    ? `\\section*{Certifications}\n{\\footnotesize ${escapeLatex(r.certifications.join(" $\\bullet$ "))}}`
    : ""
}
\\end{minipage}

\\end{document}
`;
}

/** Modern macros template (your #3), self-contained. */
function buildModern(r: StructuredResume): string {
  const name = escapeLatex(r.name);
  const email = escapeLatex(r.email);
  const phone = escapeLatex(r.phone);
  const gh = githubUser(r);
  const li = linkedInUser(r);

  const contact = [
    email ? `\\href{mailto:${email}}{\\underline{${email}}}` : "",
    phone ? escapeLatex(r.phone) : "",
    li
      ? `\\href{https://www.linkedin.com/in/${escapeLatex(li)}}{\\underline{linkedin/${escapeLatex(li)}}}`
      : "",
    gh
      ? `\\href{https://github.com/${escapeLatex(gh)}}{\\underline{github/${escapeLatex(gh)}}}`
      : "",
  ]
    .filter(Boolean)
    .join(" $|$ ");

  const education = r.education
    .map((ed) => {
      return `\\textbf{${escapeLatex(ed.degree)}}\\hfill {\\footnotesize ${escapeLatex(
        [ed.location, ed.dates].filter(Boolean).join(" | "),
      )}}\\\\
{\\itshape ${escapeLatex(ed.school)}}\\\\[4pt]
`;
    })
    .join("\n");

  const experience = r.experience
    .map((job) => {
      return `\\textbf{\\uppercase{${escapeLatex(job.company)}}} {\\itshape| ${escapeLatex(
        job.title,
      )}}\\hfill {\\footnotesize ${escapeLatex(
        [job.location, job.dates].filter(Boolean).join(" | "),
      )}}\\\\
${bullets(job.bullets)}
\\vspace{4pt}
`;
    })
    .join("\n");

  const projects = r.projects
    .map((p) => {
      return `\\textbf{${escapeLatex(p.name)}}${
        p.tech ? ` {\\itshape| ${escapeLatex(p.tech)}}` : ""
      }\\\\
${
        p.bullets.length
          ? bullets(p.bullets)
          : `{\\small ${escapeLatex(p.tech)}}\\\\`
      }
\\vspace{4pt}
`;
    })
    .join("\n");

  return `% Modern resume macros (self-contained) — FitCheck
\\documentclass[letterpaper,10pt]{article}
${SHARED_PACKAGES}

\\titleformat{\\section}{\\vspace{-2pt}\\scshape\\bfseries\\large\\raggedright}{}{0em}{}[\\titlerule\\vspace{3pt}]
\\titlespacing*{\\section}{0pt}{8pt}{4pt}

\\begin{document}

\\begin{center}
  {\\Huge\\scshape ${name}} \\\\[3pt]
  {\\small ${contact}}
\\end{center}

${r.summary ? `\\section*{Summary}\n{\\small ${escapeLatex(r.summary)}}\n` : ""}

\\section*{Education}
${education || "{\\footnotesize ---}"}

\\section*{Work Experience}
${experience || "{\\footnotesize ---}"}

${r.projects.length ? `\\section*{Projects}\n${projects}` : ""}

\\section*{Skills}
{\\small \\textbf{Skills:} ${escapeLatex(r.skills.join(", "))}}

${
  r.certifications.length
    ? `\\section*{Certifications}\n{\\small ${escapeLatex(r.certifications.join(", "))}}`
    : ""
}

\\end{document}
`;
}

/** PlushCV-inspired: wide left experience, narrow right skills/edu. */
function buildPlushcv(r: StructuredResume): string {
  const { first, last } = splitName(r.name);
  const email = escapeLatex(r.email);
  const phone = escapeLatex(r.phone);
  const gh = githubUser(r);
  const li = linkedInUser(r);
  const web = linkOf(r, "web");
  const titleGuess =
    r.experience[0]?.title ||
    r.summary.split(/[.,]/)[0]?.trim().slice(0, 48) ||
    "Software Engineer";

  const contact = [
    web
      ? `\\href{${web.startsWith("http") ? web : `https://${web}`}}{${escapeLatex(web)}}`
      : "",
    gh ? `\\href{https://github.com/${escapeLatex(gh)}}{${escapeLatex(gh)}}` : "",
    li
      ? `\\href{https://www.linkedin.com/in/${escapeLatex(li)}}{${escapeLatex(li)}}`
      : "",
    email ? `\\href{mailto:${email}}{${email}}` : "",
    phone,
  ]
    .filter(Boolean)
    .join(" $|$ ");

  const experience = r.experience
    .map((job) => {
      return `\\textbf{\\large ${escapeLatex(job.company)}} {\\itshape| ${escapeLatex(job.title)}}\\\\
{\\footnotesize ${escapeLatex([job.dates, job.location].filter(Boolean).join(" | "))}}
${bullets(job.bullets)}
\\vspace{6pt}
`;
    })
    .join("\n");

  const projects = r.projects
    .map((p) => {
      return `\\textbf{\\large ${escapeLatex(p.name)}} ${
        p.tech ? `{\\itshape| ${escapeLatex(p.tech)}}` : ""
      }\\\\
${bullets(p.bullets)}
\\vspace{4pt}
`;
    })
    .join("\n");

  const edu = r.education
    .map(
      (ed) => `\\textbf{${escapeLatex(ed.school)}}\\\\
{\\itshape ${escapeLatex(ed.degree)}}\\\\
{\\footnotesize ${escapeLatex([ed.dates, ed.location].filter(Boolean).join(" | "))}}\\\\[6pt]
`,
    )
    .join("\n");

  return `% PlushCV-inspired two-column resume (self-contained)
% Original: Shubham Mazumder / Deedy-inspired — adapted for FitCheck
\\documentclass[letterpaper,10pt]{article}
${SHARED_PACKAGES}

\\titleformat{\\section}{\\vspace{-2pt}\\scshape\\bfseries\\large\\raggedright}{}{0em}{}[\\titlerule\\vspace{3pt}]
\\titlespacing*{\\section}{0pt}{6pt}{4pt}

\\begin{document}

\\begin{center}
  {\\Huge\\bfseries ${escapeLatex(first)}${last ? ` ${escapeLatex(last)}` : ""}}\\\\[2pt]
  {\\large\\itshape ${escapeLatex(titleGuess)}}\\\\[3pt]
  {\\small ${contact}}
\\end{center}
\\vspace{4pt}

\\begin{minipage}[t]{0.68\\textwidth}
\\section*{Experience}
${experience || "{\\footnotesize ---}"}
${r.projects.length ? `\\section*{Projects}\n${projects}` : ""}
\\end{minipage}
\\hfill
\\begin{minipage}[t]{0.28\\textwidth}
\\section*{Skills}
{\\footnotesize ${skillBullets(r.skills) || "---"}}
\\vspace{8pt}

\\section*{Education}
{\\footnotesize ${edu || "---"}}
${
  r.certifications.length
    ? `\\vspace{8pt}\\section*{Certifications}\n{\\footnotesize ${escapeLatex(r.certifications.join(" $\\bullet$ "))}}`
    : ""
}
\\end{minipage}

\\end{document}
`;
}

/**
 * Harshibar / Jake-Yang style — sans-serif, icon contact, grey rules.
 * Based on https://github.com/jakeryang/resume (Harshibar variant).
 * Packages: fontawesome5 + tgheros when available; still pdflatex-friendly.
 */
function buildHarshibar(r: StructuredResume): string {
  const name = escapeLatex(r.name);
  const email = escapeLatex(r.email);
  const phone = escapeLatex(r.phone);
  const location = escapeLatex(r.location);
  const gh = githubUser(r);
  const li = linkedInUser(r);

  const contactParts: string[] = [];
  if (phone) {
    contactParts.push(
      `\\faPhone* \\texttt{${phone}}`,
    );
  }
  if (email) {
    contactParts.push(
      `\\faEnvelope \\hspace{2pt} \\href{mailto:${email}}{\\texttt{${email}}}`,
    );
  }
  if (location) {
    contactParts.push(
      `\\faMapMarker* \\hspace{2pt}\\texttt{${location}}`,
    );
  }
  if (li) {
    contactParts.push(
      `\\faLinkedin \\hspace{2pt}\\href{https://www.linkedin.com/in/${escapeLatex(li)}}{\\texttt{${escapeLatex(li)}}}`,
    );
  }
  if (gh) {
    contactParts.push(
      `\\faGithub \\hspace{2pt}\\href{https://github.com/${escapeLatex(gh)}}{\\texttt{${escapeLatex(gh)}}}`,
    );
  }
  const contactLine = contactParts
    .map((p) => `\\hspace{1pt} ${p} \\hspace{1pt}`)
    .join(" $|$\n    ");

  const experience = r.experience
    .map((job) => {
      const items = job.bullets
        .map(
          (b) =>
            `        \\resumeItem{${escapeLatex(b)}}`,
        )
        .join("\n");
      return `    \\resumeSubheading
      {${escapeLatex(job.company)}}{${escapeLatex(job.dates)}}
      {${escapeLatex(job.title)}}{${escapeLatex(job.location)}}
      \\resumeItemListStart
${items}
      \\resumeItemListEnd`;
    })
    .join("\n\n");

  const projects = r.projects
    .map((p) => {
      const heading = p.tech
        ? `{\\textbf{${escapeLatex(p.name)}} $|$ \\emph{${escapeLatex(p.tech)}}}`
        : `{\\textbf{${escapeLatex(p.name)}}}`;
      const items = (p.bullets.length ? p.bullets : [])
        .map((b) => `        \\resumeItem{${escapeLatex(b)}}`)
        .join("\n");
      return `\\resumeProjectHeading
${heading}{}
\\resumeItemListStart
${items || `        \\resumeItem{${escapeLatex(p.tech || p.name)}}`}
\\resumeItemListEnd`;
    })
    .join("\n\n");

  const education = r.education
    .map((ed) => {
      const degreeLine = [
        escapeLatex(ed.degree),
        ed.details[0] ? escapeLatex(ed.details[0]) : "",
      ]
        .filter(Boolean)
        .join(" \\hfill ");
      return `\\resumeSubheading
  {${escapeLatex(ed.school)}}{${escapeLatex(ed.dates)}}
  {${degreeLine}}{${escapeLatex(ed.location)}}`;
    })
    .join("\n");

  // Prefer categorized look: single Skills block (extend later with skillGroups)
  const skillsBlock = r.skills.length
    ? ` \\begin{itemize}[leftmargin=0in, label={}]
\\small{\\item{
 \\textbf{Skills} {: ${escapeLatex(r.skills.join(", "))}}
}}
 \\end{itemize}`
    : "";

  return `%-------------------------
% Resume in Latex (Harshibar / Jake style)
% Based on: https://github.com/jakeryang/resume
% Filled by FitCheck from JD + source resume
%------------------------
\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{fontawesome5}

\\definecolor{light-grey}{gray}{0.83}
\\definecolor{dark-grey}{gray}{0.3}
\\definecolor{text-grey}{gray}{.08}

\\usepackage{tgheros}
\\renewcommand*\\familydefault{\\sfdefault}
\\usepackage[T1]{fontenc}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{0in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
    \\bfseries \\vspace{2pt} \\raggedright \\large
}{}{0em}{}[\\color{light-grey} {\\titlerule[2pt]} \\vspace{-4pt}]

\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-1pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & {\\color{dark-grey}\\small #2}\\vspace{1pt}\\\\
      \\textit{#3} & {\\color{dark-grey} \\small #4}\\\\
    \\end{tabular*}\\vspace{-4pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{\\textwidth}{l@{\\extracolsep{\\fill}}r}
      #1 & {\\color{dark-grey}#2} \\\\
    \\end{tabular*}\\vspace{-4pt}
}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-6pt}}

\\color{text-grey}

\\begin{document}

\\begin{center}
    \\textbf{\\Huge ${name}} \\\\ \\vspace{5pt}
    \\small ${contactLine}
    \\\\ \\vspace{-6pt}
\\end{center}

${
  r.summary
    ? `\\vspace{6pt}
\\small{${escapeLatex(r.summary)}}
`
    : ""
}

${
  r.experience.length
    ? `\\section{EXPERIENCE}
  \\resumeSubHeadingListStart
${experience}
  \\resumeSubHeadingListEnd
`
    : ""
}

${
  r.projects.length
    ? `\\section{PROJECTS}
    \\resumeSubHeadingListStart
${projects}
    \\resumeSubHeadingListEnd
`
    : ""
}

${
  r.education.length
    ? `\\section{EDUCATION}
\\resumeSubHeadingListStart
${education}
\\resumeSubHeadingListEnd
`
    : ""
}

${
  r.skills.length
    ? `\\section{SKILLS}
${skillsBlock}
`
    : ""
}

${
  r.certifications.length
    ? `\\section{CERTIFICATIONS}
{\\small ${escapeLatex(r.certifications.join(", "))}}
`
    : ""
}

\\end{document}
`;
}

export function buildResumeLatex(
  rawOrStructured: string | StructuredResume,
  templateId: LatexTemplateId,
): string {
  const structured = resolve(rawOrStructured);
  if (!structured) {
    const raw =
      typeof rawOrStructured === "string"
        ? rawOrStructured
        : JSON.stringify(rawOrStructured);
    return `% Could not parse structured resume — wrap as verbatim notes
\\documentclass{article}
\\usepackage[margin=1in]{geometry}
\\begin{document}
\\begin{verbatim}
${raw.slice(0, 12000)}
\\end{verbatim}
\\end{document}
`;
  }

  switch (templateId) {
    case "deedy":
      return buildDeedy(structured);
    case "modern":
      return buildModern(structured);
    case "plushcv":
      return buildPlushcv(structured);
    case "harshibar":
      return buildHarshibar(structured);
    case "sb2nov":
    default:
      return buildSb2nov(structured);
  }
}
