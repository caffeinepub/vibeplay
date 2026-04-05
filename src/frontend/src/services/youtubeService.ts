/**
 * YouTube service utilities — official audio search and track enrichment.
 * Re-exports key utilities from constants for convenience.
 */
import {
  YOUTUBE_API_BASE,
  fetchWithKeyFallback,
  parseYouTubeError,
} from "../constants";
import type { Track } from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";
import { findBestYouTubeMatch } from "../utils/youtubeMatchEngine";

// Re-export for consumers that only need YouTube utilities
export { YOUTUBE_API_BASE, fetchWithKeyFallback };

/**
 * Builds a YouTube search query optimised for finding official audio uploads.
 * Format: "Song Name Artist Name official audio"
 */
export function buildOfficialAudioQuery(
  songName: string,
  artistName: string,
): string {
  const name = songName.trim();
  const artist = artistName.trim();
  if (!artist) return `${name} official audio`;
  return `${name} ${artist} official audio`;
}

/**
 * Search YouTube for the best official audio match for a song.
 * Uses the intelligent scoring engine: fetches 15 results, scores each,
 * rejects blocked keywords, returns the best match's videoId.
 * Returns null on failure.
 */
export async function searchYouTubeForTrack(
  songName: string,
  artistName: string,
  durationMs?: number,
): Promise<string | null> {
  // Try the match engine first (smarter, scored)
  const match = await findBestYouTubeMatch(songName, artistName, durationMs);
  if (match) return match.videoId;

  // Fallback: simple first-result search (for quick resolves)
  const query = buildOfficialAudioQuery(songName, artistName);
  try {
    const res = await fetchWithKeyFallback((key) => {
      const url = new URL(`${YOUTUBE_API_BASE}/search`);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("videoCategoryId", "10");
      url.searchParams.set("maxResults", "3");
      url.searchParams.set("key", key);
      return url.toString();
    });
    if (!res.ok) return null;
    const data = await res.json();
    const firstItem = data.items?.[0];
    return firstItem?.id?.videoId ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves a Spotify or Last.fm track to a playable YouTube videoId.
 * For tracks that already have a YouTube ID (source='youtube' or no source), returns as-is.
 * Called from App.tsx handlePlay before handing off to the YouTube player.
 */
export async function resolveTrackForPlayback(track: Track): Promise<Track> {
  // Already a YouTube track — nothing to resolve
  if (!track.source || track.source === "youtube") return track;

  // Check if the ID is already a valid YouTube videoId
  // YouTube IDs are 11 chars; Spotify IDs are 22 chars; lastfm_ IDs start with "lastfm_"
  if (track.id && !track.id.startsWith("lastfm_") && track.id.length === 11) {
    return track;
  }

  const songName = track.title;
  const artistName = track.artist ?? track.channelName;

  // Check cache for previously resolved ID
  const ck = cacheKey("yt_resolve", songName, artistName);
  const cachedId = cacheGet<string>(ck);
  if (cachedId) {
    return { ...track, id: cachedId };
  }

  // Use match engine for best result
  const videoId = await searchYouTubeForTrack(songName, artistName);
  if (!videoId) {
    return track;
  }

  cacheSet(ck, videoId);
  return { ...track, id: videoId };
}

/**
 * Enriches an array of Spotify/Last.fm tracks by fetching their YouTube videoIds.
 * Processes in batches of up to 5 with a 50ms delay between calls to respect quota.
 * Tracks that can't be resolved are excluded from the output.
 */
export async function enrichTracksWithYouTubeIds(
  tracks: Track[],
): Promise<Track[]> {
  const toEnrich = tracks.filter(
    (t) =>
      t.source === "spotify" ||
      t.source === "lastfm" ||
      t.id.startsWith("lastfm_"),
  );

  if (toEnrich.length === 0) return tracks;

  const enriched: Track[] = [];
  const batchSize = 5;

  for (let i = 0; i < Math.min(toEnrich.length, batchSize); i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const track = toEnrich[i];
    const artistName = track.artist ?? track.channelName;
    const ck = cacheKey("yt_resolve", track.title, artistName);

    const cachedId = cacheGet<string>(ck);
    if (cachedId) {
      enriched.push({ ...track, id: cachedId });
      continue;
    }

    const videoId = await searchYouTubeForTrack(track.title, artistName);
    if (videoId) {
      cacheSet(ck, videoId);
      enriched.push({ ...track, id: videoId });
    }
  }

  // Return enriched + already-YouTube tracks
  const ytTracks = tracks.filter(
    (t) => t.source === "youtube" || (!t.source && !t.id.startsWith("lastfm_")),
  );
  return [...ytTracks, ...enriched];
}

// Keep parseYouTubeError accessible for consumers
export { parseYouTubeError };
