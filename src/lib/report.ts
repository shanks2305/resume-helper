import type { AnalysisResult } from "@/lib/client-types";

export function buildMarkdownReport(result: AnalysisResult): string {
  const found = result.matches.filter((m) => m.found);
  const missing = result.matches.filter((m) => !m.found);
  const s = result.suggestions;

  const lines: string[] = [
    "# FitCheck Match Report",
    "",
    `**Overall match:** ${result.scores.overall}%`,
    "",
    `| Area | Score |`,
    `| --- | --- |`,
    `| Keywords | ${result.scores.keyword}% |`,
    `| ATS format | ${result.scores.ats}% |`,
    `| Sections | ${result.scores.section}% |`,
    "",
    `_Provider: ${result.provider}/${result.model}_`,
    "",
    "## Summary",
    "",
    s.summary,
    "",
  ];

  if (s.priorities.length > 0) {
    lines.push("## Top priorities", "");
    for (const [i, item] of s.priorities.entries()) {
      lines.push(`${i + 1}. ${item}`);
    }
    lines.push("");
  }

  if (s.tailoredSummary) {
    lines.push("## Tailored summary", "", s.tailoredSummary, "");
  }

  if (s.skillsReorder.length > 0) {
    lines.push("## Skills reorder", "", s.skillsReorder.join(", "), "");
  }

  lines.push("## Missing keywords", "");
  if (missing.length === 0) {
    lines.push("No major keyword gaps detected.", "");
  } else {
    for (const m of missing) {
      lines.push(
        `- **${m.term}** (${m.category}${m.importance ? `, ${m.importance}` : ""})`,
      );
    }
    lines.push("");
  }

  if (found.length > 0) {
    lines.push("## Found in resume", "");
    lines.push(found.map((m) => m.term).join(", "), "");
  }

  if (result.keywordLocations?.length) {
    lines.push("## Keyword locations", "");
    for (const loc of result.keywordLocations) {
      lines.push(`- **${loc.term}** · ${loc.section}: ${loc.snippet}`);
    }
    lines.push("");
  }

  if (result.seniority) {
    lines.push("## Seniority", "", result.seniority.detail, "");
  }

  if (result.bulletTips?.length) {
    lines.push("## Bullets needing metrics", "");
    for (const tip of result.bulletTips) {
      lines.push(`- ${tip.original} — ${tip.tip}`);
    }
    lines.push("");
  }

  lines.push("## ATS checklist", "");
  for (const check of result.atsChecks) {
    const mark = check.passed ? "Pass" : "Fix";
    lines.push(`- **${mark}** · ${check.label} — ${check.detail}`);
  }
  lines.push("");

  if (s.suggestions.length > 0) {
    lines.push("## Suggested rewrites", "");
    for (const [i, item] of s.suggestions.entries()) {
      lines.push(`### Rewrite ${i + 1}`, "", "**Before**", "", item.original, "");
      lines.push("**After**", "", item.revised, "");
      if (item.rationale) lines.push(`_Rationale:_ ${item.rationale}`, "");
      if (item.keywordsAdded.length > 0) {
        lines.push(`_Keywords:_ ${item.keywordsAdded.join(", ")}`, "");
      }
    }
  }

  if (s.fullDraft) {
    lines.push("## Full ATS draft", "", s.fullDraft, "");
  }
  if (s.coverLetter) {
    lines.push("## Cover letter", "", s.coverLetter, "");
  }
  if (s.interviewPrep.length > 0) {
    lines.push("## Interview prep", "");
    for (const item of s.interviewPrep) lines.push(`- ${item}`);
    lines.push("");
  }
  if (s.learningTopics?.length) {
    lines.push("## Topics to learn", "");
    for (const item of s.learningTopics) {
      lines.push(
        `- **[${item.priority}] ${item.topic}**${item.why ? ` — ${item.why}` : ""}`,
      );
    }
    lines.push("");
  }
  if (s.commonQuestions?.length) {
    lines.push("## Most asked interview questions", "");
    for (const item of s.commonQuestions) {
      lines.push(
        `- **(${item.skill || "General"})** ${item.question}${item.tip ? `\n  - Tip: ${item.tip}` : ""}`,
      );
    }
    lines.push("");
  }
  if (s.recruiterView?.notes || s.recruiterView?.indexed?.length) {
    lines.push("## Recruiter view", "");
    if (s.recruiterView.notes) lines.push(s.recruiterView.notes, "");
    if (s.recruiterView.indexed.length) {
      lines.push(`Indexed: ${s.recruiterView.indexed.join(", ")}`, "");
    }
    if (s.recruiterView.humanSees.length) {
      lines.push(`Human sees: ${s.recruiterView.humanSees.join(", ")}`, "");
    }
  }

  if (result.usage && (result.usage.calls > 0 || result.usage.totalTokens > 0)) {
    const cost =
      result.usage.estimatedCostUsd == null
        ? "—"
        : result.usage.estimatedCostUsd === 0
          ? "$0.00"
          : result.usage.estimatedCostUsd < 0.01
            ? `$${result.usage.estimatedCostUsd.toFixed(4)}`
            : `$${result.usage.estimatedCostUsd.toFixed(3)}`;
    lines.push(
      "## Usage",
      "",
      `- Tokens: ${result.usage.totalTokens.toLocaleString("en-US")} (${result.usage.promptTokens.toLocaleString("en-US")} in · ${result.usage.completionTokens.toLocaleString("en-US")} out)`,
      `- Model calls: ${result.usage.calls}`,
      `- Estimated cost: ${cost}`,
      "",
    );
  }

  return lines.join("\n");
}

export function downloadTextFile(
  filename: string,
  contents: string,
  mime = "text/markdown;charset=utf-8",
) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
