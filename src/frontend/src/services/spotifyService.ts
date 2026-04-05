/**
 * Spotify Web API service (Client Credentials Flow — no user login).
 * All requests are cached using the shared apiCache utilities.
 *
 * IMPORTANT: Set SPOTIFY_CLIENT_SECRET in constants.ts to enable Spotify.
 * If the secret is empty, all methods gracefully return empty arrays.
 */
import {
  SPOTIFY_API_BASE,
  SPOTIFY_AUTH_URL,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
} from "../constants";
import type { Track } from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";

const SPOTIFY_TOKEN_CACHE_KEY = "spotify_token";
// Token TTL: 55 minutes (Spotify tokens last 60min; give a 5min buffer)
const TOKEN_TTL_MS = 55 * 60 * 1000;

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  preview_url: string | null;
  popularity: number;
}

interface SpotifyTokenCache {
  token: string;
  expiresAt: number;
}

/**
 * Gets a valid Spotify access token using Client Credentials Flow.
 * Returns null if the secret is not configured or on any error.
 */
export async function getSpotifyToken(): Promise<string | null> {
  // Graceful no-op if secret not configured
  if (!SPOTIFY_CLIENT_SECRET) return null;

  // Check for a still-valid cached token
  const cached = cacheGet<SpotifyTokenCache>(SPOTIFY_TOKEN_CACHE_KEY);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  try {
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
    const token: string = data.access_token;
    if (!token) return null;

    // Cache with explicit expiry
    cacheSet<SpotifyTokenCache>(SPOTIFY_TOKEN_CACHE_KEY, {
      token,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });

    return token;
  } catch {
    return null;
  }
}

/**
 * Search Spotify for tracks matching the query.
 * Returns up to 10 SpotifyTrack results, or empty array on failure/no-secret.
 */
export async function searchSpotify(query: string): Promise<SpotifyTrack[]> {
  const token = await getSpotifyToken();
  if (!token) return [];

  const ck = cacheKey("spotify_search", query.trim().toLowerCase());
  const cached = cacheGet<SpotifyTrack[]>(ck);
  if (cached) return cached;

  try {
    const url = new URL(`${SPOTIFY_API_BASE}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "10");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const tracks: SpotifyTrack[] = data.tracks?.items ?? [];
    cacheSet(ck, tracks);
    return tracks;
  } catch {
    return [];
  }
}

/**
 * Get Spotify track recommendations based on seed artist IDs and/or track IDs.
 * Returns up to 20 SpotifyTrack results, or empty array on failure/no-secret.
 */
export async function getSpotifyRecommendations(
  seedArtistIds: string[],
  seedTrackIds: string[],
): Promise<SpotifyTrack[]> {
  const token = await getSpotifyToken();
  if (!token) return [];

  const ck = cacheKey(
    "spotify_rec",
    seedArtistIds.join(","),
    seedTrackIds.join(","),
  );
  const cached = cacheGet<SpotifyTrack[]>(ck);
  if (cached) return cached;

  try {
    const url = new URL(`${SPOTIFY_API_BASE}/recommendations`);
    if (seedArtistIds.length > 0) {
      url.searchParams.set("seed_artists", seedArtistIds.slice(0, 2).join(","));
    }
    if (seedTrackIds.length > 0) {
      url.searchParams.set("seed_tracks", seedTrackIds.slice(0, 3).join(","));
    }
    url.searchParams.set("limit", "20");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const tracks: SpotifyTrack[] = data.tracks ?? [];
    cacheSet(ck, tracks);
    return tracks;
  } catch {
    return [];
  }
}

/**
 * Converts a SpotifyTrack to our app's Track format.
 * Note: the `id` field will be the Spotify ID initially; it must be replaced
 * with a YouTube videoId before playback (handled by youtubeService.resolveTrackForPlayback).
 */
export function spotifyTrackToTrack(st: SpotifyTrack): Track {
  // Get largest album art image available
  const images = st.album.images.sort(
    (a, b) => (b.width ?? 0) - (a.width ?? 0),
  );
  const albumArtUrl = images[0]?.url ?? "";

  return {
    id: st.id,
    title: st.name,
    channelName: st.artists.map((a) => a.name).join(", "),
    artist: st.artists[0]?.name ?? "",
    album: st.album.name,
    albumArt: albumArtUrl,
    thumbnail: albumArtUrl,
    source: "spotify",
    // These will be fetched lazily when user plays the track
    duration: undefined,
    viewCount: undefined,
    tags: [],
  };
}
