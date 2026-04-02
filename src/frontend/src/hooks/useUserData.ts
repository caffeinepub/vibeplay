import { useCallback, useEffect, useRef, useState } from "react";
import type { backendInterface as FullBackendInterface } from "../backend.d";
import type { Track } from "../types";
import { useActor } from "./useActor";

export interface BackendPlaylistWithTracks {
  id: bigint;
  name: string;
  videoIds: string[];
  tracks: Track[];
}

export function useUserData(sessionToken: string | null, isLoggedIn: boolean) {
  const { actor } = useActor();
  const [likedVideoIds, setLikedVideoIds] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<BackendPlaylistWithTracks[]>([]);
  const trackCache = useRef<Map<string, Track>>(new Map());

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

      cacheTrack(track);
      const liked = likedVideoIds.includes(track.id);

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

  return {
    likedVideoIds,
    isLiked,
    toggleLike,
    playlists,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    refresh,
    cacheTrack,
  };
}
