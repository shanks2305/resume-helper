import type { StructuredResume } from "../structured";
import { plainTextToStructured } from "../structured";

export function resolveStructured(
  rawOrStructured: string | StructuredResume,
): StructuredResume | null {
  if (typeof rawOrStructured !== "string") return rawOrStructured;
  return plainTextToStructured(rawOrStructured);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeTypst(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/[#$]/g, (c) => `\\${c}`);
}

export function splitDateRange(dates: string): { start: string; end: string } {
  const parts = dates.split(/\s*[–—-]\s+/);
  return { start: parts[0]?.trim() || dates.trim(), end: parts[1]?.trim() || "" };
}

export function classifyLink(url: string): {
  network: string;
  username: string;
  href: string;
} {
  const href = url.trim();
  const lower = href.toLowerCase();
  if (lower.includes("linkedin.com")) {
    return {
      network: "LinkedIn",
      username: href.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "").replace(/\/$/, ""),
      href,
    };
  }
  if (lower.includes("github.com")) {
    return {
      network: "GitHub",
      username: href.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/$/, ""),
      href,
    };
  }
  return { network: "Website", username: href, href };
}

export function contactLine(r: StructuredResume): string {
  return [r.email, r.phone, r.location, ...r.links].filter(Boolean).join(" · ");
}
