import { describe, expect, it } from "vitest";
import { plainTextToStructured, structuredToPlainText } from "../structured";
import { formatResumeWithTemplate, buildResumeLatex } from "../templates";

const SAMPLE = `Alex Chen
Email: alex@email.com · Ph: (555) 010-2040 · Loc: San Francisco, CA

SUMMARY
Software engineer with 5 years building APIs and React apps.

SKILLS
- TypeScript
- React
- Node.js
- PostgreSQL

EXPERIENCE
Software Engineer — Acme Corp | San Francisco, CA | 2021–Present
- Built REST APIs serving 2M requests/day
- Led migration to TypeScript across 12 services

EDUCATION
B.S. Computer Science — State University | 2019`;

describe("structured + latex pipeline", () => {
  it("parses into structured slots", () => {
    const s = plainTextToStructured(SAMPLE)!;
    expect(s.name).toBe("Alex Chen");
    expect(s.experience[0]?.bullets.length).toBeGreaterThan(0);
  });

  it("exports plain text for scoring", () => {
    const s = plainTextToStructured(SAMPLE)!;
    const plain = formatResumeWithTemplate(s, "sb2nov");
    expect(plain).toContain("SUMMARY");
    expect(structuredToPlainText(s)).toContain("Alex Chen");
  });

  it("builds latex from plain draft", () => {
    const tex = buildResumeLatex(SAMPLE, "sb2nov");
    expect(tex).toContain("\\documentclass");
    expect(tex).not.toContain("<html");
  });
});
