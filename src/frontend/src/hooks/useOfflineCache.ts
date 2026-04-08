/**
 * Offline cache hook — caches track metadata (NOT audio) for offline display.
 * YouTube ToS prohibits storing audio; we store only metadata (id, title, artist, thumbnail).
 * Uses localStorage with a capped 20-entry ring buffer.
 */
import { useCallback, useEffect, useState } from "react";
import type { Track } from "../types";

const LS_OFFLINE_CACHE = "vp_offline_cache_v1";
const MAX_CACHED = 20;

interface CachedTrackEntry {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  cachedAt: number;
}

function readCache(): CachedTrackEntry[] {
  try {
    const raw = localStorage.getItem(LS_OFFLINE_CACHE);
    return raw ? (JSON.parse(raw) as CachedTrackEntry[]) : [];
  } catch {
    return [];
  }
}

function writeCache(entries: CachedTrackEntry[]) {
  try {
    localStorage.setItem(LS_OFFLINE_CACHE, JSON.stringify(entries));
  } catch {
    // ignore quota errors
  }
}

function entryToTrack(e: CachedTrackEntry): Track {
  return {
    id: e.videoId,
    title: e.title,
    channelName: e.artist,
    artist: e.artist,
    thumbnail: e.thumbnail,
    source: "youtube",
  };
}

export function useOfflineCache() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [cachedSongs, setCachedSongs] = useState<Track[]>(() =>
    readCache().map(entryToTrack),
  );

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const cacheTrack = useCallback((track: Track) => {
    const entry: CachedTrackEntry = {
      videoId: track.id,
      title: track.title,
      artist: track.artist ?? track.channelName,
      thumbnail: track.thumbnail,
      cachedAt: Date.now(),
    };
    const existing = readCache();
    // Remove duplicate by videoId, then prepend
    const filtered = existing.filter((e) => e.videoId !== entry.videoId);
    const updated = [entry, ...filtered].slice(0, MAX_CACHED);
    writeCache(updated);
    setCachedSongs(updated.map(entryToTrack));
  }, []);

  const clearCache = useCallback(() => {
    writeCache([]);
    setCachedSongs([]);
  }, []);

  return { cachedSongs, isOffline, cacheTrack, clearCache };
}
