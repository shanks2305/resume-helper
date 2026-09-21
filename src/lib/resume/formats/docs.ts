import type { StructuredResume } from "../structured";
import {
  HTML_TEMPLATES,
  buildResumeHtml,
  type HtmlTemplateId,
} from "./html";

/** Word / Google Docs open this HTML as a .doc. */
export const DOCS_TEMPLATES = HTML_TEMPLATES.map((t) => ({
  id: t.id,
  label: t.label,
  description: `${t.description} Word-compatible .doc.`,
}));

export type DocsTemplateId = HtmlTemplateId;

export function buildResumeDoc(
  rawOrStructured: string | StructuredResume,
  templateId: DocsTemplateId = "sans",
): string {
  const html = buildResumeHtml(rawOrStructured, templateId);
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
  </w:WordDocument>
</xml>
<![endif]-->
</head>
<body>${html.replace(/^[\s\S]*<body>/i, "").replace(/<\/body>[\s\S]*$/i, "")}</body>
</html>
`;
}
