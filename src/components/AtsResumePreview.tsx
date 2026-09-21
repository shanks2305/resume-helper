"use client";

import { useMemo, useState } from "react";
import { AtsScoreCard } from "@/components/AtsScoreCard";
import { scoreResumeAgainstKeywords } from "@/lib/ats/analyze-core";
import type { AnalysisResult } from "@/lib/client-types";
import { downloadTextFile } from "@/lib/report";
import { downloadResumePdf } from "@/lib/resume/pdf";
import type { LatexTemplateId } from "@/lib/resume/latex/templates";
import type { HtmlTemplateId } from "@/lib/resume/formats/html";
import {
  FORMAT_FAMILIES,
  templatesFor,
  type FormatFamilyId,
} from "@/lib/resume/formats/catalog";
import {
  buildResumeExport,
  type RenderCvSyntax,
} from "@/lib/resume/formats";
import { buildResumeHtml } from "@/lib/resume/formats/html";
import type { StructuredResume } from "@/lib/resume/structured";

export function AtsResumePreview({
  draft,
  structured,
  copiedKey,
  onCopy,
  onScore,
  keywords,
  jdText,
  originalScores,
}: {
  draft: string;
  structured?: StructuredResume | null;
  copiedKey: string | null;
  onCopy: (text: string) => void;
  onScore: () => void;
  keywords: AnalysisResult["keywords"];
  jdText?: string;
  originalScores?: AnalysisResult["scores"];
}) {
  const [family, setFamily] = useState<FormatFamilyId>("latex");
  const [templateId, setTemplateId] = useState("sb2nov");
  const [rendercv, setRendercv] = useState<RenderCvSyntax>("yaml");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const source = structured || draft;
  const templates = templatesFor(family);
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const activeId = template.id;

  const built = useMemo(
    () =>
      buildResumeExport(source, family, activeId, { rendercv }),
    [source, family, activeId, rendercv],
  );

  const htmlPreview = useMemo(() => {
    if (family === "html" || family === "docs") {
      return buildResumeHtml(source, activeId as HtmlTemplateId);
    }
    return null;
  }, [family, source, activeId]);

  const scored = useMemo(
    () => scoreResumeAgainstKeywords(draft, keywords, jdText),
    [draft, keywords, jdText],
  );

  function switchFamily(next: FormatFamilyId) {
    setFamily(next);
    setPdfError(null);
    const first = templatesFor(next)[0];
    setTemplateId(next === "latex" ? "sb2nov" : first.id);
  }

  function download() {
    downloadTextFile(built.filename, built.contents, built.mime);
  }

  async function handlePdf() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadResumePdf(source, activeId as LatexTemplateId);
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? err.message
          : "PDF compile failed — .tex was downloaded.",
      );
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <AtsScoreCard scored={scored} original={originalScores} />

      <div>
        <p className="section-label">Format</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Same content, five templates in each format. RenderCV is JSON/YAML;
          Typst, Markdown+Pandoc, HTML, and Word .doc are generated locally.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FORMAT_FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => switchFamily(f.id)}
              className={`rounded-full border px-3 py-1.5 text-left text-xs transition ${
                family === f.id
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "border-[var(--line)] bg-white/50 text-[var(--muted)] hover:border-[var(--ink)]/25 hover:text-[var(--ink)]"
              }`}
            >
              <span className="font-semibold">{f.label}</span>
              <span className="mt-0.5 block opacity-80">{f.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="section-label">Template</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`rounded-full border px-3 py-1.5 text-left text-xs transition ${
                activeId === t.id
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "border-[var(--line)] bg-white/50 text-[var(--muted)] hover:border-[var(--ink)]/25 hover:text-[var(--ink)]"
              }`}
            >
              <span className="font-semibold">{t.label}</span>
              <span className="mt-0.5 block opacity-80">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      {family === "rendercv" ? (
        <div className="flex flex-wrap gap-2">
          {(["yaml", "json"] as const).map((syntax) => (
            <button
              key={syntax}
              type="button"
              onClick={() => setRendercv(syntax)}
              className={`rounded-full border px-3 py-1 text-xs uppercase ${
                rendercv === syntax
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "border-[var(--line)] text-[var(--muted)]"
              }`}
            >
              {syntax}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCopy(built.contents)}
          className="btn-ghost !px-3 !py-1.5 text-xs"
        >
          {copiedKey === "draft" ? "Copied" : `Copy ${built.filename.split(".").pop()}`}
        </button>
        <button
          type="button"
          onClick={download}
          className="btn-ghost !px-3 !py-1.5 text-xs"
        >
          Download {built.filename.split(".").pop()}
        </button>
        {family === "latex" ? (
          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => void handlePdf()}
            className="btn-primary !px-3 !py-1.5 text-xs"
          >
            {pdfBusy ? "Compiling…" : "Download PDF"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onScore}
          className="btn-ghost !px-3 !py-1.5 text-xs"
        >
          Open re-score tab
        </button>
      </div>

      {pdfError ? (
        <p role="alert" className="text-sm text-[var(--danger-ink)]">
          {pdfError}
        </p>
      ) : null}

      {htmlPreview ? (
        <iframe
          title={`${template.label} preview`}
          className="h-[70vh] w-full overflow-auto rounded-2xl border border-[var(--line)] bg-white"
          sandbox=""
          srcDoc={htmlPreview}
        />
      ) : (
        <div
          className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[#1a1f1c]"
          aria-label={`${template.label} source`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <p className="text-xs font-medium text-white/70">{built.filename}</p>
            <p className="text-[10px] text-white/40">{built.language}</p>
          </div>
          <pre className="max-h-[70vh] overflow-auto p-4 text-[11px] leading-5 text-[#d8e0d4]">
            {built.contents}
          </pre>
        </div>
      )}
    </div>
  );
}
