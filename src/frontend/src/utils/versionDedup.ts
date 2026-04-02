import type { Track } from "../types";
import { cleanTitleForComparison } from "./searchRanker";

/**
 * Removes duplicate song versions (remix, slowed, lofi, etc.)
 * Keeps the first occurrence of each unique base title per artist.
 */
export function deduplicateVersions(tracks: Track[]): Track[] {
  const seen = new Map<string, boolean>();
  return tracks.filter((track) => {
    const baseTitle = cleanTitleForComparison(track.title);
    const artist = track.channelName
      .toLowerCase()
      .replace(/vevo|records|music|official|channel/gi, "")
      .trim()
      .split(" ")
      .slice(0, 2)
      .join(" ");
    const key = `${artist}||${baseTitle}`;
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

/**
 * Enforces max N songs per artist in a list.
 */
export function enforceArtistDiversity(
  tracks: Track[],
  maxPerArtist = 2,
): Track[] {
  const artistCount = new Map<string, number>();
  return tracks.filter((track) => {
    const artist = track.channelName.toLowerCase().trim();
    const count = artistCount.get(artist) ?? 0;
    if (count >= maxPerArtist) return false;
    artistCount.set(artist, count + 1);
    return true;
  });
}

/**
 * Shuffle an array (Fisher-Yates). Returns new array.
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Split into 70% "similar" + 30% "exploration" from a pool of other tracks.
 * Returns merged, shuffled array.
 */
export function applyExplorationFactor(
  similar: Track[],
  explorationPool: Track[],
  total: number,
  explorationRatio = 0.3,
): Track[] {
  const exploreCount = Math.floor(total * explorationRatio);
  const similarCount = total - exploreCount;

  const similarSlice = similar.slice(0, similarCount);
  const explorationSlice = shuffleArray(
    explorationPool.filter((t) => !similar.some((s) => s.id === t.id)),
  ).slice(0, exploreCount);

  return shuffleArray([...similarSlice, ...explorationSlice]);
}
