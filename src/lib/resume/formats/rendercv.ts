import type { StructuredResume } from "../structured";
import { classifyLink, resolveStructured, splitDateRange } from "./shared";
import { toYaml } from "./yaml";

export const RENDERCV_THEMES = [
  {
    id: "classic",
    label: "Classic",
    description: "RenderCV classic — serif, traditional ATS.",
  },
  {
    id: "sb2nov",
    label: "sb2nov",
    description: "Jake’s resume theme used by RenderCV.",
  },
  {
    id: "engineeringresumes",
    label: "Engineering",
    description: "Dense engineeringresumes theme.",
  },
  {
    id: "engineeringclassic",
    label: "Eng. classic",
    description: "Engineering-classic with clearer section rules.",
  },
  {
    id: "moderncv",
    label: "ModernCV",
    description: "moderncv-inspired header and rules.",
  },
] as const;

export type RenderCvThemeId = (typeof RENDERCV_THEMES)[number]["id"];

function toRenderCvDocument(
  r: StructuredResume,
  theme: RenderCvThemeId,
) {
  const social = r.links.map(classifyLink).map((l) => ({
    network: l.network,
    username: l.username,
  }));

  const sections: Record<string, unknown> = {};
  if (r.summary) sections.summary = [r.summary];
  if (r.experience.length) {
    sections.experience = r.experience.map((job) => {
      const { start, end } = splitDateRange(job.dates);
      return {
        company: job.company,
        position: job.title,
        location: job.location || undefined,
        start_date: start || undefined,
        end_date: end || undefined,
        highlights: job.bullets,
      };
    });
  }
  if (r.education.length) {
    sections.education = r.education.map((ed) => {
      const { start, end } = splitDateRange(ed.dates);
      return {
        institution: ed.school,
        area: ed.degree,
        location: ed.location || undefined,
        start_date: start || undefined,
        end_date: end || undefined,
        highlights: ed.details.length ? ed.details : undefined,
      };
    });
  }
  if (r.skills.length) {
    sections.skills = [
      {
        label: "Skills",
        details: r.skills.join(", "),
      },
    ];
  }
  if (r.projects.length) {
    sections.projects = r.projects.map((p) => ({
      name: p.name,
      highlights: [
        ...(p.tech ? [`Tech: ${p.tech}`] : []),
        ...p.bullets,
      ],
    }));
  }
  if (r.certifications.length) {
    sections.certifications = r.certifications.map((c) => ({ name: c }));
  }

  return {
    cv: {
      name: r.name,
      location: r.location || undefined,
      email: r.email || undefined,
      phone: r.phone || undefined,
      social_networks: social.length ? social : undefined,
      sections,
    },
    design: {
      theme,
      page: {
        size: "us-letter",
      },
    },
  };
}

export function buildRenderCvJson(
  rawOrStructured: string | StructuredResume,
  theme: RenderCvThemeId = "classic",
): string {
  const r = resolveStructured(rawOrStructured);
  if (!r) return "{}";
  return `${JSON.stringify(toRenderCvDocument(r, theme), null, 2)}\n`;
}

export function buildRenderCvYaml(
  rawOrStructured: string | StructuredResume,
  theme: RenderCvThemeId = "classic",
): string {
  const r = resolveStructured(rawOrStructured);
  if (!r) return "cv: {}\n";
  return `${toYaml(toRenderCvDocument(r, theme))}\n`;
}
