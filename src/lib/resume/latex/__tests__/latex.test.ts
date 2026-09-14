import { describe, expect, it } from "vitest";
import { plainTextToStructured } from "../../structured";
import {
  buildResumeLatex,
  escapeLatex,
  LATEX_TEMPLATES,
} from "../templates";

const SAMPLE = `Alex Chen
Email: alex@email.com · Ph: (555) 010-2040 · Loc: San Francisco, CA

SUMMARY
Software engineer with 5 years building APIs and React apps.

SKILLS
- TypeScript
- React
- Node.js

EXPERIENCE
Software Engineer — Acme Corp | San Francisco, CA | 2021–Present
- Built REST APIs serving 2M requests/day
- Led migration to TypeScript

EDUCATION
B.S. Computer Science — State University | 2019`;

const STRUCTURED = plainTextToStructured(SAMPLE)!;

describe("escapeLatex", () => {
  it("escapes special characters", () => {
    expect(escapeLatex("100% done_now")).toContain("\\%");
    expect(escapeLatex("100% done_now")).toContain("\\_");
  });
});

describe("buildResumeLatex", () => {
  it("builds sb2nov document", () => {
    const tex = buildResumeLatex(STRUCTURED, "sb2nov");
    expect(tex).toContain("\\documentclass[letterpaper,11pt]{article}");
    expect(tex).toContain("Alex Chen");
    expect(tex).toContain("\\section{Experience}");
    expect(tex).toContain("\\resumeSubheading");
    expect(tex).toContain("\\begin{document}");
    expect(tex).toContain("\\end{document}");
  });

  it("builds deedy two-column document", () => {
    const tex = buildResumeLatex(STRUCTURED, "deedy");
    expect(tex).toContain("minipage");
    expect(tex).toContain("Education");
    expect(tex).toContain("Experience");
  });

  it("builds modern and plushcv", () => {
    expect(buildResumeLatex(STRUCTURED, "modern")).toContain("Work Experience");
    expect(buildResumeLatex(STRUCTURED, "plushcv")).toContain("0.68\\textwidth");
  });

  it("builds harshibar document", () => {
    const tex = buildResumeLatex(STRUCTURED, "harshibar");
    expect(tex).toContain("fontawesome5");
    expect(tex).toContain("\\section{EXPERIENCE}");
    expect(tex).toContain("\\faEnvelope");
    expect(tex).toContain("Alex Chen");
  });

  it("exposes five templates", () => {
    expect(LATEX_TEMPLATES.map((t) => t.id)).toEqual([
      "deedy",
      "sb2nov",
      "modern",
      "plushcv",
      "harshibar",
    ]);
  });
});
