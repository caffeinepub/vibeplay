/**
 * useSmartSearch — Spotify-enriched search hook.
 * Drop-in replacement for useYouTubeSearch with the same returned interface.
 *
 * Search flow:
 * 1. Try Spotify for rich metadata (album art, artist info)
 * 2. Run standard YouTube search in parallel
 * 3. Merge: Spotify tracks (with YouTube videoIds) come first
 * 4. Fall back gracefully to YouTube-only if Spotify is unavailable
 */
import { useCallback, useState } from "react";
import {
  MAX_SEARCH_RESULTS,
  YOUTUBE_API_BASE,
  YOUTUBE_API_KEY,
  fetchWithKeyFallback,
  parseYouTubeError,
} from "../constants";
import { MOCK_TRACKS } from "../data/mockData";
import {
  type SpotifyTrack,
  searchSpotify,
  spotifyTrackToTrack,
} from "../services/spotifyService";
import { buildOfficialAudioQuery } from "../services/youtubeService";
import type { Track } from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";
import { fuzzySearch } from "../utils/fuzzySearch";
import { rankSearchResults } from "../utils/searchRanker";
import { deduplicateVersions } from "../utils/versionDedup";

const IS_DEMO = !YOUTUBE_API_KEY || YOUTUBE_API_KEY.includes("placeholder");

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";
  const h = Number.parseInt(match[1] || "0");
  const m = Number.parseInt(match[2] || "0");
  const s = Number.parseInt(match[3] || "0");
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type RawVideoItem = {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { medium: { url: string } };
    tags?: string[];
  };
  contentDetails: { duration: string };
  statistics: { viewCount: string };
};

function toTrack(item: RawVideoItem): Track {
  return {
    id: item.id,
    title: item.snippet.title,
    channelName: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.medium.url,
    duration: parseDuration(item.contentDetails.duration),
    viewCount: item.statistics.viewCount,
    tags: item.snippet.tags,
    source: "youtube",
  };
}

async function fetchVideoDetails(ids: string[]): Promise<RawVideoItem[]> {
  if (ids.length === 0) return [];
  const res = await fetchWithKeyFallback((key) => {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set("part", "contentDetails,snippet,statistics");
    url.searchParams.set("id", ids.join(","));
    url.searchParams.set("key", key);
    return url.toString();
  });
  if (!res.ok) throw new Error(await parseYouTubeError(res));
  const data = await res.json();
  return data.items as RawVideoItem[];
}

/**
 * Search YouTube for the videoId matching a Spotify track.
 * Returns null on failure.
 */
async function resolveSpotifyVideoId(st: SpotifyTrack): Promise<string | null> {
  const query = buildOfficialAudioQuery(st.name, st.artists[0]?.name ?? "");
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
    return data.items?.[0]?.id?.videoId ?? null;
  } catch {
    return null;
  }
}

/**
 * Merge Spotify and YouTube results, deduplicating by title similarity.
 * Spotify tracks (enriched with YouTube IDs) come first.
 */
function mergeAndDedupe(
  spotifyTracks: Track[],
  youtubeTracks: Track[],
): Track[] {
  const merged: Track[] = [...spotifyTracks];
  const spotifyTitles = new Set(
    spotifyTracks.map((t) => t.title.toLowerCase().trim()),
  );

  for (const yt of youtubeTracks) {
    const ytTitle = yt.title.toLowerCase().trim();
    // Skip if very similar title already exists from Spotify
    const isDuplicate = Array.from(spotifyTitles).some(
      (st) =>
        ytTitle.includes(st.slice(0, 15)) || st.includes(ytTitle.slice(0, 15)),
    );
    if (!isDuplicate) {
      merged.push(yt);
      spotifyTitles.add(ytTitle);
    }
  }

  return merged;
}

export function useSmartSearch() {
  const [results, setResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [hasSpotifyResults, setHasSpotifyResults] = useState(false);
  const [hasVibeResults, setHasVibeResults] = useState(false);
  const [isFuzzyResult, setIsFuzzyResult] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLastQuery(query);
    setIsLoading(true);
    setError(null);
    setHasSpotifyResults(false);
    setHasVibeResults(false);
    setIsFuzzyResult(false);

    if (IS_DEMO) {
      await new Promise((r) => setTimeout(r, 600));
      const filtered = MOCK_TRACKS.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.channelName.toLowerCase().includes(query.toLowerCase()),
      );
      const demoResults = filtered.length > 0 ? filtered : MOCK_TRACKS;
      const ranked = rankSearchResults(demoResults, query);
      const deduped = deduplicateVersions(ranked);
      setResults(deduped);
      setIsLoading(false);
      return;
    }

    // Check full cache first (smart_search key includes both Spotify + YouTube)
    const ck = cacheKey("smart_search", query.trim().toLowerCase());
    const cached = cacheGet<{
      tracks: Track[];
      hasSpotify: boolean;
      hasVibe: boolean;
    }>(ck);
    if (cached) {
      setResults(cached.tracks);
      setHasSpotifyResults(cached.hasSpotify);
      setHasVibeResults(cached.hasVibe);
      setIsLoading(false);
      return;
    }

    try {
      // Run Spotify search + YouTube search in parallel
      const [spotifyRaw, youtubeSearchRes] = await Promise.allSettled([
        searchSpotify(query),
        fetchWithKeyFallback((key) => {
          const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
          searchUrl.searchParams.set("part", "snippet");
          searchUrl.searchParams.set("q", query);
          searchUrl.searchParams.set("type", "video");
          searchUrl.searchParams.set(
            "maxResults",
            MAX_SEARCH_RESULTS.toString(),
          );
          searchUrl.searchParams.set("videoCategoryId", "10");
          searchUrl.searchParams.set("key", key);
          return searchUrl.toString();
        }),
      ]);

      // ─── Process Spotify results ───────────────────────────────────────────
      const rawSpotifyTracks: SpotifyTrack[] =
        spotifyRaw.status === "fulfilled" ? spotifyRaw.value.slice(0, 5) : [];

      // Resolve YouTube videoIds for top Spotify tracks
      const spotifyTracksWithYt: Track[] = [];
      for (const st of rawSpotifyTracks) {
        const videoId = await resolveSpotifyVideoId(st);
        if (videoId) {
          const track = spotifyTrackToTrack(st);
          spotifyTracksWithYt.push({ ...track, id: videoId });
        }
      }
      const hasSpotify = spotifyTracksWithYt.length > 0;

      // ─── Process YouTube results ───────────────────────────────────────────
      let youtubeTracks: Track[] = [];
      let vibeTracks: Track[] = [];
      let hasVibe = false;

      if (
        youtubeSearchRes.status === "fulfilled" &&
        youtubeSearchRes.value.ok
      ) {
        const searchData = await youtubeSearchRes.value.json();
        const videoIds: string[] = searchData.items.map(
          (item: { id: { videoId: string } }) => item.id.videoId,
        );
        const nameItems = await fetchVideoDetails(videoIds);
        youtubeTracks = nameItems.map(toTrack);

        // Vibe tag search for additional related results
        const seenIds = new Set(youtubeTracks.map((t) => t.id));
        try {
          const topItems = nameItems.slice(0, 3);
          const allTags: string[] = [];
          const queryWords = query.toLowerCase().split(/\s+/);

          for (const item of topItems) {
            const tags = item.snippet.tags ?? [];
            for (const tag of tags) {
              const t = tag.toLowerCase().trim();
              if (
                t.length > 1 &&
                t.length < 30 &&
                !queryWords.some((w) => t.includes(w)) &&
                !allTags.includes(t)
              ) {
                allTags.push(t);
                if (allTags.length >= 5) break;
              }
            }
            if (allTags.length >= 5) break;
          }

          if (allTags.length > 0) {
            const vibeQuery = allTags.slice(0, 5).join(" ");
            const vibeSearchRes = await fetchWithKeyFallback((key) => {
              const vibeSearchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
              vibeSearchUrl.searchParams.set("part", "snippet");
              vibeSearchUrl.searchParams.set("q", vibeQuery);
              vibeSearchUrl.searchParams.set("type", "video");
              vibeSearchUrl.searchParams.set("maxResults", "5");
              vibeSearchUrl.searchParams.set("videoCategoryId", "10");
              vibeSearchUrl.searchParams.set("key", key);
              return vibeSearchUrl.toString();
            });
            if (vibeSearchRes.ok) {
              const vibeSearchData = await vibeSearchRes.json();
              const vibeIds: string[] = (
                vibeSearchData.items as { id: { videoId: string } }[]
              )
                .map((item) => item.id.videoId)
                .filter((id) => !seenIds.has(id));

              if (vibeIds.length > 0) {
                const vibeItems = await fetchVideoDetails(vibeIds);
                vibeTracks = vibeItems
                  .map(toTrack)
                  .filter((t) => !seenIds.has(t.id));
                hasVibe = vibeTracks.length > 0;
              }
            }
          }
        } catch {
          // Vibe search failure is non-fatal
        }
      } else if (youtubeSearchRes.status === "rejected") {
        throw new Error(
          youtubeSearchRes.reason instanceof Error
            ? youtubeSearchRes.reason.message
            : "Search failed. Check your network.",
        );
      }

      // ─── Merge and rank ────────────────────────────────────────────────────
      const allYoutubeTracks = [...youtubeTracks, ...vibeTracks];
      let finalResults: Track[];

      if (hasSpotify) {
        // Spotify tracks first (richer metadata), then YouTube-only
        const merged = mergeAndDedupe(spotifyTracksWithYt, allYoutubeTracks);
        finalResults = rankSearchResults(merged, query);
      } else {
        // Spotify unavailable — pure YouTube flow
        const merged = [...youtubeTracks, ...vibeTracks];
        finalResults = rankSearchResults(merged, query);
      }

      finalResults = deduplicateVersions(finalResults);

      // Add fuzzy results if too few
      let usedFuzzy = false;
      const allTracks = [
        ...youtubeTracks,
        ...vibeTracks,
        ...spotifyTracksWithYt,
      ];
      if (finalResults.length < 3 && allTracks.length >= 3) {
        const fuzzyResults = fuzzySearch(allTracks, query);
        const fuzzyDeduped = deduplicateVersions(fuzzyResults);
        const existingIds = new Set(finalResults.map((t) => t.id));
        for (const t of fuzzyDeduped) {
          if (!existingIds.has(t.id)) {
            finalResults.push(t);
            existingIds.add(t.id);
          }
        }
        usedFuzzy = true;
      }

      // Cache merged results
      cacheSet(ck, { tracks: finalResults, hasSpotify, hasVibe });

      setResults(finalResults);
      setHasSpotifyResults(hasSpotify);
      setHasVibeResults(hasVibe);
      setIsFuzzyResult(usedFuzzy);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Search failed. Check your network.";
      setError(msg);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    results,
    isLoading,
    error,
    lastQuery,
    search,
    isDemoMode: IS_DEMO,
    hasSpotifyResults,
    hasVibeResults,
    isFuzzyResult,
  };
}
