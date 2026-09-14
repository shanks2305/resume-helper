export type TrackerEntry = {
  id: string;
  company: string;
  role: string;
  jdSnippet: string;
  overall: number;
  keyword: number;
  ats: number;
  createdAt: string;
};

export type SavedRun = {
  jd: string;
  resumeText: string;
  provider: "openai" | "ollama";
  result: unknown;
  savedAt: string;
};

const RUN_KEY = "fitcheck:lastRun";
const TRACKER_KEY = "fitcheck:tracker";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadLastRun(): SavedRun | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedRun;
  } catch {
    return null;
  }
}

export function saveLastRun(run: SavedRun) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    /* quota */
  }
}

export function loadTracker(): TrackerEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(TRACKER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrackerEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTracker(entries: TrackerEntry[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(TRACKER_KEY, JSON.stringify(entries.slice(0, 40)));
  } catch {
    /* quota */
  }
}

export function addTrackerEntry(
  entry: Omit<TrackerEntry, "id" | "createdAt">,
): TrackerEntry[] {
  const next: TrackerEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const list = [next, ...loadTracker()];
  saveTracker(list);
  return list;
}

export function removeTrackerEntry(id: string): TrackerEntry[] {
  const list = loadTracker().filter((e) => e.id !== id);
  saveTracker(list);
  return list;
}
