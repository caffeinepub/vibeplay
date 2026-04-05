/**
 * Smart "Up Next" recommendation hook.
 *
 * Flow:
 *  1. PRIMARY: Spotify /v1/recommendations (seed_tracks + seed_artists) → 15-20 tracks
 *  2. FALLBACK: Last.fm track.getsimilar if Spotify unavailable
 *  3. For each candidate track: resolve to a YouTube video via youtubeMatchEngine
 *     — strict blocked-keyword filtering, scored matching, official audio priority
 *  4. Apply anti-repetition (last 10 play history), artist diversity (max 2/artist),
 *     version deduplication
 *  5. Build queue of up to 12 unique, diverse tracks
 */
import { useEffect, useRef, useState } from "react";
import {
  SPOTIFY_API_BASE,
  SPOTIFY_AUTH_URL,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
} from "../constants";
import { getLastFmSimilarTracks } from "../services/lastfmService";
import type { Track } from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";
import { normalizeKey } from "../utils/playHistory";
import { findBestYouTubeMatch } from "../utils/youtubeMatchEngine";

const MAX_QUEUE = 12;
const SPOTIFY_RECS_LIMIT = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Spotify helpers (inline to avoid needing client secret in spotifyService)
// ─────────────────────────────────────────────────────────────────────────────

const SPOTIFY_TOKEN_KEY = "vibeplay_spotify_token_v2";
const TOKEN_TTL = 55 * 60 * 1000;

async function getSpotifyToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_SECRET || !SPOTIFY_CLIENT_ID) return null;
  try {
    const cached = cacheGet<{ token: string; expiresAt: number }>(
      SPOTIFY_TOKEN_KEY,
    );
    if (cached && Date.now() < cached.expiresAt) return cached.token;

    const credentials = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
    const res = await fetch(SPOTIFY_AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const token = data.access_token as string;
    if (!token) return null;
    cacheSet(SPOTIFY_TOKEN_KEY, { token, expiresAt: Date.now() + TOKEN_TTL });
    return token;
  } catch {
    return null;
  }
}

/**
 * Search Spotify for the current track to get its Spotify track ID + artist ID.
 */
async function resolveSpotifyIds(
  title: string,
  artist: string,
  token: string,
): Promise<{ trackId: string | null; artistId: string | null }> {
  const ck = cacheKey("sp_resolve", title, artist);
  const cached = cacheGet<{ trackId: string | null; artistId: string | null }>(
    ck,
  );
  if (cached) return cached;

  const query = `track:${title} artist:${artist}`;
  try {
    const url = new URL(`${SPOTIFY_API_BASE}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "3");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { trackId: null, artistId: null };
    const data = await res.json();
    const first = data.tracks?.items?.[0];
    if (!first) return { trackId: null, artistId: null };
    const result = {
      trackId: first.id as string,
      artistId: (first.artists?.[0]?.id ?? null) as string | null,
    };
    cacheSet(ck, result);
    return result;
  } catch {
    return { trackId: null, artistId: null };
  }
}

export interface SpotifyRecTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { images: { url: string }[] };
  duration_ms: number;
  popularity: number;
}

/**
 * Fetch Spotify recommendations using seed track and/or seed artist.
 */
async function fetchSpotifyRecommendations(
  trackId: string | null,
  artistId: string | null,
  token: string,
): Promise<SpotifyRecTrack[]> {
  if (!trackId && !artistId) return [];

  const ck = cacheKey("sp_recs_v2", trackId ?? "", artistId ?? "");
  const cached = cacheGet<SpotifyRecTrack[]>(ck);
  if (cached) return cached;

  try {
    const url = new URL(`${SPOTIFY_API_BASE}/recommendations`);
    if (trackId) url.searchParams.set("seed_tracks", trackId);
    if (artistId) url.searchParams.set("seed_artists", artistId);
    url.searchParams.set("limit", String(SPOTIFY_RECS_LIMIT));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const tracks: SpotifyRecTrack[] = data.tracks ?? [];
    cacheSet(ck, tracks);
    return tracks;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Play history helpers (session-level)
// ─────────────────────────────────────────────────────────────────────────────

const LS_HISTORY = "vibeplay_up_next_history";
const MAX_HISTORY = 10;

interface HistEntry {
  id: string;
  titleKey: string; // normalizeKey(title, artist)
}

function getHistory(): HistEntry[] {
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    return raw ? (JSON.parse(raw) as HistEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordPlayedTrack(track: Track): void {
  try {
    const entry: HistEntry = {
      id: track.id,
      titleKey: normalizeKey(track.title, track.artist ?? track.channelName),
    };
    const history = getHistory();
    const filtered = history.filter(
      (h) => h.id !== entry.id && h.titleKey !== entry.titleKey,
    );
    const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
    localStorage.setItem(LS_HISTORY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function isInHistory(
  ytVideoId: string,
  titleKey: string,
  historyIds: Set<string>,
  historyKeys: Set<string>,
): boolean {
  return historyIds.has(ytVideoId) || historyKeys.has(titleKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────────────────────────────────────

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

      // Check final output cache first
      const ck = cacheKey("upnext_v3", track.id);
      const cached = cacheGet<Track[]>(ck);
      if (cached) {
        if (!cancelled) {
          setRelatedTracks(cached);
          setIsLoading(false);
        }
        return;
      }

      try {
        const currentTitle = track.title;
        const currentArtist = track.artist ?? track.channelName;

        // Build history sets for dedup
        const history = getHistory();
        const historyIds = new Set(history.map((h) => h.id));
        const historyKeys = new Set(history.map((h) => h.titleKey));
        // Also exclude the currently playing track
        historyIds.add(track.id);
        historyKeys.add(normalizeKey(currentTitle, currentArtist));

        // ── Step 1: Try Spotify recommendations ────────────────────────────
        let candidates: Array<{
          name: string;
          artist: string;
          thumbnail: string;
          durationMs?: number;
          spotifyId?: string;
        }> = [];

        const token = await getSpotifyToken();
        if (token) {
          const { trackId: spTrackId, artistId: spArtistId } =
            await resolveSpotifyIds(currentTitle, currentArtist, token);

          if (spTrackId || spArtistId) {
            const recs = await fetchSpotifyRecommendations(
              spTrackId,
              spArtistId,
              token,
            );

            for (const r of recs) {
              const artistName = r.artists[0]?.name ?? "";
              const thumbnail = r.album.images[0]?.url ?? "";
              candidates.push({
                name: r.name,
                artist: artistName,
                thumbnail,
                durationMs: r.duration_ms,
                spotifyId: r.id,
              });
            }
          }
        }

        // ── Step 2: Last.fm fallback ──────────────────────────────────────────
        if (candidates.length < 8) {
          try {
            const similar = await getLastFmSimilarTracks(
              currentArtist,
              currentTitle,
              15,
            );
            for (const t of similar) {
              const artistName =
                typeof t.artist === "string" ? t.artist : t.artist.name;
              const thumbnail =
                t.image?.find((i) => i.size === "large")?.["#text"] ??
                t.image?.[0]?.["#text"] ??
                "";
              // Avoid pushing candidates already found via Spotify
              const alreadyIn = candidates.some(
                (c) =>
                  normalizeKey(c.name, c.artist) ===
                  normalizeKey(t.name, artistName),
              );
              if (!alreadyIn) {
                candidates.push({
                  name: t.name,
                  artist: artistName,
                  thumbnail,
                });
              }
            }
          } catch {
            // Last.fm optional
          }
        }

        if (candidates.length === 0 || cancelled) {
          if (!cancelled) setRelatedTracks([]);
          return;
        }

        // ── Step 3: Anti-repetition filter (history + current track) ─────────
        candidates = candidates.filter((c) => {
          const titleKey = normalizeKey(c.name, c.artist);
          // Only check by titleKey here (we don't have YT ID yet)
          return !historyKeys.has(titleKey);
        });

        // ── Step 4: Artist diversity (max 2 per artist) ────────────────────
        const artistCount = new Map<string, number>();
        candidates = candidates.filter((c) => {
          const normArtist = c.artist.toLowerCase().trim();
          const count = artistCount.get(normArtist) ?? 0;
          if (count >= 2) return false;
          artistCount.set(normArtist, count + 1);
          return true;
        });

        // ── Step 5: Resolve each candidate to a YouTube video via match engine ─
        // Process up to 20 candidates, stop when we have MAX_QUEUE good results
        const resolvedTracks: Track[] = [];
        const seenTitleKeys = new Set<string>();
        const seenYtIds = new Set<string>([track.id]);

        const toProcess = candidates.slice(0, 20);

        for (const candidate of toProcess) {
          if (cancelled) break;
          if (resolvedTracks.length >= MAX_QUEUE) break;

          const titleKey = normalizeKey(candidate.name, candidate.artist);
          if (seenTitleKeys.has(titleKey)) continue;

          // Also check against full history (after we have titleKey)
          if (isInHistory("", titleKey, historyIds, historyKeys)) continue;

          try {
            const match = await findBestYouTubeMatch(
              candidate.name,
              candidate.artist,
              candidate.durationMs,
            );

            if (!match || match.confidence < 0.15) continue;

            // Skip if we've already queued this YT video
            if (seenYtIds.has(match.videoId)) continue;
            // Skip if YT video ID is in history
            if (historyIds.has(match.videoId)) continue;

            seenTitleKeys.add(titleKey);
            seenYtIds.add(match.videoId);

            resolvedTracks.push({
              id: match.videoId,
              title: candidate.name,
              channelName: candidate.artist,
              artist: candidate.artist,
              thumbnail: match.thumbnail || candidate.thumbnail,
              duration: match.duration,
              source: "youtube" as const,
            });
          } catch {
            // Skip failed resolves
          }
        }

        if (cancelled) return;

        cacheSet(ck, resolvedTracks);
        setRelatedTracks(resolvedTracks);
      } catch (err) {
        console.error("Up Next fetch failed:", err);
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
