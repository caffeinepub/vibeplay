import type { Track } from "../types";

/**
 * Simple fuzzy search implementation (no external library).
 * Matches when query characters appear in order within the target string.
 * Falls back to substring match for shorter queries.
 */
function fuzzyScore(target: string, query: string): number {
  const t = target.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 1.0;
  if (t.startsWith(q)) return 0.9;
  if (t.includes(q)) return 0.7;

  // Character-order fuzzy match
  let ti = 0;
  let qi = 0;
  let matches = 0;
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      matches++;
      qi++;
    }
    ti++;
  }
  if (qi < q.length) return 0; // not all chars matched
  return (matches / t.length) * 0.6;
}

export function fuzzySearch(
  tracks: Track[],
  query: string,
  threshold = 0.4,
): Track[] {
  if (!query.trim() || tracks.length === 0) return tracks;
  const scored = tracks
    .map((track) => {
      const titleScore = fuzzyScore(track.title, query) * 0.7;
      const channelScore = fuzzyScore(track.channelName, query) * 0.3;
      return { track, score: titleScore + channelScore };
    })
    .filter((r) => r.score >= threshold * 0.5);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((r) => r.track);
}
