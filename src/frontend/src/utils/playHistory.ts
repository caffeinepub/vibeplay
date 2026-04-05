/**
 * Play history manager — maintains a rolling list of the last 10 played songs.
 * Used by useRelatedTracks to exclude recently played songs from recommendations.
 */

const LS_PLAY_HISTORY = "vibeplay_up_next_history";
const MAX_HISTORY = 10;

export interface PlayHistoryEntry {
  id: string; // YouTube video ID
  title: string;
  artist: string; // channelName or artist
  addedAt: number;
}

export function getPlayHistory(): PlayHistoryEntry[] {
  try {
    const raw = localStorage.getItem(LS_PLAY_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw) as PlayHistoryEntry[];
  } catch {
    return [];
  }
}

export function addToPlayHistory(entry: PlayHistoryEntry): void {
  try {
    const history = getPlayHistory();
    // Remove existing entry for same track if present
    const filtered = history.filter((h) => h.id !== entry.id);
    // Add to front
    const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
    localStorage.setItem(LS_PLAY_HISTORY, JSON.stringify(updated));
  } catch {
    // localStorage full — silently skip
  }
}

/**
 * Returns a Set of normalized "trackName|artist" keys from history.
 * Used for deduplication by name (catches same song with different YT IDs).
 */
export function getHistoryDedupKeys(): Set<string> {
  const history = getPlayHistory();
  const keys = new Set<string>();
  for (const entry of history) {
    keys.add(normalizeKey(entry.title, entry.artist));
    // Also add the raw video ID
    keys.add(entry.id);
  }
  return keys;
}

/**
 * Returns a Set of video IDs from play history.
 */
export function getHistoryVideoIds(): Set<string> {
  const history = getPlayHistory();
  return new Set(history.map((h) => h.id));
}

/**
 * Normalizes a song title + artist into a dedup key.
 * Strips version keywords, lowercases, trims.
 */
export function normalizeKey(title: string, artist: string): string {
  const cleanTitle = title
    .toLowerCase()
    .replace(
      /\b(remix|slowed|lofi|lo-fi|reverb|edit|cover|sped up|nightcore|bass boosted|acoustic|unplugged|reprise|remaster|remastered|version|ver\.|instrumental|karaoke|extended|radio edit|official|audio|video|hd|hq|lyrics|full|feat|ft)\b/gi,
      "",
    )
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const cleanArtist = artist
    .toLowerCase()
    .replace(/vevo|records|music|official|channel/gi, "")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(" ");
  return `${cleanArtist}|${cleanTitle}`;
}
