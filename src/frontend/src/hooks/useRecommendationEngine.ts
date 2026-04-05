import { useCallback, useEffect, useRef, useState } from "react";
import { YOUTUBE_API_BASE, fetchWithKeyFallback } from "../constants";
import {
  getLastFmSimilarTracks,
  getLastFmTopTracks,
  lastFmTrackToTrack,
} from "../services/lastfmService";
import type {
  BehaviorEvent,
  RecommendationSection,
  Track,
  UserPreferences,
} from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";
import { buildIndianLanguageMoodQuery } from "../utils/detectTrackMeta";
import {
  deduplicateVersions,
  enforceArtistDiversity,
  shuffleArray,
} from "../utils/versionDedup";

const LS_BEHAVIOR_EVENTS = "vibeplay_behavior_events";
const LS_USER_PREFERENCES = "vibeplay_user_preferences";
const LS_INTERESTS_SET = "vibeplay_interests_set";
const LS_CONTINUE_LISTENING = "vibeplay_continue_listening";
const MAX_BEHAVIOR_EVENTS = 200;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // storage full — ignore
  }
}

const DEFAULT_PREFS: UserPreferences = {
  tagScores: {},
  boostedIds: [],
  downrankedIds: [],
  interests: [],
  totalPlays: 0,
};

/** Scan localStorage for all cached related track arrays */
function getAllCachedRelatedTracks(): Track[] {
  const all: Track[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.includes("related")) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const tracks: Track[] = Array.isArray(parsed.data) ? parsed.data : [];
      for (const t of tracks) {
        if (t.id && !seen.has(t.id)) {
          seen.add(t.id);
          all.push(t);
        }
      }
    } catch {
      // skip corrupted entry
    }
  }
  return all;
}

/** Score a single track against the user preference model */
function scoreTrack(track: Track, prefs: UserPreferences): number {
  let score = 0;
  const tags = track.tags ?? [];
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    score += prefs.tagScores[lower] ?? 0;
  }
  if (prefs.boostedIds.includes(track.id)) score += 3;
  if (prefs.downrankedIds.includes(track.id)) score -= 4;
  return score;
}

/** Deduplicate array of tracks by id */
function dedup(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/**
 * Builds a human-readable section title from selected filter chips.
 * e.g. ["hindi", "romantic"] -> "Hindi Romantic Mix"
 */
function buildFilterTitle(filters: string[]): string {
  if (filters.length === 0) return "Filter Mix";
  const capitalized = filters.map(
    (f) => f.charAt(0).toUpperCase() + f.slice(1),
  );
  if (capitalized.length === 1) {
    const f = capitalized[0];
    // Nice suffixes per single filter
    const suffixMap: Record<string, string> = {
      Haryanvi: "Haryanvi Hits",
      Bollywood: "Bollywood Blockbusters",
      Punjabi: "Punjabi Bangers",
      Hindi: "Hindi Top Picks",
      Romantic: "Romantic Vibes",
      Sad: "Sad Songs",
      Party: "Party Anthems",
      Chill: "Chill Zone",
      Workout: "Workout Fuel",
    };
    return suffixMap[f] ?? `${f} Mix`;
  }
  return `${capitalized.join(" ")} Mix`;
}

/**
 * Fetches tracks from YouTube for a given query, checking the cache first.
 * Returns an empty array on failure. Results cached for 1 hour under 'langmood' key.
 */
async function fetchLangMoodTracks(query: string): Promise<Track[]> {
  const ck = cacheKey("langmood", query);
  const cached = cacheGet<Track[]>(ck);
  if (cached) return cached;

  try {
    const res = await fetchWithKeyFallback((key) => {
      const url = new URL(`${YOUTUBE_API_BASE}/search`);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("videoCategoryId", "10");
      url.searchParams.set("maxResults", "8");
      url.searchParams.set("key", key);
      return url.toString();
    });
    if (!res.ok) return [];
    const data = await res.json();
    const tracks: Track[] = (data.items ?? []).map(
      (item: {
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: { medium: { url: string } };
        };
      }) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channelName: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
      }),
    );
    cacheSet(ck, tracks);
    return tracks;
  } catch {
    return [];
  }
}

/**
 * Fetches Last.fm global top tracks and returns them as a RecommendationSection.
 * Tracks retain source='lastfm' and need YouTube ID resolution before playback.
 */
async function fetchLastFmTrendingSection(): Promise<RecommendationSection | null> {
  try {
    const raw = await getLastFmTopTracks(20);
    const tracks = raw.map(lastFmTrackToTrack);
    if (tracks.length === 0) return null;
    return {
      id: "lastfm-trending",
      title: "Trending Now",
      subtitle: "Global charts via Last.fm",
      tracks: shuffleArray(enforceArtistDiversity(tracks, 2)),
      isLoading: false,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches Last.fm similar tracks for the last played song.
 * Returns a RecommendationSection or null if no data.
 */
async function fetchSimilarArtistsSection(
  lastPlayed: Track | null,
): Promise<RecommendationSection | null> {
  if (!lastPlayed) return null;
  const artistName = lastPlayed.artist ?? lastPlayed.channelName;
  if (!artistName) return null;

  try {
    const raw = await getLastFmSimilarTracks(artistName, lastPlayed.title, 10);
    const tracks = raw.map(lastFmTrackToTrack);
    if (tracks.length === 0) return null;
    return {
      id: "similar-artists",
      title: "Similar Artists",
      subtitle: `Based on ${lastPlayed.title}`,
      tracks: enforceArtistDiversity(deduplicateVersions(tracks), 2),
      isLoading: false,
    };
  } catch {
    return null;
  }
}

export function useRecommendationEngine() {
  const [prefs, setPrefs] = useState<UserPreferences>(() =>
    readJson<UserPreferences>(LS_USER_PREFERENCES, DEFAULT_PREFS),
  );
  const [sections, setSections] = useState<RecommendationSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recShowCount, setRecShowCount] = useState(8);
  // Active filter chips (persisted via FilterChipBar's own localStorage key)
  const [activeFilters, setActiveFiltersState] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const buildingRef = useRef(false);
  // Track active filters in a ref for use inside async callbacks
  const activeFiltersRef = useRef<string[]>(activeFilters);
  useEffect(() => {
    activeFiltersRef.current = activeFilters;
  }, [activeFilters]);

  // ─── Behavior recording ─────────────────────────────────────────────────────────────
  const appendEvent = useCallback((event: BehaviorEvent) => {
    const events = readJson<BehaviorEvent[]>(LS_BEHAVIOR_EVENTS, []);
    const next = [...events, event].slice(-MAX_BEHAVIOR_EVENTS);
    writeJson(LS_BEHAVIOR_EVENTS, next);
  }, []);

  const recordPlay = useCallback(
    (track: Track) => {
      appendEvent({
        type: "play",
        videoId: track.id,
        title: track.title,
        channelName: track.channelName,
        tags: track.tags ?? [],
        timestamp: Date.now(),
      });
      setPrefs((prev) => {
        const next = { ...prev, totalPlays: prev.totalPlays + 1 };
        if (!next.boostedIds.includes(track.id)) {
          next.boostedIds = [track.id, ...next.boostedIds].slice(0, 100);
        }
        const tags = track.tags ?? [];
        const tagScores = { ...next.tagScores };
        for (const tag of tags) {
          const lower = tag.toLowerCase();
          tagScores[lower] = (tagScores[lower] ?? 0) + 1;
        }
        next.tagScores = tagScores;
        writeJson(LS_USER_PREFERENCES, next);
        return next;
      });
    },
    [appendEvent],
  );

  const recordSkip = useCallback(
    (videoId: string) => {
      appendEvent({ type: "skip", videoId, timestamp: Date.now() });
      setPrefs((prev) => {
        const next = { ...prev };
        if (!next.downrankedIds.includes(videoId)) {
          next.downrankedIds = [videoId, ...next.downrankedIds].slice(0, 100);
        }
        writeJson(LS_USER_PREFERENCES, next);
        return next;
      });
    },
    [appendEvent],
  );

  const recordLike = useCallback(
    (track: Track) => {
      appendEvent({
        type: "like",
        videoId: track.id,
        title: track.title,
        tags: track.tags ?? [],
        timestamp: Date.now(),
      });
      setPrefs((prev) => {
        const next = { ...prev };
        if (!next.boostedIds.includes(track.id)) {
          next.boostedIds = [track.id, ...next.boostedIds].slice(0, 100);
        }
        const tagScores = { ...next.tagScores };
        for (const tag of track.tags ?? []) {
          const lower = tag.toLowerCase();
          tagScores[lower] = (tagScores[lower] ?? 0) + 3;
        }
        next.tagScores = tagScores;
        writeJson(LS_USER_PREFERENCES, next);
        return next;
      });
    },
    [appendEvent],
  );

  const recordUnlike = useCallback(
    (videoId: string) => {
      appendEvent({ type: "unlike", videoId, timestamp: Date.now() });
      setPrefs((prev) => {
        const next = {
          ...prev,
          boostedIds: prev.boostedIds.filter((id) => id !== videoId),
        };
        writeJson(LS_USER_PREFERENCES, next);
        return next;
      });
    },
    [appendEvent],
  );

  const recordSearch = useCallback(
    (query: string) => {
      appendEvent({ type: "search", query, timestamp: Date.now() });
    },
    [appendEvent],
  );

  const setInterests = useCallback((genres: string[]) => {
    writeJson(LS_INTERESTS_SET, true);
    setPrefs((prev) => {
      const next = { ...prev, interests: genres };
      const tagScores = { ...next.tagScores };
      for (const g of genres) {
        const lower = g.toLowerCase();
        tagScores[lower] = (tagScores[lower] ?? 0) + 2;
      }
      next.tagScores = tagScores;
      writeJson(LS_USER_PREFERENCES, next);
      return next;
    });
  }, []);

  // ─── Filter sections fetch ───────────────────────────────────────
  /**
   * Fetches a YouTube search for the active filter chips and returns a
   * RecommendationSection to be placed at the TOP of the sections list.
   * Results are cached for 1 hour per unique filter combination.
   */
  const fetchFilterSection = useCallback(
    async (filters: string[]): Promise<RecommendationSection | null> => {
      if (filters.length === 0) return null;
      const query = `${filters.join(" ")} songs`;
      const ck = cacheKey("filter", query);
      let tracks = cacheGet<Track[]>(ck) ?? [];

      if (tracks.length === 0) {
        try {
          const res = await fetchWithKeyFallback((key) => {
            const url = new URL(`${YOUTUBE_API_BASE}/search`);
            url.searchParams.set("part", "snippet");
            url.searchParams.set("q", query);
            url.searchParams.set("type", "video");
            url.searchParams.set("videoCategoryId", "10");
            url.searchParams.set("maxResults", "10");
            url.searchParams.set("key", key);
            return url.toString();
          });
          if (res.ok) {
            const data = await res.json();
            tracks = (data.items ?? []).map(
              (item: {
                id: { videoId: string };
                snippet: {
                  title: string;
                  channelTitle: string;
                  thumbnails: { medium: { url: string } };
                };
              }) => ({
                id: item.id.videoId,
                title: item.snippet.title,
                channelName: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails.medium.url,
                tags: filters,
              }),
            );
            cacheSet(ck, tracks);
          }
        } catch {
          // fail silently
        }
      }

      if (tracks.length === 0) return null;

      const cleaned = shuffleArray(
        enforceArtistDiversity(deduplicateVersions(tracks), 2),
      );

      return {
        id: "filter-mix",
        title: buildFilterTitle(filters),
        tracks: cleaned,
        isLoading: false,
      };
    },
    [],
  );

  // ─── Sections builder ─────────────────────────────────────
  const buildSections = useCallback(
    async (currentPrefs: UserPreferences, showCount: number) => {
      if (buildingRef.current) return;
      buildingRef.current = true;
      setIsLoading(true);

      try {
        const filters = activeFiltersRef.current;

        // ── 1. Continue Watching (from localStorage, instant) ──
        const continueItems = readJson<Track[]>(
          LS_CONTINUE_LISTENING,
          [],
        ).slice(0, 4);

        // ── 2. Because You Watched (language + mood enhanced) ──
        const lastPlayed =
          readJson<Track[]>(LS_CONTINUE_LISTENING, [])[0] ?? null;
        let becauseYouWatched: Track[] = [];
        if (lastPlayed) {
          // Start with cached related tracks for the last played song
          const cached = cacheGet<Track[]>(cacheKey("related", lastPlayed.id));
          becauseYouWatched = cached ?? [];

          // If the last played song is Indian, also blend in language+mood results
          const langMoodQuery = buildIndianLanguageMoodQuery(
            lastPlayed.title,
            lastPlayed.channelName,
          );
          if (langMoodQuery) {
            const langMoodTracks = await fetchLangMoodTracks(langMoodQuery);
            if (langMoodTracks.length > 0) {
              // Merge: existing related tracks come first, language+mood tracks fill gaps
              const existingIds = new Set(becauseYouWatched.map((t) => t.id));
              const newTracks = langMoodTracks.filter(
                (t) => !existingIds.has(t.id) && t.id !== lastPlayed.id,
              );
              becauseYouWatched = [...becauseYouWatched, ...newTracks];
            }
          }

          becauseYouWatched = shuffleArray(
            enforceArtistDiversity(deduplicateVersions(becauseYouWatched), 2),
          );
        }

        // ── 3. Recommended for You ──
        const allCachedTracks = getAllCachedRelatedTracks();
        const scored = allCachedTracks
          .map((t) => ({ track: t, score: scoreTrack(t, currentPrefs) }))
          .sort((a, b) => b.score - a.score);

        const recentlyPlayedIds = new Set(continueItems.map((t) => t.id));
        let recAllTracks = dedup(scored.map((x) => x.track));
        recAllTracks = recAllTracks.filter((t) => !recentlyPlayedIds.has(t.id));
        recAllTracks = deduplicateVersions(recAllTracks);
        recAllTracks = enforceArtistDiversity(recAllTracks, 2);

        const explorationPool = shuffleArray(
          allCachedTracks.filter(
            (t) =>
              !recentlyPlayedIds.has(t.id) &&
              !recAllTracks.some((r) => r.id === t.id),
          ),
        );
        const exploreCount = Math.floor(showCount * 0.3);
        const similarCount = showCount - exploreCount;
        const mixedRecs = [
          ...recAllTracks.slice(0, similarCount),
          ...enforceArtistDiversity(
            deduplicateVersions(explorationPool),
            1,
          ).slice(0, exploreCount),
        ];
        recAllTracks = shuffleArray(mixedRecs);

        // ── 4. Trending in Your Interest ──
        let topTag =
          Object.entries(currentPrefs.tagScores).sort(
            (a, b) => b[1] - a[1],
          )[0]?.[0] ??
          currentPrefs.interests[0] ??
          "bollywood music";

        if (lastPlayed) {
          const langMoodQ = buildIndianLanguageMoodQuery(
            lastPlayed.title,
            lastPlayed.channelName,
          );
          if (langMoodQ) {
            const topTagIsGeneric =
              !topTag.includes("hindi") &&
              !topTag.includes("haryanvi") &&
              !topTag.includes("punjabi") &&
              !topTag.includes("bollywood") &&
              !topTag.includes("tamil") &&
              !topTag.includes("telugu");
            if (topTagIsGeneric) topTag = langMoodQ;
          }
        }

        const trendCacheKey = cacheKey("trending", topTag);
        let trendingTracks = cacheGet<Track[]>(trendCacheKey) ?? [];

        if (trendingTracks.length === 0) {
          try {
            const res = await fetchWithKeyFallback((key) => {
              const url = new URL(`${YOUTUBE_API_BASE}/search`);
              url.searchParams.set("part", "snippet");
              url.searchParams.set("q", topTag);
              url.searchParams.set("type", "video");
              url.searchParams.set("videoCategoryId", "10");
              url.searchParams.set("maxResults", "8");
              url.searchParams.set("order", "viewCount");
              url.searchParams.set("key", key);
              return url.toString();
            });
            if (res.ok) {
              const data = await res.json();
              trendingTracks = (data.items ?? []).map(
                (item: {
                  id: { videoId: string };
                  snippet: {
                    title: string;
                    channelTitle: string;
                    thumbnails: { medium: { url: string } };
                  };
                }) => ({
                  id: item.id.videoId,
                  title: item.snippet.title,
                  channelName: item.snippet.channelTitle,
                  thumbnail: item.snippet.thumbnails.medium.url,
                  tags: [topTag],
                }),
              );
              cacheSet(trendCacheKey, trendingTracks);
            }
          } catch {
            // fail silently
          }
        }

        trendingTracks = shuffleArray(
          enforceArtistDiversity(deduplicateVersions(trendingTracks), 2),
        );

        // ── 5. Last.fm Trending Now + Similar Artists (fetched in parallel) ──
        const [lastFmTrendingSection, similarArtistsSection] =
          await Promise.all([
            fetchLastFmTrendingSection(),
            fetchSimilarArtistsSection(lastPlayed),
          ]);

        // ── 6. Filter section (placed at top if filters are active) ──
        const filterSection =
          filters.length > 0 ? await fetchFilterSection(filters) : null;

        // Assemble base sections
        // Order: continue, recommended, lastfm-trending, similar-artists, because, trending
        const baseSections: RecommendationSection[] = [
          {
            id: "continue",
            title: "Continue Watching",
            tracks: continueItems,
            isLoading: false,
          },
          {
            id: "recommended",
            title: "Recommended for You",
            tracks: recAllTracks.slice(0, showCount),
            isLoading: false,
          },
          // Last.fm Trending Now (after Recommended for You)
          ...(lastFmTrendingSection ? [lastFmTrendingSection] : []),
          // Last.fm Similar Artists (after Trending Now)
          ...(similarArtistsSection ? [similarArtistsSection] : []),
          {
            id: "because",
            title: "Because You Watched",
            subtitle: lastPlayed?.title,
            tracks: becauseYouWatched,
            isLoading: false,
          },
          {
            id: "trending",
            title: `Trending in ${topTag.charAt(0).toUpperCase() + topTag.slice(1)}`,
            tracks: trendingTracks,
            isLoading: false,
          },
        ].filter((s) => s.tracks.length > 0 || s.id === "recommended");

        // Place filter section at the very top
        const nextSections: RecommendationSection[] = filterSection
          ? [filterSection, ...baseSections]
          : baseSections;

        setSections(nextSections);
      } catch (err) {
        console.error("Recommendation build failed:", err);
      } finally {
        setIsLoading(false);
        buildingRef.current = false;
      }
    },
    [fetchFilterSection],
  );

  // ─── Debounced rebuild trigger ───────────────────────────────────
  const triggerRebuild = useCallback(
    (p: UserPreferences, count: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        buildSections(p, count);
      }, 500);
    },
    [buildSections],
  );

  // Rebuild on prefs change
  useEffect(() => {
    triggerRebuild(prefs, recShowCount);
  }, [prefs, recShowCount, triggerRebuild]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const latest = readJson<UserPreferences>(
        LS_USER_PREFERENCES,
        DEFAULT_PREFS,
      );
      buildSections(latest, recShowCount);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [buildSections, recShowCount]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const loadMore = useCallback(() => {
    setRecShowCount((prev) => prev + 4);
  }, []);

  /**
   * Called by the FilterChipBar or App.tsx whenever the user changes the
   * active language/mood filters. Immediately triggers a rebuild so the
   * filter section appears/updates at the top of the feed.
   */
  const setActiveFilters = useCallback(
    (filters: string[]) => {
      setActiveFiltersState(filters);
      activeFiltersRef.current = filters;
      // Trigger an immediate rebuild with current prefs
      const currentPrefs = readJson<UserPreferences>(
        LS_USER_PREFERENCES,
        DEFAULT_PREFS,
      );
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        buildSections(currentPrefs, recShowCount);
      }, 300);
    },
    [buildSections, recShowCount],
  );

  const needsOnboarding =
    prefs.totalPlays < 5 &&
    prefs.interests.length === 0 &&
    !readJson<boolean>(LS_INTERESTS_SET, false);

  return {
    sections,
    isLoading,
    activeFilters,
    setActiveFilters,
    recordPlay,
    recordSkip,
    recordLike,
    recordUnlike,
    recordSearch,
    setInterests,
    loadMore,
    needsOnboarding,
  };
}
