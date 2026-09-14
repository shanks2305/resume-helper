/**
 * Resume templates are LaTeX-only.
 * HTML/Markdown builders have been removed — use buildResumeLatex.
 */
export {
  LATEX_TEMPLATES as RESUME_TEMPLATES,
  buildResumeLatex,
  escapeLatex,
  getLatexTemplate as getResumeTemplate,
  type LatexTemplate as ResumeTemplate,
  type LatexTemplateId as ResumeTemplateId,
} from "./latex/templates";

export {
  plainTextToStructured,
  structuredToPlainText,
  type StructuredResume,
} from "./structured";

import { buildResumeLatex, type LatexTemplateId } from "./latex/templates";
import {
  plainTextToStructured,
  structuredToPlainText,
  type StructuredResume,
} from "./structured";

/** Plain-text ATS export derived from structured content (for scoring). */
export function formatResumeWithTemplate(
  rawOrStructured: string | StructuredResume,
  _templateId?: LatexTemplateId,
): string {
  if (typeof rawOrStructured !== "string") {
    return structuredToPlainText(rawOrStructured);
  }
  const structured = plainTextToStructured(rawOrStructured);
  return structured ? structuredToPlainText(structured) : rawOrStructured.trim();
}

/** @deprecated Use buildResumeLatex — kept so old imports fail loudly at call sites we update. */
export function buildResumeHtml(
  rawOrStructured: string | StructuredResume,
  templateId: LatexTemplateId,
): string {
  return buildResumeLatex(rawOrStructured, templateId);
}

/** @deprecated Markdown export removed — returns plain ATS text. */
export function buildResumeMarkdown(
  rawOrStructured: string | StructuredResume,
): string {
  return formatResumeWithTemplate(rawOrStructured);
}
