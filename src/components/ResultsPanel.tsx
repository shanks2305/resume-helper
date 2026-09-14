"use client";

import { useId, useState } from "react";
import type {
  AnalysisResult,
  LlmProvider,
  ScoreOnlyResult,
} from "@/lib/client-types";
import { AtsResumePreview } from "@/components/AtsResumePreview";
import { buildMarkdownReport, downloadTextFile } from "@/lib/report";
import {
  addUsage,
  emptyUsage,
  formatTokenCount,
  formatUsd,
  type LlmUsage,
} from "@/lib/llm/usage";

type TabId =
  | "overview"
  | "keywords"
  | "rewrites"
  | "ats"
  | "drafts"
  | "prep"
  | "rescore";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "keywords", label: "Keywords" },
  { id: "rewrites", label: "Rewrites" },
  { id: "ats", label: "ATS Resume" },
  { id: "drafts", label: "Drafts" },
  { id: "prep", label: "Learn & Prep" },
  { id: "rescore", label: "Re-score" },
];

function uniqueByTerm<T extends { term: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ResultsPanel({
  result,
  jdText = "",
  resumeText = "",
  resumeFile = null,
  provider,
  onSaveTracker,
  onDraftUpdated,
  compact = false,
}: {
  result: AnalysisResult;
  jdText?: string;
  resumeText?: string;
  resumeFile?: File | null;
  provider?: LlmProvider;
  onSaveTracker?: () => void;
  onDraftUpdated?: (
    draft: string,
    structured?: AnalysisResult["suggestions"]["structuredResume"],
  ) => void;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revised, setRevised] = useState("");
  const [revisedFile, setRevisedFile] = useState<File | null>(null);
  const [rescoreDragOver, setRescoreDragOver] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [rescoreError, setRescoreError] = useState<string | null>(null);
  const [rescore, setRescore] = useState<ScoreOnlyResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateNotes, setGenerateNotes] = useState<string | null>(null);
  const [extraUsage, setExtraUsage] = useState<LlmUsage>(emptyUsage);
  const [extraCostUsd, setExtraCostUsd] = useState(0);
  const rescoreFileId = useId();

  const baseUsage: LlmUsage = result.usage
    ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        calls: result.usage.calls,
      }
    : emptyUsage();
  const totalUsage = addUsage(baseUsage, extraUsage);
  const hasUsage = totalUsage.calls > 0 || totalUsage.totalTokens > 0;
  const estimatedCostUsd =
    result.usage?.estimatedCostUsd == null && extraUsage.calls === 0
      ? null
      : (result.usage?.estimatedCostUsd ?? 0) + extraCostUsd;

  const canRescore =
    Boolean(revisedFile) || revised.trim().length >= 40;
  const canGenerate =
    Boolean(jdText.trim()) &&
    (Boolean(resumeFile) || resumeText.trim().length >= 40) &&
    !generating;

  const found = uniqueByTerm(result.matches.filter((m) => m.found));
  const missing = uniqueByTerm(result.matches.filter((m) => !m.found));
  const mustHaveGaps = uniqueByTerm(
    result.matches.filter(
      (m) =>
        !m.found &&
        (m.importance === "critical" || m.category === "required"),
    ),
  );
  const s = {
    summary: result.suggestions.summary,
    priorities: result.suggestions.priorities || [],
    suggestions: result.suggestions.suggestions || [],
    tailoredSummary: result.suggestions.tailoredSummary || "",
    skillsReorder: result.suggestions.skillsReorder || [],
    fullDraft: result.suggestions.fullDraft || "",
    coverLetter: result.suggestions.coverLetter || "",
    interviewPrep: result.suggestions.interviewPrep || [],
    learningTopics: result.suggestions.learningTopics || [],
    commonQuestions: result.suggestions.commonQuestions || [],
    recruiterView: result.suggestions.recruiterView || {
      indexed: [],
      humanSees: [],
      notes: "",
    },
  };
  const keywordLocations = result.keywordLocations || [];
  const bulletTips = result.bulletTips || [];

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1600);
    } catch {
      setCopiedKey(null);
    }
  }

  function exportMarkdown() {
    downloadTextFile(
      `fitcheck-report-${new Date().toISOString().slice(0, 10)}.md`,
      buildMarkdownReport(result),
    );
  }

  async function generateAtsResume() {
    if (!canGenerate) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerateNotes(null);
    try {
      const form = new FormData();
      form.set("jd", jdText);
      form.set("resumeText", resumeText);
      form.set("provider", provider || result.provider);
      form.set("keywords", JSON.stringify(result.keywords));
      if (resumeFile) form.set("resume", resumeFile);

      const response = await fetch("/api/generate-resume", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        draft?: string;
        structured?: AnalysisResult["suggestions"]["structuredResume"];
        notes?: string;
        error?: string;
        usage?: AnalysisResult["usage"];
      };
      if (!response.ok || !data.draft) {
        throw new Error(data.error || "Could not generate ATS resume.");
      }
      onDraftUpdated?.(data.draft, data.structured);
      if (data.notes) setGenerateNotes(data.notes);
      if (data.usage) {
        setExtraUsage((prev) =>
          addUsage(prev, {
            promptTokens: data.usage!.promptTokens,
            completionTokens: data.usage!.completionTokens,
            totalTokens: data.usage!.totalTokens,
            calls: data.usage!.calls,
          }),
        );
        setExtraCostUsd((prev) => prev + (data.usage!.estimatedCostUsd ?? 0));
      }
      setTab("ats");
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Could not generate ATS resume.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function scoreAtsDraft() {
    if (!s.fullDraft) return;
    setRevised(s.fullDraft);
    setRevisedFile(null);
    setRescore(null);
    setRescoreError(null);
    setTab("rescore");
  }

  async function runRescore() {
    if (!canRescore || rescoring) return;
    setRescoring(true);
    setRescoreError(null);
    try {
      const form = new FormData();
      form.set("jdHash", result.jdHash);
      form.set("keywords", JSON.stringify(result.keywords));
      form.set("previousScores", JSON.stringify(result.scores));
      form.set("provider", result.provider);
      form.set("resumeText", revised);
      if (revisedFile) form.set("resume", revisedFile);

      const response = await fetch("/api/rescore", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Re-score failed.");
      setRescore(data as ScoreOnlyResult);
    } catch (err) {
      setRescoreError(err instanceof Error ? err.message : "Re-score failed.");
    } finally {
      setRescoring(false);
    }
  }

  function acceptRevisedFile(next: File | null) {
    if (!next) {
      setRevisedFile(null);
      return;
    }
    const okType =
      /\.(pdf|docx|txt)$/i.test(next.name) ||
      [
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(next.type);
    if (!okType) {
      setRescoreError("Use a PDF, DOCX, or TXT resume file.");
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setRescoreError("Resume file must be under 5MB.");
      return;
    }
    setRescoreError(null);
    setRevisedFile(next);
  }

  function formatBytes(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <section
      className={`animate-fade-up space-y-5 ${
        compact ? "" : "border-t border-[var(--line)] pt-10 space-y-6"
      }`}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
            {result.provider}/{result.model}
            {result.jdCleaned ? " · JD cleaned" : ""}
          </p>
          <h2
            className={`mt-1 font-[family-name:var(--font-display)] tracking-tight text-[var(--ink)] ${
              compact ? "text-3xl sm:text-4xl" : "mt-2 text-4xl sm:text-5xl"
            }`}
          >
            {result.scores.overall}% match
          </h2>
          <div className="mt-3 max-w-xs">
            <div className="score-bar">
              <span style={{ width: `${Math.min(100, result.scores.overall)}%` }} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <ScoreChip label="Keywords" value={result.scores.keyword} />
          <ScoreChip label="ATS" value={result.scores.ats} />
          <ScoreChip label="Sections" value={result.scores.section} />
          <div className="flex flex-wrap gap-2">
            {onSaveTracker ? (
              <button
                type="button"
                onClick={onSaveTracker}
                className="btn-ghost"
              >
                Save to tracker
              </button>
            ) : null}
            <button type="button" onClick={exportMarkdown} className="btn-ghost">
              Export Markdown
            </button>
          </div>
        </div>
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Result sections"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                : "border border-[var(--line)] bg-[var(--panel)]/70 text-[var(--muted)] hover:border-[var(--ink)]/25 hover:text-[var(--ink)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-6">
          <p className="max-w-4xl text-base leading-7 text-[var(--ink)]/85 xl:max-w-5xl">
            {s.summary}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/70 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-[var(--ink)]">
                {s.fullDraft
                  ? "ATS-friendly resume ready"
                  : "Want an ATS-friendly resume?"}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Tailored to this JD from your current resume — plain text, no
                invented experience.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.fullDraft ? (
                <button
                  type="button"
                  onClick={() => setTab("ats")}
                  className="btn-primary !px-4 !py-2 text-sm"
                >
                  View ATS resume
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => void generateAtsResume()}
                  className="btn-primary !px-4 !py-2 text-sm"
                >
                  {generating ? "Generating…" : "Generate ATS resume"}
                </button>
              )}
            </div>
          </div>

          {s.priorities.length > 0 ? (
            <div>
              <h3 className="section-label">Top priorities</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
                {s.priorities.map((item, i) => (
                  <li key={`priority-${i}`}>{item}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {result.seniority ? (
            <Callout
              title="Seniority check"
              tone={result.seniority.gap === "short" ? "warn" : "ok"}
              body={result.seniority.detail}
            />
          ) : null}
          {bulletTips.length > 0 ? (
            <div>
              <h3 className="section-label">Bullets needing metrics</h3>
              <ul className="mt-3 space-y-3">
                {bulletTips.map((tip, i) => (
                  <li key={`bullet-${i}`} className="text-sm leading-6">
                    <p className="text-[var(--ink)]/80">{tip.original}</p>
                    <p className="text-[var(--muted)]">{tip.tip}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <h3 className="section-label">ATS checklist</h3>
            <ul className="mt-3 space-y-3">
              {result.atsChecks.map((check) => (
                <li
                  key={check.id}
                  className="rounded-xl border border-[var(--line)]/70 bg-[var(--panel)]/50 px-4 py-3 text-sm leading-6"
                >
                  <span
                    className={
                      check.passed
                        ? "font-medium text-emerald-800"
                        : "font-medium text-amber-900"
                    }
                  >
                    {check.passed ? "Pass" : "Fix"} · {check.label}
                  </span>
                  <p className="mt-1 text-[var(--muted)]">{check.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === "keywords" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="section-label">Must-have gaps</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {mustHaveGaps.length === 0 ? (
                <span className="text-sm text-[var(--muted)]">
                  No critical keyword gaps.
                </span>
              ) : (
                mustHaveGaps.map((m) => (
                  <span
                    key={`crit-${m.term.toLowerCase()}`}
                    className="rounded-full bg-[var(--warn-soft)] px-3 py-1 text-xs font-medium text-[var(--warn-ink)]"
                  >
                    {m.term}
                  </span>
                ))
              )}
            </div>
            <h3 className="section-label mt-6">All missing</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {missing.length === 0 ? (
                <span className="text-sm text-[var(--muted)]">
                  All extracted keywords appear in the resume.
                </span>
              ) : (
                missing.map((m) => (
                  <span
                    key={`miss-${m.category}-${m.term.toLowerCase()}`}
                    className="rounded-full bg-[var(--warn-soft)] px-3 py-1 text-xs font-medium text-[var(--warn-ink)]"
                  >
                    {m.term}
                    <span className="opacity-60">
                      {" "}
                      · {m.importance || m.category}
                    </span>
                  </span>
                ))
              )}
            </div>
            {found.length > 0 ? (
              <>
                <h3 className="section-label mt-6">Found</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {found.map((m) => (
                    <span
                      key={`found-${m.category}-${m.term.toLowerCase()}`}
                      className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-ink)]"
                    >
                      {m.term}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <div>
            <h3 className="section-label">Where keywords appear</h3>
            {keywordLocations.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No section locations detected.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {keywordLocations.map((loc, i) => (
                  <li
                    key={`${loc.term}-${loc.section}-${i}`}
                    className="rounded-xl border border-[var(--line)]/70 bg-[var(--panel)]/50 px-4 py-3 text-sm"
                  >
                    <p className="font-medium">
                      {loc.term}{" "}
                      <span className="text-[var(--muted)]">· {loc.section}</span>
                    </p>
                    <p className="mt-1 text-[var(--muted)]">…{loc.snippet}…</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {tab === "rewrites" ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="section-label">Suggested rewrites</h3>
            {s.suggestions.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    "all",
                    s.suggestions
                      .map((x, i) => `${i + 1}. ${x.revised}`)
                      .join("\n\n"),
                  )
                }
                className="btn-ghost !px-3 !py-1.5 text-xs"
              >
                {copiedKey === "all" ? "Copied all" : "Copy all revised"}
              </button>
            ) : null}
          </div>
          {s.suggestions.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              No rewrite suggestions for this run.
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              {s.suggestions.map((item, i) => {
                const key = `rewrite-${i}`;
                return (
                  <article
                    key={key}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/70 p-5"
                  >
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                      Before
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--ink)]/70">
                      {item.original}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                        After
                      </p>
                      <button
                        type="button"
                        onClick={() => void copyText(key, item.revised)}
                        className="btn-ghost !px-2.5 !py-1 text-xs"
                      >
                        {copiedKey === key ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-1 text-sm leading-6">{item.revised}</p>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      {item.rationale}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === "ats" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="section-label">ATS-friendly resume</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Plain-text rewrite based on this JD and your resume. Facts stay
                truthful — only wording, structure, and keyword placement change.
              </p>
            </div>
            {s.fullDraft ? (
              <button
                type="button"
                disabled={!canGenerate}
                onClick={() => void generateAtsResume()}
                className="btn-ghost !px-3 !py-1.5 text-xs"
              >
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canGenerate}
                onClick={() => void generateAtsResume()}
                className="btn-primary !px-3 !py-1.5 text-xs"
              >
                {generating ? "Generating…" : "Generate"}
              </button>
            )}
          </div>

          {generateError ? (
            <p role="alert" className="text-sm text-[var(--danger-ink)]">
              {generateError}
            </p>
          ) : null}
          {generateNotes ? (
            <p className="text-sm leading-6 text-[var(--muted)]">
              {generateNotes}
            </p>
          ) : null}

          {!s.fullDraft && !generating ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/40 px-5 py-8 text-center">
              <p className="text-sm text-[var(--muted)]">
                No ATS resume yet. Generate one from your JD and current resume.
              </p>
              <button
                type="button"
                disabled={!canGenerate}
                onClick={() => void generateAtsResume()}
                className="btn-primary mt-4"
              >
                Generate ATS resume
              </button>
              {!jdText.trim() ||
              (!resumeFile && resumeText.trim().length < 40) ? (
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Need the original JD and resume text (or file) from this run.
                </p>
              ) : null}
            </div>
          ) : null}

          {generating && !s.fullDraft ? (
            <p className="animate-pulse-soft text-sm text-[var(--muted)]">
              Building your ATS-friendly resume…
            </p>
          ) : null}

          {s.fullDraft ? (
            <AtsResumePreview
              draft={s.fullDraft}
              structured={result.suggestions.structuredResume || null}
              copiedKey={copiedKey}
              onCopy={(text) => void copyText("draft", text)}
              onScore={scoreAtsDraft}
            />
          ) : null}
        </div>
      ) : null}

      {tab === "drafts" ? (
        <div className="space-y-8">
          {!s.tailoredSummary &&
          s.skillsReorder.length === 0 &&
          !s.coverLetter ? (
            <p className="text-sm text-[var(--muted)]">
              No drafts were generated for this run.
            </p>
          ) : null}
          {s.tailoredSummary ? (
            <CopyBlock
              title="Tailored summary"
              text={s.tailoredSummary}
              copied={copiedKey === "summary"}
              onCopy={() => void copyText("summary", s.tailoredSummary)}
            />
          ) : null}
          {s.skillsReorder.length > 0 ? (
            <CopyBlock
              title="Skills reorder"
              text={s.skillsReorder.join(" · ")}
              copied={copiedKey === "skills"}
              onCopy={() => void copyText("skills", s.skillsReorder.join(", "))}
            />
          ) : null}
          {s.coverLetter ? (
            <CopyBlock
              title="Cover letter"
              text={s.coverLetter}
              copied={copiedKey === "cover"}
              onCopy={() => void copyText("cover", s.coverLetter)}
              pre
            />
          ) : null}
          {s.fullDraft ? (
            <p className="text-sm text-[var(--muted)]">
              Looking for the full resume rewrite?{" "}
              <button
                type="button"
                onClick={() => setTab("ats")}
                className="font-medium text-[var(--accent-ink)] underline-offset-2 hover:underline"
              >
                Open ATS Resume
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "prep" ? (
        <div className="space-y-8">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="section-label">Topics to learn</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Study plan based on this JD — missing required skills first.
                </p>
              </div>
              {s.learningTopics.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      "topics",
                      s.learningTopics
                        .map(
                          (t, i) =>
                            `${i + 1}. [${t.priority}] ${t.topic}${t.why ? ` — ${t.why}` : ""}`,
                        )
                        .join("\n"),
                    )
                  }
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                >
                  {copiedKey === "topics" ? "Copied" : "Copy topics"}
                </button>
              ) : null}
            </div>
            {s.learningTopics.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No learning topics generated for this run.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {s.learningTopics.map((item, i) => (
                  <li
                    key={`topic-${i}`}
                    className="rounded-2xl border border-[var(--line)] bg-white/40 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        {item.topic}
                      </p>
                      <PriorityPill priority={item.priority} />
                    </div>
                    {item.why ? (
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        {item.why}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="section-label">Most asked interview questions</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Common questions for the skills and tech this role requires.
                </p>
              </div>
              {s.commonQuestions.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      "questions",
                      s.commonQuestions
                        .map(
                          (q, i) =>
                            `${i + 1}. (${q.skill || "General"}) ${q.question}${q.tip ? `\n   Tip: ${q.tip}` : ""}`,
                        )
                        .join("\n\n"),
                    )
                  }
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                >
                  {copiedKey === "questions" ? "Copied" : "Copy questions"}
                </button>
              ) : null}
            </div>
            {s.commonQuestions.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No interview questions generated for this run.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {s.commonQuestions.map((item, i) => (
                  <li
                    key={`q-${i}`}
                    className="rounded-2xl border border-[var(--line)] bg-white/40 px-4 py-3"
                  >
                    {item.skill ? (
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                        {item.skill}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm font-medium leading-6 text-[var(--ink)]">
                      {item.question}
                    </p>
                    {item.tip ? (
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        <span className="font-medium text-[var(--accent-ink)]">
                          Tip ·{" "}
                        </span>
                        {item.tip}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="section-label">Talking points from gaps</h3>
              {s.interviewPrep.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">No prep items.</p>
              ) : (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
                  {s.interviewPrep.map((item, i) => (
                    <li key={`prep-${i}`}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="section-label">Recruiter view</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {s.recruiterView.notes || "No recruiter notes."}
              </p>
              {s.recruiterView.indexed.length > 0 ? (
                <>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    ATS likely indexes
                  </p>
                  <p className="mt-2 text-sm">
                    {s.recruiterView.indexed.join(", ")}
                  </p>
                </>
              ) : null}
              {s.recruiterView.humanSees.length > 0 ? (
                <>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    Human notices
                  </p>
                  <p className="mt-2 text-sm">
                    {s.recruiterView.humanSees.join(", ")}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "rescore" ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--muted)]">
            Upload your revised resume or paste text to compare scores against
            the same JD keywords (no second full rewrite pass).
          </p>

          <label
            htmlFor={rescoreFileId}
            onDragOver={(e) => {
              e.preventDefault();
              setRescoreDragOver(true);
            }}
            onDragLeave={() => setRescoreDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setRescoreDragOver(false);
              acceptRevisedFile(e.dataTransfer.files?.[0] || null);
            }}
            className={`flex cursor-pointer flex-col items-start gap-1 rounded-2xl border border-dashed px-4 py-5 transition ${
              rescoreDragOver
                ? "border-[var(--accent)] bg-[var(--accent-soft)]/60"
                : "border-[var(--line)] bg-white/40 hover:border-[var(--ink)]/25"
            }`}
          >
            <span className="text-sm font-medium text-[var(--ink)]">
              {revisedFile ? revisedFile.name : "Drop revised PDF, DOCX, or TXT"}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {revisedFile
                ? formatBytes(revisedFile.size)
                : "or click to browse · max 5MB"}
            </span>
            <input
              id={rescoreFileId}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) =>
                acceptRevisedFile(e.target.files?.[0] || null)
              }
              className="sr-only"
            />
          </label>
          {revisedFile ? (
            <button
              type="button"
              onClick={() => setRevisedFile(null)}
              className="text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Clear file
            </button>
          ) : null}

          <label className="block space-y-2">
            <span className="flex items-center justify-between gap-2 text-sm font-medium text-[var(--ink)]">
              <span>Or paste revised resume text</span>
              <span className="text-xs font-normal text-[var(--muted)]">
                {revised.trim().length} chars
              </span>
            </span>
            <textarea
              value={revised}
              onChange={(e) => setRevised(e.target.value)}
              rows={10}
              placeholder="Paste revised resume text…"
              className="field-surface"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canRescore || rescoring}
              onClick={() => void runRescore()}
              className="btn-primary"
            >
              {rescoring ? "Re-scoring…" : "Compare scores"}
            </button>
            <span className="text-xs text-[var(--muted)]">
              {revisedFile
                ? `Using ${revisedFile.name}`
                : revised.trim().length > 0 && revised.trim().length < 40
                  ? "Need 40+ characters or a file"
                  : "File or pasted text"}
            </span>
          </div>
          {rescoreError ? (
            <p role="alert" className="text-sm text-[var(--danger-ink)]">
              {rescoreError}
            </p>
          ) : null}
          {rescore ? (
            <div className="animate-fade-up rounded-2xl border border-[var(--line)] bg-[var(--panel)]/80 p-5">
              <p className="text-sm uppercase tracking-[0.14em] text-[var(--muted)]">
                After edits
              </p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-3xl">
                {rescore.scores.overall}%{" "}
                {rescore.delta ? (
                  <span className="text-lg text-[var(--muted)]">
                    ({formatDelta(rescore.delta.overall)} overall)
                  </span>
                ) : null}
              </p>
              <div className="mt-3 max-w-xs">
                <div className="score-bar">
                  <span
                    style={{
                      width: `${Math.min(100, rescore.scores.overall)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-6 text-sm">
                <span>
                  Keywords {rescore.scores.keyword}%{" "}
                  {rescore.delta ? formatDelta(rescore.delta.keyword) : ""}
                </span>
                <span>
                  ATS {rescore.scores.ats}%{" "}
                  {rescore.delta ? formatDelta(rescore.delta.ats) : ""}
                </span>
                <span>
                  Sections {rescore.scores.section}%{" "}
                  {rescore.delta ? formatDelta(rescore.delta.section) : ""}
                </span>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Still missing:{" "}
                {rescore.missingRequired.length
                  ? rescore.missingRequired.join(", ")
                  : "none required"}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasUsage ? (
        <footer className="border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--muted)]">
          <p className="uppercase tracking-[0.14em]">Usage this run</p>
          <p className="mt-1.5 text-sm text-[var(--ink)]/80">
            {formatTokenCount(totalUsage.totalTokens)} tokens
            <span className="text-[var(--muted)]">
              {" "}
              ({formatTokenCount(totalUsage.promptTokens)} in ·{" "}
              {formatTokenCount(totalUsage.completionTokens)} out)
            </span>
            <span className="mx-2 text-[var(--line)]">·</span>
            Est. cost{" "}
            <span className="font-medium text-[var(--ink)]">
              {formatUsd(estimatedCostUsd)}
            </span>
            {totalUsage.calls > 0 ? (
              <span className="text-[var(--muted)]">
                {" "}
                · {totalUsage.calls} model{" "}
                {totalUsage.calls === 1 ? "call" : "calls"}
              </span>
            ) : null}
          </p>
          {result.provider === "openai" ? (
            <p className="mt-1 opacity-80">
              Approximate OpenAI list price for {result.model}. Actual billing may
              differ.
            </p>
          ) : (
            <p className="mt-1 opacity-80">
              Local Ollama run — no API charge.
            </p>
          )}
        </footer>
      ) : null}
    </section>
  );
}

function formatDelta(n: number) {
  if (n === 0) return "±0";
  return n > 0 ? `+${n}` : `${n}`;
}

function PriorityPill({
  priority,
}: {
  priority: "high" | "medium" | "low";
}) {
  const styles =
    priority === "high"
      ? "bg-[var(--warn-soft)] text-[var(--warn-ink)]"
      : priority === "medium"
        ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
        : "bg-[var(--line)] text-[var(--muted)]";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${styles}`}
    >
      {priority}
    </span>
  );
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[4.5rem] text-sm">
      <p className="text-[var(--muted)]">{label}</p>
      <p className="text-xl font-semibold">{value}%</p>
      <div className="mt-1.5 score-bar">
        <span style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function Callout({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "ok" | "warn";
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
        tone === "warn"
          ? "border-amber-300/70 bg-[var(--warn-soft)] text-[var(--warn-ink)]"
          : "border-[var(--line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 opacity-90">{body}</p>
    </div>
  );
}

function CopyBlock({
  title,
  text,
  copied,
  onCopy,
  pre,
}: {
  title: string;
  text: string;
  copied: boolean;
  onCopy: () => void;
  pre?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="section-label">{title}</h3>
        <button
          type="button"
          onClick={onCopy}
          className="btn-ghost !px-3 !py-1.5 text-xs"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {pre ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-[var(--line)] bg-[var(--panel)]/70 p-4 text-sm leading-6">
          {text}
        </pre>
      ) : (
        <p className="mt-3 text-sm leading-6">{text}</p>
      )}
    </div>
  );
}
