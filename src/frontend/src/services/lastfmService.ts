/**
 * Last.fm API service.
 * No authentication required — uses API key only.
 * All requests are cached using the shared apiCache utilities.
 */
import { LASTFM_API_BASE, LASTFM_API_KEY } from "../constants";
import type { Track } from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";

export interface LastFmTrack {
  name: string;
  artist: { name: string } | string;
  image?: { "#text": string; size: string }[];
  playcount?: string;
  url?: string;
}

export interface LastFmArtist {
  name: string;
  image?: { "#text": string; size: string }[];
  playcount?: string;
}

/** Extract artist name from a LastFmTrack (artist can be string or object) */
function getArtistName(t: LastFmTrack): string {
  if (typeof t.artist === "string") return t.artist;
  return t.artist.name ?? "";
}

/**
 * Get the best (largest non-empty) image URL from a Last.fm image array.
 * Last.fm sizes: small, medium, large, extralarge, mega
 */
function getBestImage(images?: { "#text": string; size: string }[]): string {
  if (!images) return "";
  const sizeOrder = ["mega", "extralarge", "large", "medium", "small"];
  for (const size of sizeOrder) {
    const img = images.find((i) => i.size === size && i["#text"]);
    if (img) return img["#text"];
  }
  // Fallback: first non-empty image
  return images.find((i) => i["#text"])?.["#text"] ?? "";
}

/**
 * Fetch global top tracks from Last.fm chart.
 */
export async function getLastFmTopTracks(limit = 20): Promise<LastFmTrack[]> {
  const ck = cacheKey("lastfm_top_tracks", String(limit));
  const cached = cacheGet<LastFmTrack[]>(ck);
  if (cached) return cached;

  try {
    const url = new URL(LASTFM_API_BASE);
    url.searchParams.set("method", "chart.gettoptracks");
    url.searchParams.set("api_key", LASTFM_API_KEY);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const data = await res.json();
    const tracks: LastFmTrack[] = data.tracks?.track ?? [];
    cacheSet(ck, tracks);
    return tracks;
  } catch {
    return [];
  }
}

/**
 * Fetch global top artists from Last.fm chart.
 */
export async function getLastFmTopArtists(limit = 20): Promise<LastFmArtist[]> {
  const ck = cacheKey("lastfm_top_artists", String(limit));
  const cached = cacheGet<LastFmArtist[]>(ck);
  if (cached) return cached;

  try {
    const url = new URL(LASTFM_API_BASE);
    url.searchParams.set("method", "chart.gettopartists");
    url.searchParams.set("api_key", LASTFM_API_KEY);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const data = await res.json();
    const artists: LastFmArtist[] = data.artists?.artist ?? [];
    cacheSet(ck, artists);
    return artists;
  } catch {
    return [];
  }
}

/**
 * Fetch top tracks for a given tag/genre from Last.fm.
 */
export async function getLastFmTagTracks(
  tag: string,
  limit = 15,
): Promise<LastFmTrack[]> {
  const ck = cacheKey("lastfm_tag", tag);
  const cached = cacheGet<LastFmTrack[]>(ck);
  if (cached) return cached;

  try {
    const url = new URL(LASTFM_API_BASE);
    url.searchParams.set("method", "tag.gettoptracks");
    url.searchParams.set("tag", tag);
    url.searchParams.set("api_key", LASTFM_API_KEY);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const data = await res.json();
    const tracks: LastFmTrack[] = data.tracks?.track ?? [];
    cacheSet(ck, tracks);
    return tracks;
  } catch {
    return [];
  }
}

/**
 * Fetch similar tracks for a given artist + track from Last.fm.
 */
export async function getLastFmSimilarTracks(
  artist: string,
  track: string,
  limit = 10,
): Promise<LastFmTrack[]> {
  const ck = cacheKey("lastfm_similar", artist, track);
  const cached = cacheGet<LastFmTrack[]>(ck);
  if (cached) return cached;

  try {
    const url = new URL(LASTFM_API_BASE);
    url.searchParams.set("method", "track.getsimilar");
    url.searchParams.set("artist", artist);
    url.searchParams.set("track", track);
    url.searchParams.set("api_key", LASTFM_API_KEY);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const data = await res.json();
    const tracks: LastFmTrack[] = data.similartracks?.track ?? [];
    cacheSet(ck, tracks);
    return tracks;
  } catch {
    return [];
  }
}

/**
 * Build a YouTube search query string from a Last.fm track.
 * Format: "Song Name Artist Name"
 */
export function lastFmTrackToQuery(t: LastFmTrack): string {
  return `${t.name} ${getArtistName(t)}`;
}

/**
 * Convert a LastFmTrack to our app's Track format.
 * The `id` is a temporary placeholder; replace with YouTube videoId before playback.
 */
export function lastFmTrackToTrack(t: LastFmTrack): Track {
  const artistName = getArtistName(t);
  const thumbnail = getBestImage(t.image);

  return {
    id: `lastfm_${encodeURIComponent(`${t.name}_${artistName}`)}`,
    title: t.name,
    channelName: artistName,
    artist: artistName,
    thumbnail,
    albumArt: thumbnail,
    source: "lastfm",
    tags: [],
  };
}
