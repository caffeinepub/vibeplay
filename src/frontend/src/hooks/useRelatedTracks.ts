import { useEffect, useRef, useState } from "react";
import {
  YOUTUBE_API_BASE,
  YOUTUBE_API_KEY,
  fetchWithKeyFallback,
} from "../constants";
import { MOCK_TRACKS } from "../data/mockData";
import type { Track } from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";
import {
  applyExplorationFactor,
  deduplicateVersions,
  enforceArtistDiversity,
} from "../utils/versionDedup";

const IS_DEMO = !YOUTUBE_API_KEY || YOUTUBE_API_KEY.includes("placeholder");

const LS_CONTINUE_LISTENING = "vibeplay_continue_listening";

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

function buildRelatedQuery(title: string, channelName: string): string {
  const clean = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/ft\.?|feat\.?|official|video|audio|lyrics|full|hd|hq/gi, "")
    .replace(/[|\-\u2013\u2014]/g, " ")
    .trim();

  const artist = channelName
    .replace(/VEVO|Records|Music|Official|Channel/gi, "")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(" ");

  const combined = `${artist} ${clean}`.trim();
  return combined.length > 5 ? combined : clean;
}

/**
 * Reads watch history from localStorage and extracts tracks cached in recommendation cache.
 * Returns up to `limit` tracks NOT in the excluded ID set — zero extra API calls.
 */
function getHistoryBasedTracks(
  excludeIds: Set<string>,
  limit: number,
): Track[] {
  try {
    const raw = localStorage.getItem(LS_CONTINUE_LISTENING);
    if (!raw) return [];
    const history: Track[] = JSON.parse(raw);
    const recentHistory = history
      .filter((t) => !excludeIds.has(t.id))
      .slice(-5); // last 5 played (excluding current)

    const historyBased: Track[] = [];
    for (const histTrack of recentHistory) {
      const cached = cacheGet<Track[]>(cacheKey("related", histTrack.id));
      if (!cached) continue;
      for (const t of cached) {
        if (!excludeIds.has(t.id) && !historyBased.some((x) => x.id === t.id)) {
          historyBased.push(t);
          if (historyBased.length >= limit) break;
        }
      }
      if (historyBased.length >= limit) break;
    }
    return historyBased;
  } catch {
    return [];
  }
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

      // Demo mode
      if (IS_DEMO) {
        await new Promise((r) => setTimeout(r, 700));
        if (cancelled) return;
        const others = MOCK_TRACKS.filter((t) => t.id !== track.id);
        const shuffled = [...others].sort(() => Math.random() - 0.5);
        setRelatedTracks(shuffled.slice(0, 8));
        setIsLoading(false);
        return;
      }

      // Check cache first
      const ck = cacheKey("related", track.id);
      const cached = cacheGet<Track[]>(ck);
      if (cached) {
        if (!cancelled) {
          setRelatedTracks(cached);
          setIsLoading(false);
        }
        return;
      }

      try {
        // ── Step 1: Try relatedToVideoId (YouTube's native related videos) ──
        let primaryIds: string[] = [];
        let relatedApiWorked = false;

        try {
          const relatedRes = await fetchWithKeyFallback((key) => {
            const url = new URL(`${YOUTUBE_API_BASE}/search`);
            url.searchParams.set("part", "snippet");
            url.searchParams.set("relatedToVideoId", track.id);
            url.searchParams.set("type", "video");
            url.searchParams.set("videoCategoryId", "10");
            url.searchParams.set("maxResults", "8");
            url.searchParams.set("key", key);
            return url.toString();
          });

          if (relatedRes.ok) {
            const relatedData = await relatedRes.json();
            const ids: string[] = (relatedData.items ?? [])
              .filter((item: { id: { videoId?: string } }) => item.id.videoId)
              .map((item: { id: { videoId: string } }) => item.id.videoId)
              .filter((id: string) => id !== track.id);
            primaryIds = ids;
            relatedApiWorked = ids.length >= 4;
          }
        } catch {
          // relatedToVideoId not available — fall through to title/artist search
        }

        // ── Step 2: If relatedToVideoId returned < 4 results, also do title/artist search ──
        const relatedQuery = buildRelatedQuery(track.title, track.channelName);
        if (!relatedApiWorked) {
          const searchRes = await fetchWithKeyFallback((key) => {
            const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
            searchUrl.searchParams.set("part", "snippet");
            searchUrl.searchParams.set("q", relatedQuery);
            searchUrl.searchParams.set("type", "video");
            searchUrl.searchParams.set("videoCategoryId", "10");
            searchUrl.searchParams.set("maxResults", "8");
            searchUrl.searchParams.set("key", key);
            return searchUrl.toString();
          });

          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const fallbackIds: string[] = (searchData.items ?? [])
              .filter((item: { id: { videoId?: string } }) => item.id.videoId)
              .map((item: { id: { videoId: string } }) => item.id.videoId)
              .filter((id: string) => id !== track.id);

            // Merge unique IDs — relatedToVideoId results take priority
            const merged = [...primaryIds];
            for (const id of fallbackIds) {
              if (!merged.includes(id)) merged.push(id);
            }
            primaryIds = merged;
          }
        }

        if (primaryIds.length === 0) {
          if (!cancelled) setRelatedTracks([]);
          return;
        }

        // ── Step 3: Fetch video details in a single API call ──
        const detailsRes = await fetchWithKeyFallback((key) => {
          const detailsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
          detailsUrl.searchParams.set("part", "contentDetails,snippet");
          detailsUrl.searchParams.set("id", primaryIds.join(","));
          detailsUrl.searchParams.set("key", key);
          return detailsUrl.toString();
        });
        if (!detailsRes.ok) throw new Error("Details fetch failed");
        const detailsData = await detailsRes.json();

        const primaryTracks: Track[] = (detailsData.items ?? []).map(
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

        // ── Step 4: Mix in history-based tracks (zero extra API calls) ──
        const primaryIdSet = new Set([
          track.id,
          ...primaryTracks.map((t) => t.id),
        ]);
        const historyTracks = getHistoryBasedTracks(primaryIdSet, 3);

        // ── Step 5: Combine ──
        const combined = [...primaryTracks, ...historyTracks];
        const seen = new Set<string>([track.id]);
        const result: Track[] = [];
        for (const t of combined) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            result.push(t);
          }
        }

        // ── Step 6: Smart dedup, diversity, exploration ──
        // Remove duplicate versions (remix/slowed/lofi etc)
        let smartResult = deduplicateVersions(result);
        // Enforce artist diversity (max 2 per artist)
        smartResult = enforceArtistDiversity(smartResult, 2);
        // Apply 70/30 exploration factor using history pool
        const historyPool = getHistoryBasedTracks(primaryIdSet, 5);
        smartResult = applyExplorationFactor(
          smartResult,
          historyPool,
          Math.min(8, smartResult.length + 3),
        );
        // Cap at 8
        smartResult = smartResult.slice(0, 8);

        // Save to cache
        cacheSet(ck, smartResult);

        if (!cancelled) setRelatedTracks(smartResult);
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
