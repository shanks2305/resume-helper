import { describe, expect, it } from "vitest";
import { plainTextToStructured } from "../structured";
import { FORMAT_FAMILIES, templatesFor } from "../formats/catalog";
import {
  buildRenderCvJson,
  buildRenderCvYaml,
  buildResumeDoc,
  buildResumeExport,
  buildResumeHtml,
  buildResumeMarkdown,
  buildResumeTypst,
} from "../formats";
import { RENDERCV_THEMES } from "../formats/rendercv";
import { TYPST_TEMPLATES } from "../formats/typst";
import { MARKDOWN_TEMPLATES } from "../formats/markdown";
import { HTML_TEMPLATES } from "../formats/html";
import { LATEX_TEMPLATES } from "../latex/templates";
import { scoreResumeAgainstKeywords } from "@/lib/ats/analyze-core";

const SAMPLE = `Alex Chen
Email: alex@email.com · Ph: (555) 010-2040 · Loc: San Francisco, CA

SUMMARY
Software engineer with 5 years building APIs and React apps.

SKILLS
- TypeScript
- React
- Kubernetes

EXPERIENCE
Software Engineer — Acme Corp | San Francisco, CA | 2021–Present
- Built REST APIs serving 2M requests/day
- Led migration to TypeScript across 12 services

EDUCATION
B.S. Computer Science — State University | 2019`;

const STRUCTURED = plainTextToStructured(SAMPLE)!;

describe("format catalogs", () => {
  it("has five templates in every family", () => {
    expect(FORMAT_FAMILIES).toHaveLength(6);
    expect(LATEX_TEMPLATES).toHaveLength(5);
    expect(RENDERCV_THEMES).toHaveLength(5);
    expect(TYPST_TEMPLATES).toHaveLength(5);
    expect(MARKDOWN_TEMPLATES).toHaveLength(5);
    expect(HTML_TEMPLATES).toHaveLength(5);
    for (const family of FORMAT_FAMILIES) {
      expect(templatesFor(family.id)).toHaveLength(5);
    }
  });
});

describe("builders", () => {
  it("emits RenderCV yaml and json with the chosen theme", () => {
    const yaml = buildRenderCvYaml(STRUCTURED, "sb2nov");
    const json = buildRenderCvJson(STRUCTURED, "moderncv");
    expect(yaml).toContain("theme: sb2nov");
    expect(yaml).toContain("Alex Chen");
    expect(json).toContain('"theme": "moderncv"');
    expect(JSON.parse(json).cv.name).toBe("Alex Chen");
  });

  it("emits five typst styles", () => {
    for (const t of TYPST_TEMPLATES) {
      const typ = buildResumeTypst(STRUCTURED, t.id);
      expect(typ).toContain("#set page");
      expect(typ).toContain("Alex Chen");
    }
  });

  it("emits pandoc markdown with yaml front matter", () => {
    const md = buildResumeMarkdown(STRUCTURED, "classic");
    expect(md.startsWith("---")).toBe(true);
    expect(md).toContain("# Alex Chen");
    expect(md).toContain("geometry:");
  });

  it("emits html and word-compatible doc", () => {
    const html = buildResumeHtml(STRUCTURED, "banner");
    const doc = buildResumeDoc(STRUCTURED, "serif");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Alex Chen");
    expect(doc).toContain("urn:schemas-microsoft-com:office:word");
    expect(doc).toContain("Alex Chen");
  });

  it("buildResumeExport picks the right extension", () => {
    expect(buildResumeExport(STRUCTURED, "typst", "jake").filename).toMatch(/\.typ$/);
    expect(buildResumeExport(STRUCTURED, "rendercv", "classic", { rendercv: "json" }).filename).toMatch(/\.json$/);
    expect(buildResumeExport(STRUCTURED, "docs", "sans").filename).toMatch(/\.doc$/);
  });
});

describe("ATS draft scoring", () => {
  it("scores the generated plain-text resume against JD keywords", () => {
    const scored = scoreResumeAgainstKeywords(SAMPLE, {
      required: ["TypeScript", "Kubernetes"],
      preferred: [],
      tools: ["React"],
      titles: [],
      softSkills: [],
    });
    expect(scored.scores.keyword).toBe(100);
    expect(scored.missingRequired).toEqual([]);
    expect(scored.scores.overall).toBeGreaterThan(50);
  });
});
