const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`vp_cache_${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`vp_cache_${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    localStorage.setItem(`vp_cache_${key}`, JSON.stringify(entry));
  } catch {
    // localStorage quota exceeded — silently skip caching
  }
}

export function cacheKey(...parts: string[]): string {
  return parts
    .join("|")
    .replace(/[^a-zA-Z0-9|_-]/g, "_")
    .slice(0, 200);
}
