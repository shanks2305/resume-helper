import type { StructuredResume } from "../structured";
import { buildResumeLatex, type LatexTemplateId } from "../latex/templates";
import {
  buildRenderCvJson,
  buildRenderCvYaml,
  type RenderCvThemeId,
} from "./rendercv";
import { buildResumeTypst, type TypstTemplateId } from "./typst";
import { buildResumeMarkdown, type MarkdownTemplateId } from "./markdown";
import { buildResumeHtml, type HtmlTemplateId } from "./html";
import { buildResumeDoc, type DocsTemplateId } from "./docs";
import type { FormatFamilyId } from "./catalog";

export type RenderCvSyntax = "yaml" | "json";

export type BuiltResume = {
  filename: string;
  mime: string;
  contents: string;
  language: string;
};

export function buildResumeExport(
  rawOrStructured: string | StructuredResume,
  family: FormatFamilyId,
  templateId: string,
  options?: { rendercv?: RenderCvSyntax },
): BuiltResume {
  const date = new Date().toISOString().slice(0, 10);
  const stem = `ats-resume-${templateId}-${date}`;

  switch (family) {
    case "latex": {
      const contents = buildResumeLatex(
        rawOrStructured,
        templateId as LatexTemplateId,
      );
      return {
        filename: `${stem}.tex`,
        mime: "application/x-tex;charset=utf-8",
        contents,
        language: "latex",
      };
    }
    case "rendercv": {
      const theme = templateId as RenderCvThemeId;
      if (options?.rendercv === "json") {
        return {
          filename: `${stem}.json`,
          mime: "application/json;charset=utf-8",
          contents: buildRenderCvJson(rawOrStructured, theme),
          language: "json",
        };
      }
      return {
        filename: `${stem}.yaml`,
        mime: "text/yaml;charset=utf-8",
        contents: buildRenderCvYaml(rawOrStructured, theme),
        language: "yaml",
      };
    }
    case "typst":
      return {
        filename: `${stem}.typ`,
        mime: "text/plain;charset=utf-8",
        contents: buildResumeTypst(rawOrStructured, templateId as TypstTemplateId),
        language: "typst",
      };
    case "markdown":
      return {
        filename: `${stem}.md`,
        mime: "text/markdown;charset=utf-8",
        contents: buildResumeMarkdown(
          rawOrStructured,
          templateId as MarkdownTemplateId,
        ),
        language: "markdown",
      };
    case "html":
      return {
        filename: `${stem}.html`,
        mime: "text/html;charset=utf-8",
        contents: buildResumeHtml(rawOrStructured, templateId as HtmlTemplateId),
        language: "html",
      };
    case "docs":
      return {
        filename: `${stem}.doc`,
        mime: "application/msword;charset=utf-8",
        contents: buildResumeDoc(rawOrStructured, templateId as DocsTemplateId),
        language: "html",
      };
  }
}

export {
  buildRenderCvJson,
  buildRenderCvYaml,
  buildResumeTypst,
  buildResumeMarkdown,
  buildResumeHtml,
  buildResumeDoc,
};
