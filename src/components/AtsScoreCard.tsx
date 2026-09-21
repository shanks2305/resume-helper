"use client";

import type { AnalysisResult } from "@/lib/client-types";
import { scoreResumeAgainstKeywords } from "@/lib/ats/analyze-core";

type Scored = ReturnType<typeof scoreResumeAgainstKeywords>;

export function AtsScoreCard({
  scored,
  original,
}: {
  scored: Scored;
  original?: AnalysisResult["scores"];
}) {
  const d = original
    ? {
        overall: scored.scores.overall - original.overall,
        keyword: scored.scores.keyword - original.keyword,
        ats: scored.scores.ats - original.ats,
        section: scored.scores.section - original.section,
      }
    : null;

  function delta(n: number) {
    if (n === 0) return "0";
    return n > 0 ? `+${n}` : String(n);
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm">
      <p className="font-medium">
        ATS resume vs this JD: {scored.scores.overall}% overall
        {d ? (
          <span className="ml-2 font-normal text-[var(--muted)]">
            ({delta(d.overall)} vs original)
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        keywords {scored.scores.keyword}%
        {d ? ` (${delta(d.keyword)})` : ""} · ATS {scored.scores.ats}%
        {d ? ` (${delta(d.ats)})` : ""} · sections {scored.scores.section}%
        {d ? ` (${delta(d.section)})` : ""}
      </p>
      {scored.missingRequired.length > 0 ? (
        <p className="mt-2 text-xs text-[var(--warn-ink)]">
          Missing required: {scored.missingRequired.join(", ")}
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted)]">
          All required keywords from this JD that the scorer can match are present.
        </p>
      )}
      {scored.missingPreferred.length > 0 ? (
        <p className="mt-1 text-xs text-[var(--muted)]">
          Still missing preferred/tools: {scored.missingPreferred.slice(0, 12).join(", ")}
          {scored.missingPreferred.length > 12 ? "…" : ""}
        </p>
      ) : null}
    </div>
  );
}
