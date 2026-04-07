/**
 * Import Playlist Service
 * Handles fetching YouTube and Spotify playlists for import into VibePlay.
 *
 * - YouTube playlists: fetched directly via YouTube Data API
 * - Spotify playlists: fetched via Spotify API, then each track is resolved
 *   to a YouTube video using the YouTube Match Engine
 *
 * Bug fixes:
 * - Spotify token is fetched ONCE before batch processing; clear error on failure
 * - findBestYouTubeMatch wrapped in 8s timeout; falls back to simple search
 * - detectPlatform handles URLs without scheme (e.g. pasted without https://)
 * - Batch failures are retried once with simple fallback search
 */
import {
  SPOTIFY_API_BASE,
  SPOTIFY_AUTH_URL,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  YOUTUBE_API_BASE,
  fetchWithKeyFallback,
} from "../constants";
import type { Track } from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";
import { findBestYouTubeMatch } from "../utils/youtubeMatchEngine";

export type ImportPlatform = "youtube" | "spotify" | "unknown";

export interface ImportedPlaylist {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  tracks: Track[];
  platform: ImportPlatform;
}

const MATCH_TIMEOUT_MS = 8000;
const BLOCKED_IMPORT_KEYWORDS = [
  "remix",
  "lofi",
  "lo-fi",
  "slowed",
  "reverb",
  "cover",
  "live",
  "dj",
  "karaoke",
  "lyrics",
  "mashup",
];

/**
 * Normalize a pasted URL: trim whitespace and ensure it starts with https://
 * so URL parser can always handle it correctly.
 */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^spotify:/i.test(trimmed)) return trimmed; // keep spotify: URIs as-is
  return `https://${trimmed}`;
}

/**
 * Detect which platform a URL belongs to.
 * Handles URLs with or without the https:// scheme, all subdomain variants,
 * and Spotify URI format (spotify:playlist:ID).
 */
export function detectPlatform(url: string): ImportPlatform {
  const normalized = normalizeUrl(url).toLowerCase();
  if (
    normalized.includes("youtube.com/playlist") ||
    normalized.includes("music.youtube.com/playlist") ||
    normalized.includes("m.youtube.com/playlist") ||
    normalized.includes("youtu.be/playlist")
  ) {
    return "youtube";
  }
  if (
    normalized.includes("open.spotify.com/playlist") ||
    normalized.includes("spotify.com/playlist") ||
    normalized.startsWith("spotify:playlist:")
  ) {
    return "spotify";
  }
  return "unknown";
}

/**
 * Extract the playlist ID from a YouTube playlist URL.
 * Handles youtube.com, music.youtube.com, www.youtube.com, m.youtube.com,
 * with or without https:// scheme.
 * Returns null with a descriptive message on failure.
 */
export function extractYouTubePlaylistId(url: string): string | null {
  const withScheme = normalizeUrl(url);
  try {
    const parsed = new URL(withScheme);
    const listParam = parsed.searchParams.get("list");
    if (listParam) return listParam;
  } catch {
    // URL constructor failed — fall through to regex
  }
  // Regex fallback for malformed URLs
  const match = withScheme.match(/[?&]list=([^&\s#]+)/);
  return match ? match[1] : null;
}

/**
 * Extract the playlist ID from a Spotify playlist URL or URI.
 * Handles:
 *   open.spotify.com/playlist/PLAYLISTID
 *   spotify.com/playlist/PLAYLISTID
 *   spotify:playlist:PLAYLISTID (URI format)
 */
export function extractSpotifyPlaylistId(url: string): string | null {
  const trimmed = url.trim();
  // Handle Spotify URI format: spotify:playlist:PLAYLISTID
  const uriMatch = trimmed.match(/^spotify:playlist:([A-Za-z0-9]+)/i);
  if (uriMatch) return uriMatch[1];
  // Handle all URL variants: .../playlist/PLAYLISTID
  const urlMatch = trimmed.match(/playlist[/:]([A-Za-z0-9]+)/i);
  return urlMatch ? urlMatch[1] : null;
}

// ─── Spotify Token ─────────────────────────────────────────────────────────────

interface SpotifyTokenCache {
  token: string;
  expiresAt: number;
}

async function getSpotifyToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_SECRET || !SPOTIFY_CLIENT_ID) return null;

  const cached = cacheGet<SpotifyTokenCache>("spotify_token_import");
  if (cached && Date.now() < cached.expiresAt) return cached.token;

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
    cacheSet<SpotifyTokenCache>("spotify_token_import", {
      token,
      expiresAt: Date.now() + 55 * 60 * 1000,
    });
    return token;
  } catch {
    return null;
  }
}

// ─── Simple YouTube search fallback ──────────────────────────────────────────

/**
 * Simple fallback: search YouTube for "songName artistName official audio"
 * and return the first result that isn't blocked by keywords.
 * Duration filter: prefer videos > 2 minutes (>= 120s equivalent title check isn't possible
 * without extra API call, so we just filter by keywords).
 */
async function simpleYouTubeSearch(
  songName: string,
  artistName: string,
  albumArt: string,
): Promise<Track | null> {
  try {
    const query = `${songName} ${artistName} official audio`;
    const searchRes = await fetchWithKeyFallback((key) => {
      const url = new URL(`${YOUTUBE_API_BASE}/search`);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("videoCategoryId", "10");
      url.searchParams.set("maxResults", "5");
      url.searchParams.set("key", key);
      return url.toString();
    });

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    for (const item of searchData.items ?? []) {
      const videoId: string = item.id?.videoId ?? "";
      const videoTitle: string = item.snippet?.title ?? "";
      const videoChannel: string = item.snippet?.channelTitle ?? "";
      const videoThumb: string =
        item.snippet?.thumbnails?.medium?.url || albumArt;

      if (!videoId) continue;

      // Filter blocked keywords
      const lower = videoTitle.toLowerCase();
      const isBlocked = BLOCKED_IMPORT_KEYWORDS.some((kw) =>
        lower.includes(kw),
      );
      if (isBlocked) continue;

      return {
        id: videoId,
        title: videoTitle,
        channelName: videoChannel,
        artist: artistName,
        thumbnail: videoThumb,
        source: "youtube" as const,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── findBestYouTubeMatch with timeout ───────────────────────────────────────

async function findMatchWithTimeout(
  songName: string,
  artistName: string,
  durationMs: number,
  albumArt: string,
): Promise<Track | null> {
  const matchPromise = findBestYouTubeMatch(songName, artistName, durationMs);
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), MATCH_TIMEOUT_MS),
  );

  const result = await Promise.race([matchPromise, timeoutPromise]);
  if (result) {
    return {
      id: result.videoId,
      title: result.title,
      channelName: result.channelName,
      artist: artistName,
      thumbnail: result.thumbnail || albumArt,
      duration: result.duration,
      source: "youtube" as const,
    };
  }

  // Timeout or no match — fall back to simple search
  return simpleYouTubeSearch(songName, artistName, albumArt);
}

// ─── YouTube Playlist Fetch ───────────────────────────────────────────────────

interface YouTubePlaylistItemSnippet {
  title: string;
  videoOwnerChannelTitle?: string;
  channelTitle?: string;
  thumbnails: {
    medium?: { url: string };
    default?: { url: string };
  };
  resourceId: { videoId: string };
}

interface YouTubePlaylistItem {
  snippet: YouTubePlaylistItemSnippet;
}

/**
 * Fetch a YouTube playlist and return it as an ImportedPlaylist.
 */
export async function fetchYouTubePlaylist(
  playlistId: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ImportedPlaylist> {
  const ck = cacheKey("import_yt_playlist", playlistId);
  const cached = cacheGet<ImportedPlaylist>(ck);
  if (cached) return cached;

  const [metaRes, itemsRes] = await Promise.all([
    fetchWithKeyFallback((key) => {
      const url = new URL(`${YOUTUBE_API_BASE}/playlists`);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("id", playlistId);
      url.searchParams.set("key", key);
      return url.toString();
    }),
    fetchWithKeyFallback((key) => {
      const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("playlistId", playlistId);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", key);
      return url.toString();
    }),
  ]);

  if (!metaRes.ok || !itemsRes.ok) {
    throw new Error("Could not connect to YouTube API — try again shortly.");
  }

  const [metaData, itemsData] = await Promise.all([
    metaRes.json(),
    itemsRes.json(),
  ]);

  const playlistMeta = metaData.items?.[0]?.snippet;
  if (!playlistMeta) {
    throw new Error("Playlist not found. It may be private or deleted.");
  }

  const title: string = playlistMeta.title ?? "YouTube Playlist";
  const description: string = playlistMeta.description ?? "";
  const thumbnail: string =
    playlistMeta.thumbnails?.maxres?.url ||
    playlistMeta.thumbnails?.high?.url ||
    playlistMeta.thumbnails?.medium?.url ||
    "";

  const rawItems: YouTubePlaylistItem[] = itemsData.items ?? [];
  const total = rawItems.length;
  const tracks: Track[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const snippet = rawItems[i].snippet;
    const videoId = snippet.resourceId?.videoId;
    const itemTitle = snippet.title;

    if (
      !videoId ||
      itemTitle === "Deleted video" ||
      itemTitle === "Private video"
    ) {
      onProgress?.(i + 1, total);
      continue;
    }

    const thumbUrl =
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

    tracks.push({
      id: videoId,
      title: itemTitle,
      channelName:
        snippet.videoOwnerChannelTitle || snippet.channelTitle || "YouTube",
      thumbnail: thumbUrl,
      source: "youtube",
    });

    onProgress?.(i + 1, total);
  }

  if (tracks.length === 0) {
    throw new Error(
      "This playlist appears to be empty or all videos are private.",
    );
  }

  const result: ImportedPlaylist = {
    id: playlistId,
    title,
    description,
    thumbnail,
    tracks,
    platform: "youtube",
  };

  cacheSet(ck, result);
  return result;
}

// ─── Spotify Playlist Fetch ───────────────────────────────────────────────────

interface SpotifyPlaylistTrackItem {
  track: {
    id: string;
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { images: { url: string }[] };
  } | null;
}

/**
 * Fetch a Spotify playlist, resolve each track to a YouTube video,
 * and return the result as an ImportedPlaylist.
 *
 * Token is fetched ONCE before any batch processing begins.
 * Each track uses findBestYouTubeMatch with an 8s timeout, falling back to simple search.
 * If an entire batch fails, it retries that batch using simple search only.
 */
export async function fetchSpotifyPlaylist(
  playlistId: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ImportedPlaylist> {
  const ck = cacheKey("import_sp_playlist", playlistId);
  const cached = cacheGet<ImportedPlaylist>(ck);
  if (cached) return cached;

  // Fetch token ONCE upfront — clear error message if it fails
  const token = await getSpotifyToken();
  if (!token) {
    throw new Error(
      "Could not connect to Spotify API — check credentials or try again.",
    );
  }

  const headers = { Authorization: `Bearer ${token}` };

  const [metaRes, tracksRes] = await Promise.all([
    fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}`, { headers }),
    fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=50`, {
      headers,
    }),
  ]);

  if (!metaRes.ok || !tracksRes.ok) {
    if (metaRes.status === 404 || tracksRes.status === 404) {
      throw new Error(
        "Playlist not found. Make sure it is public and the link is correct.",
      );
    }
    throw new Error(
      "Failed to fetch Spotify playlist. The playlist may be private.",
    );
  }

  const [metaData, tracksData] = await Promise.all([
    metaRes.json(),
    tracksRes.json(),
  ]);

  const title: string = metaData.name ?? "Spotify Playlist";
  const description: string = metaData.description ?? "";
  const thumbnail: string = metaData.images?.[0]?.url ?? "";

  const rawItems: SpotifyPlaylistTrackItem[] = tracksData.items ?? [];
  const validItems = rawItems.filter(
    (
      item,
    ): item is SpotifyPlaylistTrackItem & {
      track: NonNullable<SpotifyPlaylistTrackItem["track"]>;
    } => item.track !== null && Boolean(item.track?.name),
  );
  const total = validItems.length;

  if (total === 0) {
    throw new Error("This Spotify playlist appears to be empty.");
  }

  const tracks: Track[] = [];
  const BATCH_SIZE = 5;

  for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
    const batch = validItems.slice(batchStart, batchStart + BATCH_SIZE);

    const processBatchItem = async (item: (typeof validItems)[number]) => {
      const { track } = item;
      const artistName = track.artists?.[0]?.name ?? "";
      const albumArt = track.album?.images?.[0]?.url ?? "";

      try {
        return await findMatchWithTimeout(
          track.name,
          artistName,
          track.duration_ms,
          albumArt,
        );
      } catch {
        // On exception, try simple fallback
        return simpleYouTubeSearch(track.name, artistName, albumArt);
      }
    };

    let batchResults: (Track | null)[];

    try {
      batchResults = await Promise.all(batch.map(processBatchItem));
    } catch {
      // Entire batch failed — retry each item with simple search only
      batchResults = await Promise.all(
        batch.map((item) => {
          const artistName = item.track.artists?.[0]?.name ?? "";
          const albumArt = item.track.album?.images?.[0]?.url ?? "";
          return simpleYouTubeSearch(item.track.name, artistName, albumArt);
        }),
      );
    }

    for (const track of batchResults) {
      if (track) tracks.push(track);
    }

    onProgress?.(Math.min(batchStart + BATCH_SIZE, total), total);
  }

  if (tracks.length === 0) {
    throw new Error(
      "Could not resolve any tracks to YouTube videos. Please try again.",
    );
  }

  const result: ImportedPlaylist = {
    id: playlistId,
    title,
    description,
    thumbnail,
    tracks,
    platform: "spotify",
  };

  cacheSet(ck, result);
  return result;
}
