import { useCallback, useState } from "react";
import {
  MAX_SEARCH_RESULTS,
  YOUTUBE_API_BASE,
  YOUTUBE_API_KEY,
  fetchWithKeyFallback,
  parseYouTubeError,
} from "../constants";
import { MOCK_TRACKS } from "../data/mockData";
import type { Track } from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";

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

export function useYouTubeSearch() {
  const [results, setResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [hasVibeResults, setHasVibeResults] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLastQuery(query);
    setIsLoading(true);
    setError(null);
    setHasVibeResults(false);

    if (IS_DEMO) {
      await new Promise((r) => setTimeout(r, 600));
      const filtered = MOCK_TRACKS.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.channelName.toLowerCase().includes(query.toLowerCase()),
      );
      setResults(filtered.length > 0 ? filtered : MOCK_TRACKS);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const ck = cacheKey("search", query.trim().toLowerCase());
    const cached = cacheGet<{ tracks: Track[]; hasVibe: boolean }>(ck);
    if (cached) {
      setResults(cached.tracks);
      setHasVibeResults(cached.hasVibe);
      setIsLoading(false);
      return;
    }

    try {
      // Step 1: name-based search
      const searchRes = await fetchWithKeyFallback((key) => {
        const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
        searchUrl.searchParams.set("part", "snippet");
        searchUrl.searchParams.set("q", query);
        searchUrl.searchParams.set("type", "video");
        searchUrl.searchParams.set("maxResults", MAX_SEARCH_RESULTS.toString());
        searchUrl.searchParams.set("videoCategoryId", "10");
        searchUrl.searchParams.set("key", key);
        return searchUrl.toString();
      });
      if (!searchRes.ok) throw new Error(await parseYouTubeError(searchRes));
      const searchData = await searchRes.json();
      const videoIds: string[] = searchData.items.map(
        (item: { id: { videoId: string } }) => item.id.videoId,
      );

      // Step 2: fetch details for name-based results
      const nameItems = await fetchVideoDetails(videoIds);
      const nameTracks = nameItems.map(toTrack);

      // Step 3: extract vibe tags from top 3 results
      const seenIds = new Set(nameTracks.map((t) => t.id));
      let vibeTracks: Track[] = [];

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
            }
          }
        }
      } catch {
        // Vibe search failure is non-fatal
      }

      const merged = [...nameTracks, ...vibeTracks];

      // Save to cache
      cacheSet(ck, { tracks: merged, hasVibe: vibeTracks.length > 0 });

      setResults(merged);
      setHasVibeResults(vibeTracks.length > 0);
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
    hasVibeResults,
  };
}
