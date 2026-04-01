import { useCallback, useState } from "react";
import {
  MAX_SEARCH_RESULTS,
  YOUTUBE_API_BASE,
  YOUTUBE_API_KEY,
} from "../constants";
import { MOCK_TRACKS } from "../data/mockData";
import type { Track } from "../types";

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

export function useYouTubeSearch() {
  const [results, setResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLastQuery(query);
    setIsLoading(true);
    setError(null);

    if (IS_DEMO) {
      // Demo mode: filter mock tracks or return all
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

    try {
      // First: search for video IDs
      const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("maxResults", MAX_SEARCH_RESULTS.toString());
      searchUrl.searchParams.set("videoCategoryId", "10"); // Music category
      searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

      const searchRes = await fetch(searchUrl.toString());
      if (!searchRes.ok) throw new Error("Search failed");
      const searchData = await searchRes.json();
      const videoIds: string[] = searchData.items.map(
        (item: { id: { videoId: string } }) => item.id.videoId,
      );

      // Then: get video details for duration
      const detailsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
      detailsUrl.searchParams.set("part", "contentDetails,snippet,statistics");
      detailsUrl.searchParams.set("id", videoIds.join(","));
      detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);

      const detailsRes = await fetch(detailsUrl.toString());
      if (!detailsRes.ok) throw new Error("Details fetch failed");
      const detailsData = await detailsRes.json();

      const tracks: Track[] = detailsData.items.map(
        (item: {
          id: string;
          snippet: {
            title: string;
            channelTitle: string;
            thumbnails: { medium: { url: string } };
          };
          contentDetails: { duration: string };
          statistics: { viewCount: string };
        }) => ({
          id: item.id,
          title: item.snippet.title,
          channelName: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.medium.url,
          duration: parseDuration(item.contentDetails.duration),
          viewCount: item.statistics.viewCount,
        }),
      );

      setResults(tracks);
    } catch (err) {
      setError("Search failed. Check your API key or network.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { results, isLoading, error, lastQuery, search, isDemoMode: IS_DEMO };
}
