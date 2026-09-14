import {
  buildResumeLatex,
  type LatexTemplateId,
} from "./latex/templates";
import type { StructuredResume } from "./structured";
import { downloadTextFile } from "@/lib/report";

export function downloadResumeTex(
  rawOrStructured: string | StructuredResume,
  templateId: LatexTemplateId,
): void {
  const tex = buildResumeLatex(rawOrStructured, templateId);
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(
    `ats-resume-${templateId}-${date}.tex`,
    tex,
    "application/x-tex;charset=utf-8",
  );
}

/**
 * Compile LaTeX → PDF via server route (latexonline / local fallback).
 */
export async function downloadResumePdf(
  rawOrStructured: string | StructuredResume,
  templateId: LatexTemplateId,
): Promise<void> {
  const tex = buildResumeLatex(rawOrStructured, templateId);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `ats-resume-${templateId}-${date}.pdf`;

  const response = await fetch("/api/compile-latex", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tex, templateId, filename }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    // Fall back to downloading .tex so the user can compile in Overleaf
    downloadResumeTex(rawOrStructured, templateId);
    throw new Error(
      data.error ||
        "PDF compile failed — downloaded .tex instead (open in Overleaf).",
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
