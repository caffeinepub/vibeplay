import { useCallback, useState } from "react";
import {
  LS_CONTINUE_LISTENING,
  LS_FAVORITES,
  LS_PLAYLISTS,
  LS_RECENT_SEARCHES,
  MAX_CONTINUE_LISTENING,
  MAX_RECENT_SEARCHES,
} from "../constants";
import type { Playlist, Track } from "../types";

function getStored<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore storage errors
  }
}

export function useFavorites() {
  const [favorites, setFavoritesState] = useState<Track[]>(() =>
    getStored<Track[]>(LS_FAVORITES, []),
  );

  const addFavorite = useCallback((track: Track) => {
    setFavoritesState((prev) => {
      if (prev.find((t) => t.id === track.id)) return prev;
      const next = [track, ...prev];
      setStored(LS_FAVORITES, next);
      return next;
    });
  }, []);

  const removeFavorite = useCallback((trackId: string) => {
    setFavoritesState((prev) => {
      const next = prev.filter((t) => t.id !== trackId);
      setStored(LS_FAVORITES, next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (trackId: string) => favorites.some((t) => t.id === trackId),
    [favorites],
  );

  return { favorites, addFavorite, removeFavorite, isFavorite };
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearchesState] = useState<string[]>(() =>
    getStored<string[]>(LS_RECENT_SEARCHES, []),
  );

  const addRecentSearch = useCallback((query: string) => {
    setRecentSearchesState((prev) => {
      const filtered = prev.filter((s) => s !== query);
      const next = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      setStored(LS_RECENT_SEARCHES, next);
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setStored(LS_RECENT_SEARCHES, []);
    setRecentSearchesState([]);
  }, []);

  return { recentSearches, addRecentSearch, clearRecentSearches };
}

export function useContinueListening() {
  const [continueListening, setContinueListeningState] = useState<Track[]>(() =>
    getStored<Track[]>(LS_CONTINUE_LISTENING, []),
  );

  const addToHistory = useCallback((track: Track) => {
    setContinueListeningState((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      const next = [track, ...filtered].slice(0, MAX_CONTINUE_LISTENING);
      setStored(LS_CONTINUE_LISTENING, next);
      return next;
    });
  }, []);

  return { continueListening, addToHistory };
}

export function usePlaylists() {
  const [playlists, setPlaylistsState] = useState<Playlist[]>(() =>
    getStored<Playlist[]>(LS_PLAYLISTS, []),
  );

  const createPlaylist = useCallback((name: string) => {
    const playlist: Playlist = {
      id: Date.now().toString(),
      name,
      tracks: [],
      createdAt: Date.now(),
    };
    setPlaylistsState((prev) => {
      const next = [playlist, ...prev];
      setStored(LS_PLAYLISTS, next);
      return next;
    });
    return playlist;
  }, []);

  const addTrackToPlaylist = useCallback((playlistId: string, track: Track) => {
    setPlaylistsState((prev) => {
      const next = prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        if (pl.tracks.find((t) => t.id === track.id)) return pl;
        return { ...pl, tracks: [...pl.tracks, track] };
      });
      setStored(LS_PLAYLISTS, next);
      return next;
    });
  }, []);

  const deletePlaylist = useCallback((playlistId: string) => {
    setPlaylistsState((prev) => {
      const next = prev.filter((pl) => pl.id !== playlistId);
      setStored(LS_PLAYLISTS, next);
      return next;
    });
  }, []);

  return { playlists, createPlaylist, addTrackToPlaylist, deletePlaylist };
}
