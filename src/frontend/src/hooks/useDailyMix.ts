/**
 * Daily Mix hook — generates 3 personalised playlists from listening history.
 *
 * Mix 1: Top most-played songs + Spotify recommendations based on them
 * Mix 2: Recently played artists + their similar tracks
 * Mix 3: Discovery — 70% new genre tracks, 30% familiar favourites
 *
 * Each mix is cached for 24h in localStorage under 'vp_dailymix_v1'.
 */
import { useCallback, useEffect, useState } from "react";
import {
  LASTFM_API_BASE,
  LASTFM_API_KEY,
  SPOTIFY_API_BASE,
  SPOTIFY_AUTH_URL,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  YOUTUBE_API_BASE,
  fetchWithKeyFallback,
} from "../constants";
import type { Track } from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";
import { normalizeKey } from "../utils/playHistory";
import { findBestYouTubeMatch } from "../utils/youtubeMatchEngine";

const LS_DAILY_MIX = "vp_dailymix_v1";
const TTL_MS = 24 * 60 * 60 * 1000;
const MIX_SIZE = 15;

// ── Types ──────────────────────────────────────────────────────────────────

export interface DailyMix {
  id: number; // 1 | 2 | 3
  title: string;
  subtitle: string;
  gradient: string;
  tracks: Track[];
  coverThumbnails: string[]; // up to 4 thumbnails for collage
}

interface CachedMixes {
  mixes: DailyMix[];
  generatedAt: number;
}

interface PlayHistoryEntry {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  playCount: number;
  tags?: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function readPlayHistory(): PlayHistoryEntry[] {
  try {
    // continueListening and vibeplay_behavior_events both carry useful history
    const cl = localStorage.getItem("vibeplay_continue_listening");
    const parsed: Track[] = cl ? (JSON.parse(cl) as Track[]) : [];
    const seen = new Set<string>();
    const entries: PlayHistoryEntry[] = [];
    for (const t of parsed) {
      const k = normalizeKey(t.title, t.artist ?? t.channelName);
      if (!seen.has(k)) {
        seen.add(k);
        entries.push({
          id: t.id,
          title: t.title,
          artist: t.artist ?? t.channelName,
          thumbnail: t.thumbnail,
          playCount: 1,
          tags: t.tags,
        });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

function readFavourites(): Track[] {
  try {
    const raw = localStorage.getItem("vibeplay_favorites");
    return raw ? (JSON.parse(raw) as Track[]) : [];
  } catch {
    return [];
  }
}

async function getSpotifyToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_SECRET || !SPOTIFY_CLIENT_ID) return null;
  const TOKEN_KEY = "vibeplay_spotify_token_v2";
  const TOKEN_TTL = 55 * 60 * 1000;
  try {
    const cached = cacheGet<{ token: string; expiresAt: number }>(TOKEN_KEY);
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
    cacheSet(TOKEN_KEY, { token, expiresAt: Date.now() + TOKEN_TTL });
    return token;
  } catch {
    return null;
  }
}

async function spotifyRecsForSeeds(
  seedVideoIds: string[],
  token: string,
): Promise<Track[]> {
  if (!seedVideoIds.length) return [];
  // Resolve video titles to Spotify track IDs
  const history = readPlayHistory();
  const seedTitles = seedVideoIds
    .map((id) => history.find((h) => h.id === id))
    .filter(Boolean) as PlayHistoryEntry[];
  if (!seedTitles.length) return [];

  const seedTrackIds: string[] = [];
  for (const entry of seedTitles.slice(0, 3)) {
    const ck = cacheKey("sp_resolve", entry.title, entry.artist);
    const cached = cacheGet<{ trackId: string | null }>(ck);
    if (cached?.trackId) {
      seedTrackIds.push(cached.trackId);
      continue;
    }
    try {
      const url = new URL(`${SPOTIFY_API_BASE}/search`);
      url.searchParams.set("q", `track:${entry.title} artist:${entry.artist}`);
      url.searchParams.set("type", "track");
      url.searchParams.set("limit", "1");
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const id = data.tracks?.items?.[0]?.id as string | undefined;
      if (id) {
        cacheSet(ck, { trackId: id });
        seedTrackIds.push(id);
      }
    } catch {
      // skip
    }
  }

  if (!seedTrackIds.length) return [];
  const ck = cacheKey("sp_recs_daily", seedTrackIds.join(","));
  const existing = cacheGet<Track[]>(ck);
  if (existing) return existing;

  try {
    const url = new URL(`${SPOTIFY_API_BASE}/recommendations`);
    url.searchParams.set("seed_tracks", seedTrackIds.slice(0, 5).join(","));
    url.searchParams.set("limit", "25");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const spTracks = data.tracks ?? [];
    const resolved: Track[] = [];
    for (const sp of spTracks.slice(0, 15)) {
      const name: string = sp.name;
      const artist: string = sp.artists?.[0]?.name ?? "";
      const thumb: string = sp.album?.images?.[0]?.url ?? "";
      try {
        const match = await findBestYouTubeMatch(name, artist, sp.duration_ms);
        if (match) {
          resolved.push({
            id: match.videoId,
            title: name,
            channelName: artist,
            artist,
            thumbnail: match.thumbnail || thumb,
            duration: match.duration,
            source: "youtube",
          });
        }
      } catch {
        // skip
      }
      if (resolved.length >= MIX_SIZE) break;
    }
    cacheSet(ck, resolved);
    return resolved;
  } catch {
    return [];
  }
}

async function lastFmGenreTracks(tag: string): Promise<Track[]> {
  const ck = cacheKey("lfm_tag_tracks", tag);
  const existing = cacheGet<Track[]>(ck);
  if (existing) return existing;
  try {
    const url = new URL(LASTFM_API_BASE);
    url.searchParams.set("method", "tag.gettoptracks");
    url.searchParams.set("tag", tag);
    url.searchParams.set("limit", "20");
    url.searchParams.set("api_key", LASTFM_API_KEY);
    url.searchParams.set("format", "json");
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.tracks?.track ?? [];
    const resolved: Track[] = [];
    for (const item of items.slice(0, 10)) {
      const name: string = item.name;
      const artist: string =
        typeof item.artist === "string"
          ? item.artist
          : (item.artist?.name ?? "");
      try {
        const match = await findBestYouTubeMatch(name, artist);
        if (match) {
          resolved.push({
            id: match.videoId,
            title: name,
            channelName: artist,
            artist,
            thumbnail: match.thumbnail,
            duration: match.duration,
            source: "youtube",
          });
        }
      } catch {
        // skip
      }
      if (resolved.length >= MIX_SIZE) break;
    }
    cacheSet(ck, resolved);
    return resolved;
  } catch {
    return [];
  }
}

async function youTubeSearchTracks(query: string): Promise<Track[]> {
  try {
    const res = await fetchWithKeyFallback((key) => {
      const u = new URL(`${YOUTUBE_API_BASE}/search`);
      u.searchParams.set("part", "snippet");
      u.searchParams.set("q", query);
      u.searchParams.set("type", "video");
      u.searchParams.set("videoCategoryId", "10");
      u.searchParams.set("maxResults", "15");
      u.searchParams.set("key", key);
      return u.toString();
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? [])
      .map(
        (item: {
          id?: { videoId?: string };
          snippet?: {
            title?: string;
            channelTitle?: string;
            thumbnails?: { medium?: { url: string } };
          };
        }) => ({
          id: item.id?.videoId ?? "",
          title: item.snippet?.title ?? "",
          channelName: item.snippet?.channelTitle ?? "",
          thumbnail: item.snippet?.thumbnails?.medium?.url ?? "",
          source: "youtube" as const,
        }),
      )
      .filter((t: Track) => t.id);
  } catch {
    return [];
  }
}

/** Deduplicate tracks by id */
function dedupe(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    if (!t.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

// ── Mix generators ─────────────────────────────────────────────────────────

async function buildMix1(history: PlayHistoryEntry[]): Promise<Track[]> {
  if (!history.length) {
    return youTubeSearchTracks("trending hindi songs official audio");
  }
  const token = await getSpotifyToken();
  const topIds = history.slice(0, 10).map((h) => h.id);
  if (token) {
    const recs = await spotifyRecsForSeeds(topIds, token);
    if (recs.length >= 5) return dedupe(recs).slice(0, MIX_SIZE);
  }
  // Fallback: Last.fm popular indian
  const lfm = await lastFmGenreTracks("bollywood");
  return dedupe(lfm).slice(0, MIX_SIZE);
}

async function buildMix2(history: PlayHistoryEntry[]): Promise<Track[]> {
  if (!history.length) {
    return youTubeSearchTracks("trending punjabi songs official audio");
  }
  // Use last 5 played artists
  const recentArtists = Array.from(
    new Set(history.slice(0, 10).map((h) => h.artist.toLowerCase())),
  ).slice(0, 5);
  const allTracks: Track[] = [];
  for (const artist of recentArtists) {
    if (allTracks.length >= MIX_SIZE) break;
    const results = await youTubeSearchTracks(`${artist} songs official audio`);
    allTracks.push(...results.slice(0, 4));
  }
  return dedupe(allTracks).slice(0, MIX_SIZE);
}

async function buildMix3(history: PlayHistoryEntry[]): Promise<Track[]> {
  // 30% familiar favourites
  const favs = readFavourites().slice(0, 5);
  // 70% discovery — use Last.fm genre tags derived from history
  const tagCandidates = history.flatMap((h) => h.tags ?? []);
  const topTag = tagCandidates.length > 0 ? tagCandidates[0] : "indian pop";
  const [discovery, fallback] = await Promise.all([
    lastFmGenreTracks(topTag),
    youTubeSearchTracks("new hindi songs 2024 official audio"),
  ]);
  const combined = dedupe([...discovery, ...fallback]);
  const favYt = favs.filter((t) => t.source !== "spotify");
  return dedupe([...combined.slice(0, 10), ...favYt]).slice(0, MIX_SIZE);
}

// ── Main hook ──────────────────────────────────────────────────────────────

export function useDailyMix() {
  const [mixes, setMixes] = useState<DailyMix[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const generate = useCallback(async () => {
    setIsLoading(true);
    try {
      const history = readPlayHistory();

      const [mix1Tracks, mix2Tracks, mix3Tracks] = await Promise.all([
        buildMix1(history),
        buildMix2(history),
        buildMix3(history),
      ]);

      const built: DailyMix[] = [
        {
          id: 1,
          title: "Daily Mix 1",
          subtitle: "Your top picks",
          gradient:
            "linear-gradient(135deg, oklch(0.58 0.24 293), oklch(0.62 0.24 350))",
          tracks: mix1Tracks,
          coverThumbnails: mix1Tracks.slice(0, 4).map((t) => t.thumbnail),
        },
        {
          id: 2,
          title: "Daily Mix 2",
          subtitle: "Based on your artists",
          gradient:
            "linear-gradient(135deg, oklch(0.62 0.24 350), oklch(0.72 0.19 55))",
          tracks: mix2Tracks,
          coverThumbnails: mix2Tracks.slice(0, 4).map((t) => t.thumbnail),
        },
        {
          id: 3,
          title: "Daily Mix 3",
          subtitle: "Discover something new",
          gradient:
            "linear-gradient(135deg, oklch(0.75 0.17 200), oklch(0.58 0.24 293))",
          tracks: mix3Tracks,
          coverThumbnails: mix3Tracks.slice(0, 4).map((t) => t.thumbnail),
        },
      ];

      const toCache: CachedMixes = { mixes: built, generatedAt: Date.now() };
      localStorage.setItem(LS_DAILY_MIX, JSON.stringify(toCache));
      setMixes(built);
    } catch (err) {
      console.error("[DailyMix] generation failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_DAILY_MIX);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedMixes;
        if (Date.now() - parsed.generatedAt < TTL_MS && parsed.mixes?.length) {
          setMixes(parsed.mixes);
          return;
        }
      }
    } catch {
      // ignore — regenerate
    }
    generate();
  }, [generate]);

  return { mixes, isLoading, refresh: generate };
}
