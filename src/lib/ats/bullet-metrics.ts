export type BulletMetricTip = {
  original: string;
  issue: string;
  tip: string;
};

const BULLET_RE = /(?:^|\n)\s*(?:[•●▪◦*-]|\d+[.)])\s+(.+)/g;

function hasMetric(text: string): boolean {
  return /(\d+\s*%|\$\s*\d|\d+\s*[xX]|(\d+\+?\s*(users|customers|people|engineers|teams|days|weeks|months|years|hrs|hours|prs?|tickets|requests|qps|latency|ms|slo)))\b/i.test(
    text,
  );
}

/** Flag bullets that lack measurable outcomes. */
export function findUnquantifiedBullets(
  resumeText: string,
  limit = 5,
): BulletMetricTip[] {
  const tips: BulletMetricTip[] = [];
  for (const match of resumeText.matchAll(BULLET_RE)) {
    const original = (match[1] || "").trim();
    if (original.length < 28) continue;
    if (hasMetric(original)) continue;
    tips.push({
      original,
      issue: "No clear metric",
      tip: "Add a truthful number (%, time saved, scale, revenue, latency, team size) if you have one.",
    });
    if (tips.length >= limit) break;
  }
  return tips;
}
