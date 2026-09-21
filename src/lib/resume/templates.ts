/**
 * Resume template catalog.
 * LaTeX stays in ./latex; JSON/YAML (RenderCV), Typst, Markdown, HTML, and Word live in ./formats.
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

export {
  buildResumeHtml,
  buildResumeMarkdown,
  buildResumeTypst,
  buildRenderCvJson,
  buildRenderCvYaml,
  buildResumeDoc,
  buildResumeExport,
} from "./formats";

export { FORMAT_FAMILIES, templatesFor } from "./formats/catalog";

import { plainTextToStructured, structuredToPlainText, type StructuredResume } from "./structured";
import type { LatexTemplateId } from "./latex/templates";

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
