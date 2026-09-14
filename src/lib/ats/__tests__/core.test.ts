import { describe, expect, it } from "vitest";
import { runAtsChecks, scoreAtsChecks } from "@/lib/ats/format-checks";
import { matchKeywords, scoreKeywordMatches } from "@/lib/ats/keyword-match";
import { findKeywordLocations } from "@/lib/ats/keyword-locations";
import { checkSeniority } from "@/lib/ats/years-check";
import { findUnquantifiedBullets } from "@/lib/ats/bullet-metrics";
import { computeOverallScore, scoreSections } from "@/lib/ats/score";
import { cleanJobDescription } from "@/lib/jd/cleanup";
import { hashJd } from "@/lib/cache/jd-keywords";
import { rateLimit } from "@/lib/rate-limit";

describe("cleanJobDescription", () => {
  it("strips EEO and benefits boilerplate", () => {
    const raw = `Software Engineer
Requirements
- TypeScript
- React

Benefits
- 401k

Equal Opportunity Employer
All qualified applicants will receive consideration without regard to race.`;
    const { cleaned, removedBoilerplate } = cleanJobDescription(raw);
    expect(removedBoilerplate).toBe(true);
    expect(cleaned.toLowerCase()).toContain("typescript");
    expect(cleaned.toLowerCase()).not.toContain("equal opportunity");
  });
});

describe("matchKeywords", () => {
  it("matches synonyms like k8s -> kubernetes", () => {
    const matches = matchKeywords("Built services on k8s and CI/CD", {
      required: ["Kubernetes", "CI/CD"],
      preferred: [],
      tools: [],
      titles: [],
      softSkills: [],
    });
    expect(matches.every((m) => m.found)).toBe(true);
    expect(matches[0]?.matchedAs).toBe("k8s");
  });

  it("scores required keywords higher impact", () => {
    const matches = matchKeywords("React only", {
      required: ["React", "TypeScript"],
      preferred: ["Go"],
      tools: [],
      titles: [],
      softSkills: [],
    });
    const score = scoreKeywordMatches(matches);
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThan(80);
  });
});

describe("ATS + score helpers", () => {
  it("detects contact and sections", () => {
    const text = `Jane Doe
jane@example.com
(555) 111-2222

Experience
- Shipped features

Education
BS CS

Skills
TypeScript`;
    const checks = runAtsChecks(text);
    expect(checks.find((c) => c.id === "contact-email")?.passed).toBe(true);
    expect(scoreAtsChecks(checks)).toBeGreaterThan(50);
    expect(scoreSections(text)).toBeGreaterThan(50);
    expect(computeOverallScore({ keyword: 80, ats: 70, section: 60 })).toBe(73);
  });
});

describe("locations, years, bullets", () => {
  it("finds keyword section locations", () => {
    const resume = `Summary
Engineer

Skills
React, Node.js

Experience
Built React apps`;
    const locs = findKeywordLocations(resume, ["React"]);
    expect(locs[0]?.section).toMatch(/Skills|Experience/);
  });

  it("flags seniority shortfall", () => {
    const finding = checkSeniority(
      "Need 8+ years of experience as a senior engineer",
      "2 years of experience building APIs",
    );
    expect(finding.gap).toBe("short");
  });

  it("flags unquantified bullets", () => {
    const tips = findUnquantifiedBullets(`Experience
- Improved the checkout flow for customers
- Cut p95 latency by 40% for checkout API`);
    expect(tips.length).toBe(1);
    expect(tips[0]?.original.toLowerCase()).toContain("checkout flow");
  });
});

describe("cache + rate limit", () => {
  it("hashes JD stably", () => {
    expect(hashJd("Hello")).toBe(hashJd("hello"));
  });

  it("rate limits after threshold", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
    expect(rateLimit(key, 3, 60_000).ok).toBe(false);
  });
});
