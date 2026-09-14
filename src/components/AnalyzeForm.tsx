"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ANALYZE_STEPS,
  readAnalyzeStream,
  type AnalyzeStepId,
} from "@/lib/analyze-stream";
import type { AnalysisResult, LlmProvider } from "@/lib/client-types";
import { ROLE_TEMPLATES, SAMPLE_JD, SAMPLE_RESUME } from "@/lib/samples";
import {
  addTrackerEntry,
  loadTracker,
  removeTrackerEntry,
  saveLastRun,
  type SavedRun,
  type TrackerEntry,
} from "@/lib/storage";
import { ResultsPanel } from "./ResultsPanel";

type Health = {
  defaultProvider: LlmProvider;
  openai: { configured: boolean; model: string };
  ollama: {
    ready: boolean;
    detail: string;
    baseUrl: string;
    model: string;
  };
};

type JdSlot = { id: string; label: string; text: string };

type AnalyzedJob = {
  label: string;
  jdText: string;
  result: AnalysisResult;
};

type WizardStep = "job" | "resume" | "run" | "results";

const MIN_TEXT = 40;

const WIZARD_STEPS: Array<{ id: WizardStep; label: string; short: string }> = [
  { id: "job", label: "Job", short: "1" },
  { id: "resume", label: "Resume", short: "2" },
  { id: "run", label: "Analyze", short: "3" },
  { id: "results", label: "Results", short: "4" },
];

function newSlot(label: string, text = ""): JdSlot {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    text,
  };
}

function subscribeStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function readSavedRunJson(): string | null {
  try {
    return localStorage.getItem("fitcheck:lastRun");
  } catch {
    return null;
  }
}

function readTrackerJson(): string | null {
  try {
    return localStorage.getItem("fitcheck:tracker");
  } catch {
    return null;
  }
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function stepIndex(step: WizardStep) {
  return WIZARD_STEPS.findIndex((s) => s.id === step);
}

export function AnalyzeForm() {
  const fileInputId = useId();
  const abortRef = useRef<AbortController | null>(null);

  const savedRunJson = useSyncExternalStore(
    subscribeStorage,
    readSavedRunJson,
    () => null,
  );
  const trackerJson = useSyncExternalStore(
    subscribeStorage,
    readTrackerJson,
    () => null,
  );

  const savedRun = useMemo(() => {
    if (!savedRunJson) return null;
    try {
      return JSON.parse(savedRunJson) as SavedRun;
    } catch {
      return null;
    }
  }, [savedRunJson]);

  const trackerFromStore = useMemo(() => {
    if (!trackerJson) return [] as TrackerEntry[];
    try {
      const parsed = JSON.parse(trackerJson) as TrackerEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [trackerJson]);

  const [wizardStep, setWizardStep] = useState<WizardStep>("job");
  const [jdSlots, setJdSlots] = useState<JdSlot[]>([newSlot("JD 1")]);
  const [activeJd, setActiveJd] = useState(0);
  const [resumeText, setResumeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<LlmProvider>("openai");
  const [generateAtsResume, setGenerateAtsResume] = useState(true);
  const [health, setHealth] = useState<Health | null>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<AnalyzeStepId | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState({
    current: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState<AnalyzedJob[]>([]);
  const [compareIndex, setCompareIndex] = useState(0);
  const [tracker, setTracker] = useState<TrackerEntry[]>([]);
  const [hydratedFromStorage, setHydratedFromStorage] = useState(false);
  const [trackerDraft, setTrackerDraft] = useState<{
    company: string;
    role: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showTracker, setShowTracker] = useState(false);

  useEffect(() => {
    if (hydratedFromStorage) return;
    const timer = window.setTimeout(() => {
      if (savedRun) {
        setJdSlots([newSlot("JD 1", savedRun.jd)]);
        setResumeText(savedRun.resumeText);
        setProvider(savedRun.provider);
        if (savedRun.result) {
          const result = savedRun.result as AnalysisResult;
          setAnalyzed([
            {
              label: "Last run",
              jdText: savedRun.jd,
              result,
            },
          ]);
          setWizardStep("results");
        }
      }
      setTracker(trackerFromStore.length ? trackerFromStore : loadTracker());
      setHydratedFromStorage(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [savedRun, trackerFromStore, hydratedFromStorage]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: Health) => {
        if (cancelled) return;
        setHealth(data);
        if (!savedRun) setProvider(data.defaultProvider);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [savedRun]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const restored = hydratedFromStorage && Boolean(savedRun);
  const jd = jdSlots[activeJd]?.text || "";
  const template = ROLE_TEMPLATES.find((t) => t.id === templateId);

  const jdReadyCount = jdSlots.filter(
    (s) => s.text.trim().length >= MIN_TEXT,
  ).length;
  const resumeReady = Boolean(file) || resumeText.trim().length >= MIN_TEXT;
  const canAnalyze = jdReadyCount > 0 && resumeReady && !loading;

  const currentWizardIndex = stepIndex(wizardStep);
  const canGoJob = true;
  const canGoResume = jdReadyCount > 0;
  const canGoRun = jdReadyCount > 0 && resumeReady;
  const canGoResults = analyzed.length > 0;

  function goToStep(next: WizardStep) {
    if (loading && next !== "run") return;
    if (next === "resume" && !canGoResume) return;
    if (next === "run" && !canGoRun) return;
    if (next === "results" && !canGoResults) return;
    setError(null);
    setWizardStep(next);
  }

  function loadSample() {
    setJdSlots([newSlot("Sample JD", SAMPLE_JD)]);
    setActiveJd(0);
    setResumeText(SAMPLE_RESUME);
    setFile(null);
    setTemplateId("swe");
    setError(null);
    setWizardStep("run");
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = ROLE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setJdSlots((slots) => {
      const next = [...slots];
      const current = next[activeJd];
      if (!current) return slots;
      if (current.text.trim().length < MIN_TEXT) {
        next[activeJd] = { ...current, text: t.sampleJdSnippet };
      }
      return next;
    });
  }

  function updateJdText(value: string) {
    setJdSlots((slots) =>
      slots.map((s, i) => (i === activeJd ? { ...s, text: value } : s)),
    );
  }

  function addJdSlot() {
    if (jdSlots.length >= 3) return;
    setJdSlots((slots) => [...slots, newSlot(`JD ${slots.length + 1}`)]);
    setActiveJd(jdSlots.length);
  }

  function removeJdSlot(index: number) {
    if (jdSlots.length <= 1) return;
    setJdSlots((slots) => slots.filter((_, i) => i !== index));
    setActiveJd((current) => {
      if (current === index) return Math.max(0, index - 1);
      if (current > index) return current - 1;
      return current;
    });
  }

  function acceptResumeFile(next: File | null) {
    if (!next) {
      setFile(null);
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
      setError("Use a PDF, DOCX, or TXT resume file.");
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setError("Resume file must be under 5MB.");
      return;
    }
    setError(null);
    setFile(next);
  }

  async function analyzeOne(
    jdText: string,
    signal: AbortSignal,
  ): Promise<AnalysisResult> {
    const form = new FormData();
    form.set("jd", jdText);
    form.set("resumeText", resumeText);
    form.set("provider", provider);
    form.set("generateAtsResume", generateAtsResume ? "true" : "false");
    if (file) form.set("resume", file);
    if (template) {
      form.set("templateKeywords", JSON.stringify(template.keywords));
    }

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: form,
      signal,
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("ndjson")) {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (data as { error?: string }).error || "Analysis failed.",
        );
      }
      return data as AnalysisResult;
    }

    return readAnalyzeStream(response, (event) => {
      if (event.type === "step") setActiveStep(event.step);
    });
  }

  async function startAnalyze() {
    if (!canAnalyze) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setAnalyzed([]);
    setActiveStep("parse");
    setWizardStep("run");

    const targets = jdSlots.filter((s) => s.text.trim().length >= MIN_TEXT);
    setAnalyzeProgress({ current: 0, total: targets.length });

    try {
      const collected: AnalyzedJob[] = [];
      for (let i = 0; i < targets.length; i += 1) {
        setAnalyzeProgress({ current: i + 1, total: targets.length });
        setActiveStep("parse");
        const target = targets[i];
        const result = await analyzeOne(target.text, controller.signal);
        collected.push({
          label: target.label,
          jdText: target.text,
          result,
        });
        setAnalyzed([...collected]);
        setCompareIndex(collected.length - 1);
      }

      const primary = collected[0];
      if (primary) {
        saveLastRun({
          jd: primary.jdText,
          resumeText,
          provider,
          result: primary.result,
          savedAt: new Date().toISOString(),
        });
      }

      setWizardStep("results");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Analysis cancelled.");
      } else {
        setError(err instanceof Error ? err.message : "Analysis failed.");
      }
    } finally {
      setLoading(false);
      setActiveStep(null);
      setAnalyzeProgress({ current: 0, total: 0 });
      abortRef.current = null;
    }
  }

  function cancelAnalyze() {
    abortRef.current?.abort();
  }

  function startOver() {
    abortRef.current?.abort();
    setAnalyzed([]);
    setCompareIndex(0);
    setError(null);
    setTrackerDraft(null);
    setWizardStep("job");
  }

  function openTrackerForm() {
    if (!analyzed[compareIndex]) return;
    setTrackerDraft({ company: "", role: "" });
  }

  function saveTrackerDraft() {
    const current = analyzed[compareIndex];
    if (!current || !trackerDraft) return;
    const company = trackerDraft.company.trim() || "Company";
    const role = trackerDraft.role.trim() || "Role";
    const list = addTrackerEntry({
      company,
      role,
      jdSnippet: current.jdText.slice(0, 160),
      overall: current.result.scores.overall,
      keyword: current.result.scores.keyword,
      ats: current.result.scores.ats,
    });
    setTracker(list);
    setTrackerDraft(null);
  }

  const currentResult = analyzed[compareIndex]?.result;

  const stepUnlocked: Record<WizardStep, boolean> = {
    job: canGoJob,
    resume: canGoResume,
    run: canGoRun,
    results: canGoResults,
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <nav aria-label="Progress" className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/80 p-2 sm:p-3">
        <ol className="grid grid-cols-4 gap-1 sm:gap-2">
          {WIZARD_STEPS.map((step, index) => {
            const active = step.id === wizardStep;
            const done = index < currentWizardIndex;
            const unlocked = stepUnlocked[step.id];
            return (
              <li key={step.id}>
                <button
                  type="button"
                  disabled={!unlocked || (loading && step.id !== "run")}
                  onClick={() => goToStep(step.id)}
                  className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition sm:px-2 ${
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                      : unlocked
                        ? "hover:bg-[var(--panel)] text-[var(--ink)]"
                        : "cursor-not-allowed text-[var(--muted)] opacity-50"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      active
                        ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                        : done
                          ? "bg-[var(--ink)] text-[var(--bg)]"
                          : "bg-[var(--line)] text-[var(--muted)]"
                    }`}
                  >
                    {done && !active ? "✓" : step.short}
                  </span>
                  <span className="text-[11px] font-medium sm:text-xs">
                    {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <p>
          {restored ? "Restored last browser run · " : ""}
          Analysis stays with your chosen provider.
        </p>
        <button type="button" onClick={loadSample} className="font-medium text-[var(--accent-ink)] hover:underline">
          Try sample
        </button>
      </div>

      <section
        key={wizardStep}
        className="animate-fade-up flex min-h-[min(70vh,40rem)] flex-1 flex-col rounded-3xl border border-[var(--line)] bg-[var(--panel)]/70 p-4 sm:min-h-[min(72vh,42rem)] sm:p-6 lg:p-8"
      >
        {wizardStep === "job" ? (
          <div className="flex flex-1 flex-col gap-4">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
                Paste the job description
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                LinkedIn boilerplate is cleaned automatically. Add up to 3 JDs to
                compare.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                Optional role template
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <ChipButton
                  active={!templateId}
                  onClick={() => setTemplateId("")}
                  label="None"
                />
                {ROLE_TEMPLATES.map((t) => (
                  <ChipButton
                    key={t.id}
                    active={templateId === t.id}
                    onClick={() => applyTemplate(t.id)}
                    label={t.label}
                    title={t.blurb}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {jdSlots.map((slot, i) => (
                  <div key={slot.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveJd(i)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        activeJd === i
                          ? "bg-[var(--ink)] text-[var(--bg)]"
                          : "border border-[var(--line)]"
                      }`}
                    >
                      {slot.label}
                    </button>
                    {jdSlots.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove ${slot.label}`}
                        onClick={() => removeJdSlot(i)}
                        className="text-xs text-[var(--muted)]"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                <span>{jd.trim().length} chars</span>
                <button
                  type="button"
                  onClick={addJdSlot}
                  disabled={jdSlots.length >= 3}
                  className="font-medium text-[var(--accent-ink)] disabled:opacity-40"
                >
                  + Compare
                </button>
              </div>
            </div>

            <textarea
              value={jd}
              onChange={(e) => updateJdText(e.target.value)}
              placeholder="Paste the full JD here…"
              className="field-surface min-h-[14rem] flex-1"
            />

            {jdReadyCount === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Need at least {MIN_TEXT} characters to continue.
              </p>
            ) : null}
          </div>
        ) : null}

        {wizardStep === "resume" ? (
          <div className="flex flex-1 flex-col gap-4">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
                Add your resume
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Upload a file or paste text. Nothing is stored on our servers.
              </p>
            </div>

            <label
              htmlFor={fileInputId}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                acceptResumeFile(e.dataTransfer.files?.[0] || null);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-8 text-center transition ${
                dragOver
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]/60"
                  : "border-[var(--line)] bg-white/40 hover:border-[var(--ink)]/25"
              }`}
            >
              <span className="text-sm font-medium text-[var(--ink)]">
                {file ? file.name : "Drop PDF, DOCX, or TXT"}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {file ? formatBytes(file.size) : "or click to browse · max 5MB"}
              </span>
              <input
                id={fileInputId}
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) =>
                  acceptResumeFile(e.target.files?.[0] || null)
                }
                className="sr-only"
              />
            </label>
            {file ? (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="self-start text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Clear file
              </button>
            ) : null}

            <label className="flex flex-1 flex-col gap-2">
              <span className="flex items-center justify-between text-sm font-medium text-[var(--ink)]">
                <span>Or paste resume text</span>
                <span className="text-xs font-normal text-[var(--muted)]">
                  {resumeText.trim().length} chars
                </span>
              </span>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste resume text…"
                className="field-surface min-h-[12rem] flex-1"
              />
            </label>

            {!resumeReady ? (
              <p className="text-sm text-[var(--muted)]">
                Add a file or at least {MIN_TEXT} characters to continue.
              </p>
            ) : null}
          </div>
        ) : null}

        {wizardStep === "run" ? (
          <div className="flex flex-1 flex-col gap-5">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
                {loading ? "Analyzing match…" : "Ready to analyze"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Pick a provider, then run the match.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ProviderButton
                active={provider === "openai"}
                onClick={() => setProvider("openai")}
                label="ChatGPT"
                hint={
                  health?.openai.configured
                    ? health.openai.model
                    : "set OPENAI_API_KEY"
                }
                disabled={loading}
              />
              <ProviderButton
                active={provider === "ollama"}
                onClick={() => setProvider("ollama")}
                label="Ollama"
                hint={
                  health?.ollama.ready ? health.ollama.model : "local only"
                }
                disabled={loading}
              />
            </div>

            {health && provider === "openai" && !health.openai.configured ? (
              <p className="rounded-xl bg-[var(--warn-soft)] px-3 py-2 text-sm text-[var(--warn-ink)]">
                Add OPENAI_API_KEY to .env.local before analyzing with ChatGPT.
              </p>
            ) : null}
            {health && provider === "ollama" && !health.ollama.ready ? (
              <p className="rounded-xl bg-[var(--warn-soft)] px-3 py-2 text-sm text-[var(--warn-ink)]">
                Ollama looks offline. Start it locally or switch to ChatGPT.
              </p>
            ) : null}

            <div className="rounded-2xl border border-[var(--line)] bg-white/40 px-4 py-3 text-sm">
              <p className="font-medium text-[var(--ink)]">Checklist</p>
              <ul className="mt-2 space-y-1.5 text-[var(--muted)]">
                <li>
                  {jdReadyCount} job description{jdReadyCount === 1 ? "" : "s"}{" "}
                  ready
                  {template ? ` · template: ${template.label}` : ""}
                </li>
                <li>
                  Resume:{" "}
                  {file
                    ? file.name
                    : `${resumeText.trim().length} pasted characters`}
                </li>
                <li>Provider: {provider === "openai" ? "ChatGPT" : "Ollama"}</li>
              </ul>
            </div>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                generateAtsResume
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]/50"
                  : "border-[var(--line)] bg-white/40 hover:border-[var(--ink)]/25"
              }`}
            >
              <input
                type="checkbox"
                checked={generateAtsResume}
                disabled={loading}
                onChange={(e) => setGenerateAtsResume(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--ink)]">
                  Generate ATS-friendly resume
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">
                  Rewrite your resume for this JD — plain text, keyword-aware,
                  no invented experience. You can also generate later from
                  Results.
                </span>
              </span>
            </label>

            {loading && activeStep ? (
              <ProgressSteps
                activeStep={activeStep}
                progress={analyzeProgress}
                onCancel={cancelAnalyze}
              />
            ) : null}

            {error ? (
              <p
                role="alert"
                className="rounded-2xl border border-red-300/70 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-ink)]"
              >
                {error}
              </p>
            ) : null}

            {!loading ? (
              <button
                type="button"
                disabled={!canAnalyze}
                onClick={() => void startAnalyze()}
                className="btn-primary mt-auto w-full sm:w-auto sm:self-start"
              >
                {jdReadyCount > 1
                  ? `Analyze ${jdReadyCount} JDs`
                  : "Analyze match"}
              </button>
            ) : null}
          </div>
        ) : null}

        {wizardStep === "results" && currentResult ? (
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
                  Your results
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Browse tabs below — or start a new match anytime.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={startOver} className="btn-ghost">
                  New match
                </button>
                {tracker.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowTracker((v) => !v)}
                    className="btn-ghost"
                  >
                    {showTracker ? "Hide tracker" : "Tracker"}
                  </button>
                ) : null}
              </div>
            </div>

            {showTracker && tracker.length > 0 ? (
              <ul className="space-y-2">
                {tracker.slice(0, 6).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white/40 px-3 py-2 text-sm"
                  >
                    <span>
                      {entry.company} · {entry.role} · {entry.overall}%
                    </span>
                    <button
                      type="button"
                      className="text-xs text-[var(--muted)]"
                      onClick={() => setTracker(removeTrackerEntry(entry.id))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {analyzed.length > 1 ? (
              <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/50 text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">JD</th>
                      <th className="px-3 py-2 font-medium">Overall</th>
                      <th className="px-3 py-2 font-medium">Keywords</th>
                      <th className="px-3 py-2 font-medium">ATS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyzed.map((job, i) => (
                      <tr
                        key={`${job.result.jdHash}-${i}`}
                        className={`cursor-pointer border-t border-[var(--line)] ${
                          compareIndex === i ? "bg-[var(--accent-soft)]" : ""
                        }`}
                        onClick={() => setCompareIndex(i)}
                      >
                        <td className="px-3 py-2 font-medium">{job.label}</td>
                        <td className="px-3 py-2 font-semibold">
                          {job.result.scores.overall}%
                        </td>
                        <td className="px-3 py-2">{job.result.scores.keyword}%</td>
                        <td className="px-3 py-2">{job.result.scores.ats}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {trackerDraft ? (
              <div className="rounded-2xl border border-[var(--line)] bg-white/50 p-4">
                <p className="text-sm font-medium">Save to tracker</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    value={trackerDraft.company}
                    onChange={(e) =>
                      setTrackerDraft({
                        ...trackerDraft,
                        company: e.target.value,
                      })
                    }
                    placeholder="Company"
                    className="field-surface"
                    autoFocus
                  />
                  <input
                    value={trackerDraft.role}
                    onChange={(e) =>
                      setTrackerDraft({
                        ...trackerDraft,
                        role: e.target.value,
                      })
                    }
                    placeholder="Role title"
                    className="field-surface"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={saveTrackerDraft}
                    className="btn-primary"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackerDraft(null)}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <ResultsPanel
              key={`${currentResult.jdHash}-${compareIndex}`}
              result={currentResult}
              jdText={analyzed[compareIndex]?.jdText || ""}
              resumeText={resumeText}
              resumeFile={file}
              provider={provider}
              onSaveTracker={openTrackerForm}
              onDraftUpdated={(draft, structured) => {
                setAnalyzed((jobs) => {
                  const next = jobs.map((job, i) =>
                    i === compareIndex
                      ? {
                          ...job,
                          result: {
                            ...job.result,
                            suggestions: {
                              ...job.result.suggestions,
                              fullDraft: draft,
                              ...(structured
                                ? { structuredResume: structured }
                                : {}),
                            },
                          },
                        }
                      : job,
                  );
                  const primary = next[compareIndex];
                  if (primary) {
                    saveLastRun({
                      jd: primary.jdText,
                      resumeText,
                      provider,
                      result: primary.result,
                      savedAt: new Date().toISOString(),
                    });
                  }
                  return next;
                });
              }}
              compact
            />
          </div>
        ) : null}

        {wizardStep === "results" && !currentResult ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-3">
            <p className="text-[var(--muted)]">No results yet.</p>
            <button type="button" onClick={() => goToStep("job")} className="btn-primary">
              Start with a job description
            </button>
          </div>
        ) : null}
      </section>

      {wizardStep !== "results" ? (
        <div className="sticky bottom-3 z-10 flex gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/95 p-2 shadow-[0_8px_30px_rgba(20,36,28,0.08)] backdrop-blur">
          <button
            type="button"
            className="btn-ghost flex-1"
            disabled={currentWizardIndex === 0 || loading}
            onClick={() => {
              const prev = WIZARD_STEPS[currentWizardIndex - 1];
              if (prev) goToStep(prev.id);
            }}
          >
            Back
          </button>
          {wizardStep === "run" ? (
            <button
              type="button"
              className="btn-primary flex-[1.4]"
              disabled={!loading && !canAnalyze}
              onClick={() => {
                if (loading) cancelAnalyze();
                else void startAnalyze();
              }}
            >
              {loading
                ? "Cancel"
                : jdReadyCount > 1
                  ? `Analyze ${jdReadyCount}`
                  : "Analyze"}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary flex-[1.4]"
              disabled={
                (wizardStep === "job" && !canGoResume) ||
                (wizardStep === "resume" && !canGoRun)
              }
              onClick={() => {
                if (wizardStep === "job") goToStep("resume");
                else if (wizardStep === "resume") goToStep("run");
              }}
            >
              Continue
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
          : "border-[var(--line)] hover:border-[var(--ink)]/25"
      }`}
    >
      {label}
    </button>
  );
}

function ProgressSteps({
  activeStep,
  progress,
  onCancel,
}: {
  activeStep: AnalyzeStepId;
  progress: { current: number; total: number };
  onCancel: () => void;
}) {
  const activeIndex = ANALYZE_STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div
      className="rounded-2xl border border-[var(--line)] bg-white/50 px-4 py-4"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--ink)]">
          Working
          {progress.total > 1
            ? ` · JD ${progress.current} of ${progress.total}`
            : ""}
          …
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost !px-3 !py-1.5 text-xs"
        >
          Cancel
        </button>
      </div>
      <ol className="mt-3 space-y-2">
        {ANALYZE_STEPS.map((step, index) => {
          const done = index < activeIndex;
          const current = index === activeIndex;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-3 text-sm ${
                current
                  ? "animate-pulse-soft font-medium text-[var(--ink)]"
                  : done
                    ? "text-[var(--accent-ink)]"
                    : "text-[var(--muted)]"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  current
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : done
                      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                      : "bg-[var(--line)] text-[var(--muted)]"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span>
                {step.label}
                {current ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ProviderButton({
  active,
  onClick,
  label,
  hint,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-2xl border px-4 py-3 text-left transition disabled:opacity-50 ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--line)] bg-white/40 hover:border-[var(--ink)]/20"
      }`}
    >
      <span className="block text-sm font-semibold text-[var(--ink)]">
        {label}
      </span>
      <span className="block text-xs text-[var(--muted)]">{hint}</span>
    </button>
  );
}
