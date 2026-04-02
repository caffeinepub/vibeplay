import { useEffect, useRef, useState } from "react";
import {
  YOUTUBE_API_BASE,
  YOUTUBE_API_KEY,
  fetchWithKeyFallback,
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

/** Build a related-song search query from a track title.
 *  Strips noise words, keeps keywords for vibe matching.
 */
function buildRelatedQuery(title: string, channelName: string): string {
  // Remove common noise: brackets, featuring info, official video/audio, etc.
  const clean = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/ft\.?|feat\.?|official|video|audio|lyrics|full|hd|hq/gi, "")
    .replace(/[|\-–—]/g, " ")
    .trim();

  // Try to extract the channel/artist name as context
  const artist = channelName
    .replace(/VEVO|Records|Music|Official|Channel/gi, "")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(" ");

  // Build query: artist + cleaned title keywords
  const combined = `${artist} ${clean}`.trim();
  return combined.length > 5 ? combined : clean;
}

export function useRelatedTracks(track: Track | null) {
  const [relatedTracks, setRelatedTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const trackIdRef = useRef<string | null>(null);

  useEffect(() => {
    const trackId = track?.id ?? null;

    if (!track || !trackId) {
      setRelatedTracks([]);
      return;
    }

    if (trackIdRef.current === trackId) return;
    trackIdRef.current = trackId;

    let cancelled = false;

    async function fetchRelated() {
      if (!track) return;
      setIsLoading(true);

      if (IS_DEMO) {
        await new Promise((r) => setTimeout(r, 700));
        if (cancelled) return;
        const others = MOCK_TRACKS.filter((t) => t.id !== track.id);
        const shuffled = [...others].sort(() => Math.random() - 0.5);
        setRelatedTracks(shuffled.slice(0, 10));
        setIsLoading(false);
        return;
      }

      try {
        // Build a query from the current track (relatedToVideoId was deprecated by YouTube in Aug 2023)
        const relatedQuery = buildRelatedQuery(track.title, track.channelName);

        const searchRes = await fetchWithKeyFallback((key) => {
          const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
          searchUrl.searchParams.set("part", "snippet");
          searchUrl.searchParams.set("q", relatedQuery);
          searchUrl.searchParams.set("type", "video");
          searchUrl.searchParams.set("videoCategoryId", "10"); // Music
          searchUrl.searchParams.set("maxResults", "12");
          searchUrl.searchParams.set("key", key);
          return searchUrl.toString();
        });

        if (!searchRes.ok) throw new Error("Related videos search failed");
        const searchData = await searchRes.json();

        const videoIds: string[] = (searchData.items ?? [])
          .filter((item: { id: { videoId?: string } }) => item.id.videoId)
          .map((item: { id: { videoId: string } }) => item.id.videoId)
          .filter((id: string) => id !== track.id);

        if (videoIds.length === 0) {
          if (!cancelled) setRelatedTracks([]);
          return;
        }

        const detailsRes = await fetchWithKeyFallback((key) => {
          const detailsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
          detailsUrl.searchParams.set("part", "contentDetails,snippet");
          detailsUrl.searchParams.set("id", videoIds.join(","));
          detailsUrl.searchParams.set("key", key);
          return detailsUrl.toString();
        });
        if (!detailsRes.ok) throw new Error("Details fetch failed");
        const detailsData = await detailsRes.json();

        const tracks: Track[] = (detailsData.items ?? []).map(
          (item: {
            id: string;
            snippet: {
              title: string;
              channelTitle: string;
              thumbnails: { medium: { url: string } };
            };
            contentDetails: { duration: string };
          }) => ({
            id: item.id,
            title: item.snippet.title,
            channelName: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.medium.url,
            duration: parseDuration(item.contentDetails.duration),
          }),
        );

        if (!cancelled) setRelatedTracks(tracks.slice(0, 10));
      } catch (err) {
        console.error("Related tracks fetch failed:", err);
        if (!cancelled) setRelatedTracks([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchRelated();
    return () => {
      cancelled = true;
    };
  }, [track]);

  return { relatedTracks, isLoading };
}
