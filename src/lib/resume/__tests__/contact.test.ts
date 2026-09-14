import { describe, expect, it } from "vitest";
import {
  formatContactPlain,
  parseContactLines,
  stripIconTokens,
} from "../contact";
import { buildResumeLatex } from "../templates";

describe("stripIconTokens", () => {
  it("removes font-awesome icon names", () => {
    expect(stripIconTokens("envelope alex@email.com phone 555-010-2040")).toBe(
      "alex@email.com 555-010-2040",
    );
    expect(stripIconTokens("map-marker San Francisco, CA")).toBe(
      "San Francisco, CA",
    );
  });
});

describe("parseContactLines", () => {
  it("labels email, phone, and location", () => {
    const items = parseContactLines([
      "envelope alex@email.com | phone (555) 010-2040 | map-marker San Francisco, CA",
    ]);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "email",
          label: "Email",
          value: "alex@email.com",
        }),
        expect.objectContaining({ kind: "phone", label: "Ph" }),
        expect.objectContaining({
          kind: "location",
          label: "Loc",
          value: "San Francisco, CA",
        }),
      ]),
    );
  });

  it("detects linkedin urls", () => {
    const items = parseContactLines(["linkedin linkedin.com/in/alexrivera"]);
    expect(items[0]).toMatchObject({
      kind: "url",
      label: "LinkedIn",
      value: "linkedin.com/in/alexrivera",
    });
  });
});

describe("formatContactPlain", () => {
  it("joins labeled items", () => {
    const plain = formatContactPlain(
      parseContactLines(["alex@email.com | (555) 010-2040"]),
    );
    expect(plain).toContain("Email: alex@email.com");
    expect(plain).toContain("Ph:");
  });
});

describe("latex contact rendering", () => {
  it("keeps contact values without icon names", () => {
    const raw = `Alex Chen
envelope alex@email.com phone (555) 010-2040 map-marker Austin, TX

SUMMARY
Engineer.

SKILLS
- TypeScript

EXPERIENCE
Engineer — Co | Austin, TX | 2020–Present
- Shipped features

EDUCATION
B.S. — Uni | 2019`;

    const tex = buildResumeLatex(raw, "sb2nov");
    expect(tex).not.toMatch(/\benvelope\b/i);
    expect(tex).toContain("alex@email.com");
  });
});
