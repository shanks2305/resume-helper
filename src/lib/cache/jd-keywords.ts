import { createHash } from "crypto";
import type { JdKeywords } from "@/lib/schemas";

type CacheEntry = {
  keywords: JdKeywords;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

export function hashJd(jd: string): string {
  return createHash("sha256").update(jd.trim().toLowerCase()).digest("hex");
}

export function getCachedKeywords(jdHash: string): JdKeywords | null {
  const entry = cache.get(jdHash);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(jdHash);
    return null;
  }
  return entry.keywords;
}

export function setCachedKeywords(jdHash: string, keywords: JdKeywords) {
  cache.set(jdHash, { keywords, expiresAt: Date.now() + TTL_MS });
  if (cache.size > 200) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
}
