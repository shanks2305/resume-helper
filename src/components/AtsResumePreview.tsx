"use client";

import { useMemo, useState } from "react";
import { downloadResumePdf, downloadResumeTex } from "@/lib/resume/pdf";
import {
  RESUME_TEMPLATES,
  buildResumeLatex,
  type ResumeTemplateId,
  type StructuredResume,
} from "@/lib/resume/templates";

export function AtsResumePreview({
  draft,
  structured,
  copiedKey,
  onCopy,
  onScore,
}: {
  draft: string;
  structured?: StructuredResume | null;
  copiedKey: string | null;
  onCopy: (text: string) => void;
  onScore: () => void;
}) {
  const [templateId, setTemplateId] = useState<ResumeTemplateId>("sb2nov");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const template = RESUME_TEMPLATES.find((t) => t.id === templateId)!;
  const source = structured || draft;

  const tex = useMemo(
    () => buildResumeLatex(source, templateId),
    [source, templateId],
  );

  async function handlePdf() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadResumePdf(source, templateId);
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
      <div>
        <p className="section-label">LaTeX template</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Content fills your chosen LaTeX format (no HTML/CSS). Download{" "}
          <code className="text-[11px]">.tex</code> or compile to PDF.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {RESUME_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`rounded-full border px-3 py-1.5 text-left text-xs transition ${
                templateId === t.id
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCopy(tex)}
          className="btn-ghost !px-3 !py-1.5 text-xs"
        >
          {copiedKey === "draft" ? "Copied" : "Copy .tex"}
        </button>
        <button
          type="button"
          onClick={() => downloadResumeTex(source, templateId)}
          className="btn-ghost !px-3 !py-1.5 text-xs"
        >
          Download .tex
        </button>
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => void handlePdf()}
          className="btn-primary !px-3 !py-1.5 text-xs"
        >
          {pdfBusy ? "Compiling…" : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={onScore}
          className="btn-ghost !px-3 !py-1.5 text-xs"
        >
          Score this draft
        </button>
      </div>

      {pdfError ? (
        <p role="alert" className="text-sm text-[var(--danger-ink)]">
          {pdfError}
        </p>
      ) : null}

      <div
        className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[#1a1f1c]"
        aria-label={`${template.label} LaTeX source`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <p className="text-xs font-medium text-white/70">
            {template.label} · resume.tex
          </p>
          <p className="text-[10px] text-white/40">pdflatex</p>
        </div>
        <pre className="max-h-[70vh] overflow-auto p-4 text-[11px] leading-5 text-[#d8e0d4]">
          {tex}
        </pre>
      </div>
    </div>
  );
}
