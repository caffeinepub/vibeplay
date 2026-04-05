/**
 * useLastFmData — hooks for fetching Last.fm data for the recommendation engine.
 */
import { useEffect, useState } from "react";
import {
  type LastFmTrack,
  getLastFmSimilarTracks,
  getLastFmTopTracks,
  lastFmTrackToTrack,
} from "../services/lastfmService";
import type { Track } from "../types";

/**
 * Fetches global trending tracks from Last.fm.
 * Tracks have source='lastfm' and need YouTube IDs resolved before playback.
 * For display only, their Last.fm thumbnail is shown immediately.
 */
export function useTrendingTracks(limit = 20): {
  tracks: Track[];
  isLoading: boolean;
} {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const raw: LastFmTrack[] = await getLastFmTopTracks(limit);
        if (!cancelled) {
          setTracks(raw.map(lastFmTrackToTrack));
        }
      } catch {
        // Silent failure — Last.fm is a bonus source
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { tracks, isLoading };
}

/**
 * Fetches similar tracks from Last.fm for the currently playing song.
 * Pass undefined to both to skip the fetch.
 */
export function useSimilarArtistsTracks(
  artistName: string | undefined,
  trackName: string | undefined,
): { tracks: Track[]; isLoading: boolean } {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!artistName || !trackName) {
      setTracks([]);
      return;
    }

    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const raw: LastFmTrack[] = await getLastFmSimilarTracks(
          artistName!,
          trackName!,
        );
        if (!cancelled) {
          setTracks(raw.map(lastFmTrackToTrack));
        }
      } catch {
        // Silent failure
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [artistName, trackName]);

  return { tracks, isLoading };
}
