import { useCallback, useEffect, useRef, useState } from "react";
import { YOUTUBE_API_BASE, fetchWithKeyFallback } from "../constants";
import type { Track } from "../types";
import type { VibePlayBackend as FullBackendInterface } from "../types/backendTypes";
import { useActor } from "./useActor";

// localStorage keys for persisting track metadata across page reloads
const LS_TRACK_CACHE = "vibeplay_track_cache_v2";
const LS_LIKED_CACHE = "vibeplay_liked_cache_v2";

export interface BackendPlaylistWithTracks {
  id: bigint;
  name: string;
  videoIds: string[];
  tracks: Track[];
}

// ─── localStorage helpers ────────────────────────────────────────────────────

function loadTrackCacheFromStorage(): Map<string, Track> {
  try {
    const raw = localStorage.getItem(LS_TRACK_CACHE);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as [string, Track][];
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveTrackCacheToStorage(cache: Map<string, Track>): void {
  try {
    const entries = Array.from(cache.entries());
    // Keep at most 500 entries to avoid bloat
    const trimmed = entries.slice(-500);
    localStorage.setItem(LS_TRACK_CACHE, JSON.stringify(trimmed));
  } catch {
    // quota exceeded — ignore
  }
}

function loadLikedCacheFromStorage(): Map<string, Track> {
  try {
    const raw = localStorage.getItem(LS_LIKED_CACHE);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as [string, Track][];
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveLikedCacheToStorage(cache: Map<string, Track>): void {
  try {
    const entries = Array.from(cache.entries());
    localStorage.setItem(LS_LIKED_CACHE, JSON.stringify(entries));
  } catch {
    // quota exceeded — ignore
  }
}

// ─── Fetch YouTube video metadata for unknown videoIds ───────────────────────

async function fetchYouTubeTrackMeta(videoIds: string[]): Promise<Track[]> {
  if (videoIds.length === 0) return [];
  try {
    const res = await fetchWithKeyFallback((key) => {
      const u = new URL(`${YOUTUBE_API_BASE}/videos`);
      u.searchParams.set("part", "snippet,contentDetails");
      u.searchParams.set("id", videoIds.join(","));
      u.searchParams.set("key", key);
      return u.toString();
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map(
      (item: {
        id: string;
        snippet?: {
          title?: string;
          channelTitle?: string;
          thumbnails?: { medium?: { url: string }; default?: { url: string } };
        };
        contentDetails?: { duration?: string };
      }) => ({
        id: item.id,
        title: item.snippet?.title ?? item.id,
        channelName: item.snippet?.channelTitle ?? "",
        artist: item.snippet?.channelTitle ?? "",
        thumbnail:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
        duration: item.contentDetails?.duration,
        source: "youtube" as const,
      }),
    );
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useUserData(sessionToken: string | null, isLoggedIn: boolean) {
  const { actor } = useActor();
  const [likedVideoIds, setLikedVideoIds] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<BackendPlaylistWithTracks[]>([]);

  // trackCache is restored from localStorage on mount so it survives page reloads
  const trackCache = useRef<Map<string, Track>>(new Map());
  // likedCache mirrors Track objects for liked songs
  const likedCache = useRef<Map<string, Track>>(new Map());

  // Restore caches from localStorage before first refresh
  useEffect(() => {
    trackCache.current = loadTrackCacheFromStorage();
    likedCache.current = loadLikedCacheFromStorage();
  }, []);

  const getBackend = useCallback(() => {
    if (!actor) return null;
    return actor as unknown as FullBackendInterface;
  }, [actor]);

  const refresh = useCallback(async () => {
    if (!isLoggedIn || !sessionToken) return;
    const backend = getBackend();
    if (!backend) return;

    const [likesResult, playlistsResult] = await Promise.all([
      backend.getLikedSongs(sessionToken).catch(() => ({ ok: [] as string[] })),
      backend.getPlaylists(sessionToken).catch(() => ({
        ok: [] as { id: bigint; name: string; videoIds: string[] }[],
      })),
    ]);

    if ("ok" in likesResult) {
      setLikedVideoIds(likesResult.ok);
    }

    if ("ok" in playlistsResult) {
      const rawPlaylists = (
        playlistsResult as {
          ok: { id: bigint; name: string; videoIds: string[] }[];
        }
      ).ok;

      // Collect all videoIds that are NOT yet in trackCache so we can fetch them
      const missingIds = new Set<string>();
      for (const pl of rawPlaylists) {
        for (const vid of pl.videoIds) {
          if (!trackCache.current.has(vid)) {
            missingIds.add(vid);
          }
        }
      }

      // Also check liked songs for missing ids
      if ("ok" in likesResult) {
        for (const vid of (likesResult as { ok: string[] }).ok) {
          if (!trackCache.current.has(vid) && !likedCache.current.has(vid)) {
            missingIds.add(vid);
          }
        }
      }

      // Fetch metadata for all missing videoIds in batches of 50 (YouTube API limit)
      if (missingIds.size > 0) {
        const idsArray = Array.from(missingIds);
        const BATCH = 50;
        for (let i = 0; i < idsArray.length; i += BATCH) {
          const batch = idsArray.slice(i, i + BATCH);
          const fetched = await fetchYouTubeTrackMeta(batch);
          for (const t of fetched) {
            trackCache.current.set(t.id, t);
            // Also store in liked cache if it appears in liked songs
            if (
              "ok" in likesResult &&
              (likesResult as { ok: string[] }).ok.includes(t.id)
            ) {
              likedCache.current.set(t.id, t);
            }
          }
        }
        // Persist the enriched cache
        saveTrackCacheToStorage(trackCache.current);
        saveLikedCacheToStorage(likedCache.current);
      }

      setPlaylists(
        rawPlaylists.map((pl) => ({
          ...pl,
          tracks: pl.videoIds
            .map((vid) => trackCache.current.get(vid))
            .filter(Boolean) as Track[],
        })),
      );
    }
  }, [isLoggedIn, sessionToken, getBackend]);

  useEffect(() => {
    if (isLoggedIn && sessionToken) {
      refresh();
    } else {
      setLikedVideoIds([]);
      setPlaylists([]);
    }
  }, [isLoggedIn, sessionToken, refresh]);

  const cacheTrack = useCallback((track: Track) => {
    trackCache.current.set(track.id, track);
    saveTrackCacheToStorage(trackCache.current);
  }, []);

  const getCachedTrack = useCallback((videoId: string): Track | undefined => {
    return trackCache.current.get(videoId);
  }, []);

  const isLiked = useCallback(
    (videoId: string) => likedVideoIds.includes(videoId),
    [likedVideoIds],
  );

  const toggleLike = useCallback(
    async (track: Track) => {
      if (!isLoggedIn || !sessionToken) return;
      const backend = getBackend();
      if (!backend) return;

      // Cache in both caches
      cacheTrack(track);
      const liked = likedVideoIds.includes(track.id);

      if (!liked) {
        likedCache.current.set(track.id, track);
      } else {
        likedCache.current.delete(track.id);
      }
      saveLikedCacheToStorage(likedCache.current);

      setLikedVideoIds((prev) =>
        liked ? prev.filter((id) => id !== track.id) : [...prev, track.id],
      );

      try {
        if (liked) {
          await backend.unlikeSong(sessionToken, track.id);
        } else {
          await backend.likeSong(sessionToken, track.id);
        }
      } catch {
        // Revert optimistic update
        if (!liked) {
          likedCache.current.delete(track.id);
        } else {
          likedCache.current.set(track.id, track);
        }
        saveLikedCacheToStorage(likedCache.current);
        setLikedVideoIds((prev) =>
          liked ? [...prev, track.id] : prev.filter((id) => id !== track.id),
        );
      }
    },
    [isLoggedIn, sessionToken, likedVideoIds, getBackend, cacheTrack],
  );

  const createPlaylist = useCallback(
    async (name: string) => {
      if (!isLoggedIn || !sessionToken) return;
      const backend = getBackend();
      if (!backend) return;

      const result = await backend.createPlaylist(sessionToken, name);
      if ("ok" in result) {
        const newId = result.ok;
        setPlaylists((prev) => [
          { id: newId, name, videoIds: [], tracks: [] },
          ...prev,
        ]);
      }
    },
    [isLoggedIn, sessionToken, getBackend],
  );

  const deletePlaylist = useCallback(
    async (playlistId: bigint) => {
      if (!isLoggedIn || !sessionToken) return;
      const backend = getBackend();
      if (!backend) return;

      setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
      try {
        await backend.deletePlaylist(sessionToken, playlistId);
      } catch {
        await refresh();
      }
    },
    [isLoggedIn, sessionToken, getBackend, refresh],
  );

  const addTrackToPlaylist = useCallback(
    async (playlistId: bigint, track: Track) => {
      if (!isLoggedIn || !sessionToken) return;
      const backend = getBackend();
      if (!backend) return;

      cacheTrack(track);

      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id !== playlistId) return pl;
          if (pl.videoIds.includes(track.id)) return pl;
          return {
            ...pl,
            videoIds: [...pl.videoIds, track.id],
            tracks: [...pl.tracks, track],
          };
        }),
      );

      try {
        await backend.addSongToPlaylist(sessionToken, playlistId, track.id);
      } catch {
        await refresh();
      }
    },
    [isLoggedIn, sessionToken, getBackend, cacheTrack, refresh],
  );

  const removeTrackFromPlaylist = useCallback(
    async (playlistId: bigint, videoId: string) => {
      if (!isLoggedIn || !sessionToken) return;
      const backend = getBackend();
      if (!backend) return;

      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id !== playlistId) return pl;
          return {
            ...pl,
            videoIds: pl.videoIds.filter((id) => id !== videoId),
            tracks: pl.tracks.filter((t) => t.id !== videoId),
          };
        }),
      );

      try {
        await backend.removeSongFromPlaylist(sessionToken, playlistId, videoId);
      } catch {
        await refresh();
      }
    },
    [isLoggedIn, sessionToken, getBackend, refresh],
  );

  /**
   * Import a playlist: create it in the backend, cache all tracks,
   * then add them one by one.
   */
  const importPlaylist = useCallback(
    async (name: string, tracks: Track[]): Promise<void> => {
      if (!isLoggedIn || !sessionToken) return;
      const backend = getBackend();
      if (!backend) return;

      // 1. Create the playlist and get its ID
      const result = await backend.createPlaylist(sessionToken, name);
      if (!("ok" in result)) return;
      const newId = result.ok;

      // 2. Cache all tracks in both memory and localStorage
      for (const track of tracks) {
        trackCache.current.set(track.id, track);
      }
      saveTrackCacheToStorage(trackCache.current);

      // 3. Optimistically update local state
      setPlaylists((prev) => [
        {
          id: newId,
          name,
          videoIds: tracks.map((t) => t.id),
          tracks,
        },
        ...prev,
      ]);

      // 4. Persist each track to backend
      for (const track of tracks) {
        try {
          await backend.addSongToPlaylist(sessionToken, newId, track.id);
        } catch {
          // Best-effort; continue with remaining tracks
        }
      }
    },
    [isLoggedIn, sessionToken, getBackend],
  );

  return {
    likedVideoIds,
    isLiked,
    toggleLike,
    playlists,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    importPlaylist,
    refresh,
    cacheTrack,
    getCachedTrack,
  };
}
