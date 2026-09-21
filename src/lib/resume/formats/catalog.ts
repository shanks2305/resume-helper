import { LATEX_TEMPLATES, type LatexTemplateId } from "../latex/templates";
import { RENDERCV_THEMES, type RenderCvThemeId } from "./rendercv";
import { TYPST_TEMPLATES, type TypstTemplateId } from "./typst";
import { MARKDOWN_TEMPLATES, type MarkdownTemplateId } from "./markdown";
import { HTML_TEMPLATES, type HtmlTemplateId } from "./html";
import { DOCS_TEMPLATES, type DocsTemplateId } from "./docs";

export type FormatFamilyId =
  | "latex"
  | "rendercv"
  | "typst"
  | "markdown"
  | "html"
  | "docs";

export const FORMAT_FAMILIES: Array<{
  id: FormatFamilyId;
  label: string;
  hint: string;
}> = [
  { id: "latex", label: "LaTeX", hint: "Overleaf / pdflatex" },
  { id: "rendercv", label: "RenderCV", hint: "JSON + YAML" },
  { id: "typst", label: "Typst", hint: "typst.app" },
  { id: "markdown", label: "Markdown", hint: "Pandoc" },
  { id: "html", label: "HTML", hint: "Browser / print" },
  { id: "docs", label: "Word / Docs", hint: ".doc HTML" },
];

export type FamilyTemplateId = {
  latex: LatexTemplateId;
  rendercv: RenderCvThemeId;
  typst: TypstTemplateId;
  markdown: MarkdownTemplateId;
  html: HtmlTemplateId;
  docs: DocsTemplateId;
};

export function templatesFor(family: FormatFamilyId) {
  switch (family) {
    case "latex":
      return LATEX_TEMPLATES;
    case "rendercv":
      return RENDERCV_THEMES;
    case "typst":
      return TYPST_TEMPLATES;
    case "markdown":
      return MARKDOWN_TEMPLATES;
    case "html":
      return HTML_TEMPLATES;
    case "docs":
      return DOCS_TEMPLATES;
  }
}

export function defaultTemplateId(family: FormatFamilyId): string {
  return templatesFor(family)[0].id;
}
