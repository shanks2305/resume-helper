import { describe, expect, it } from "vitest";
import {
  ensureKeywordCoverage,
  ensureKeywordCoverageInDraft,
} from "../keyword-coverage";
import { matchKeywords, scoreKeywordMatches } from "@/lib/ats/keyword-match";
import type { StructuredResume } from "../structured";
import type { JdKeywords } from "@/lib/schemas";

const keywords: JdKeywords = {
  required: ["Kubernetes", "TypeScript"],
  preferred: [],
  tools: ["CI/CD"],
  titles: [],
  softSkills: [],
};

const source = `Alex Chen
Email: alex@email.com

SUMMARY
Engineer who ships APIs.

SKILLS
- k8s
- TypeScript
- GitHub Actions

EXPERIENCE
Engineer — Acme | 2021–Present
- Ran workloads on k8s and CI/CD pipelines
`;

function slimResume(skills: string[]): StructuredResume {
  return {
    name: "Alex Chen",
    email: "alex@email.com",
    phone: "",
    location: "",
    links: [],
    summary: "Engineer who ships APIs.",
    skills,
    experience: [
      {
        company: "Acme",
        title: "Engineer",
        location: "",
        dates: "2021–Present",
        bullets: ["Ran workloads on containers"],
      },
    ],
    education: [],
    projects: [],
    certifications: [],
  };
}

describe("ensureKeywordCoverage", () => {
  it("adds JD spellings the source resume already supports", () => {
    const generated = slimResume(["Git"]);
    const repaired = ensureKeywordCoverage(generated, source, keywords);
    expect(repaired.skills.join(" ")).toMatch(/Kubernetes/i);
    expect(repaired.skills.join(" ")).toMatch(/TypeScript/i);
    expect(repaired.skills.join(" ")).toMatch(/CI\/CD/i);

    const matches = matchKeywords(
      repaired.skills.concat(repaired.summary).join("\n"),
      keywords,
    );
    expect(scoreKeywordMatches(matches)).toBeGreaterThan(
      scoreKeywordMatches(matchKeywords(generated.skills.join(" "), keywords)),
    );
  });

  it("does not invent keywords the source resume lacks", () => {
    const generated = slimResume(["TypeScript"]);
    const repaired = ensureKeywordCoverage(generated, source, {
      ...keywords,
      required: ["Kubernetes", "TypeScript", "Golang"],
    });
    expect(repaired.skills.some((s) => /golang/i.test(s))).toBe(false);
  });

  it("repairs a freeform draft that dropped skills", () => {
    const { draft } = ensureKeywordCoverageInDraft(
      `Alex Chen
Email: alex@email.com

SUMMARY
Engineer.

EXPERIENCE
Engineer — Acme | 2021–Present
- Shipped features
`,
      source,
      keywords,
    );
    expect(draft).toMatch(/Kubernetes/i);
    expect(draft).toMatch(/SKILLS/i);
  });
});
