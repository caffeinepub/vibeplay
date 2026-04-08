/**
 * Smart "Up Next" recommendation hook.
 *
 * Flow:
 *  1. PRIMARY: Spotify /v1/recommendations (seed_tracks + seed_artists) → 15-20 tracks
 *     — with 6-second timeout; if Spotify hangs/fails, falls through immediately
 *  1b. MANDATORY: YouTube related videos (relatedToVideoId) — always fetched in parallel,
 *     never skipped regardless of Spotify result
 *  2. FALLBACK: Last.fm track.getsimilar if combined candidates < 8
 *  3. LAST RESORT: Direct YouTube search for "artist songs" if still < 5 candidates
 *  4. For each candidate track: resolve to a YouTube video via youtubeMatchEngine
 *  5. Apply anti-repetition, artist diversity (max 2/artist), version dedup
 */
import { useEffect, useRef, useState } from "react";
import {
  SPOTIFY_API_BASE,
  SPOTIFY_AUTH_URL,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  YOUTUBE_API_BASE,
  fetchWithKeyFallback,
} from "../constants";
import { getLastFmSimilarTracks } from "../services/lastfmService";
import type { Track } from "../types";
import { cacheGet, cacheKey, cacheSet } from "../utils/apiCache";
import { normalizeKey } from "../utils/playHistory";
import { findBestYouTubeMatch } from "../utils/youtubeMatchEngine";

const MAX_QUEUE = 12;
const SPOTIFY_RECS_LIMIT = 20;
const SPOTIFY_TOKEN_TIMEOUT_MS = 6000;

// ─────────────────────────────────────────────────────────────────────────────
// Spotify helpers
// ─────────────────────────────────────────────────────────────────────────────

const SPOTIFY_TOKEN_KEY = "vibeplay_spotify_token_v2";
const TOKEN_TTL = 55 * 60 * 1000;

/** Resolves with the token or null after SPOTIFY_TOKEN_TIMEOUT_MS */
async function getSpotifyToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_SECRET || !SPOTIFY_CLIENT_ID) return null;

  const tokenPromise = (async () => {
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
  })();

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), SPOTIFY_TOKEN_TIMEOUT_MS),
  );

  const result = await Promise.race([tokenPromise, timeoutPromise]);
  if (result === null) {
    console.warn(
      "[UpNext] Spotify token timed out — using YouTube/Last.fm only",
    );
  }
  return result;
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
// Play history helpers
// ─────────────────────────────────────────────────────────────────────────────

const LS_HISTORY = "vibeplay_up_next_history";
const MAX_HISTORY = 10;

interface HistEntry {
  id: string;
  titleKey: string;
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
// Language detection helpers (for Up Next only — NOT from filter chips)
// ─────────────────────────────────────────────────────────────────────────────

const HINDI_ARTISTS = [
  "arijit singh",
  "neha kakkar",
  "shreya ghoshal",
  "atif aslam",
  "jubin nautiyal",
  "armaan malik",
  "badshah",
  "yo yo honey singh",
  "darshan raval",
  "lata mangeshkar",
  "kumar sanu",
  "udit narayan",
  "sonu nigam",
  "rahat fateh ali khan",
  "ali zafar",
  "sunidhi chauhan",
  "kavita krishnamurthy",
  "alka yagnik",
  "kishore kumar",
  "mohammed rafi",
  "amit kumar",
  "pawandeep rajan",
  "kk",
  "shaan",
  "vishal dadlani",
  "sukhwinder singh",
  "benny dayal",
];

const PUNJABI_ARTISTS = [
  "diljit dosanjh",
  "sidhu moosewala",
  "ammy virk",
  "prabh gill",
  "garry sandhu",
  "jassi gill",
  "gurnam bhullar",
  "kulwinder billa",
  "ninja",
  "mankirt aulakh",
  "karan aujla",
  "ap dhillon",
  "shubh",
  "jass manak",
  "gippy grewal",
  "harrdy sandhu",
  "bilal saeed",
];

const HARYANVI_ARTISTS = [
  "masoom sharma",
  "sapna choudhary",
  "renuka panwar",
  "pranjal dahiya",
  "ajay hooda",
  "raj mawar",
  "parmod premi",
  "dev kumar deva",
  "vijay varma",
  "ruchika jangid",
];

// Devanagari Unicode range: U+0900–U+097F
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
// Punjabi (Gurmukhi) Unicode range: U+0A00–U+0A7F
const GURMUKHI_REGEX = /[\u0A00-\u0A7F]/;

/** Common Hindi/Bollywood keywords in romanized titles */
const HINDI_TITLE_KEYWORDS = [
  "tera",
  "mera",
  "pyaar",
  "dil",
  "ishq",
  "mohabbat",
  "zindagi",
  "tujhe",
  "tumse",
  "yaar",
  "sajna",
  "mitwa",
  "pehla",
  "naina",
  "hasna",
  "rona",
  "aadat",
  "bewafa",
  "intezaar",
  "judaai",
  "lamha",
  "khwaab",
  "raah",
  "safar",
  "duniya",
  "khuda",
  "waqt",
  "nazar",
  "jahan",
  "dard",
  "tanhai",
  "aaoge",
  "jaoge",
  "tere",
  "mere",
  "humari",
  "tumhari",
  "aashiqui",
  "bahut",
  "kuch",
  "aaja",
  "channa",
  "bulleya",
  "gerua",
  "phir",
  "kabhi",
  "kaise",
  "juda",
  "pal",
  "pehle",
];

const PUNJABI_TITLE_KEYWORDS = [
  "punjabi",
  "haryanvi",
  "bhangra",
  "gabru",
  "mutiyar",
  "kurti",
  "patola",
  "ni",
  "te",
  "ve",
  "oye",
  "yaarian",
  "pegg",
  "shayari",
  "suit",
  "dilruba",
  "chitta",
  "kudi",
  "munda",
  "tenu",
  "menu",
];

export type DetectedLanguage =
  | "hindi"
  | "punjabi"
  | "haryanvi"
  | "english"
  | "other";

/**
 * Detects the language of a track based on title + artist name.
 * Used ONLY for Up Next recommendations — NOT tied to filter chip selections.
 */
export function detectTrackLanguage(
  title: string,
  artist: string,
): DetectedLanguage {
  const titleLower = title.toLowerCase();
  const artistLower = artist.toLowerCase();
  const combined = `${titleLower} ${artistLower}`;

  // Devanagari script → definitely Hindi/Indian
  if (DEVANAGARI_REGEX.test(title) || DEVANAGARI_REGEX.test(artist))
    return "hindi";

  // Gurmukhi script → Punjabi
  if (GURMUKHI_REGEX.test(title) || GURMUKHI_REGEX.test(artist))
    return "punjabi";

  // Haryanvi artist check first
  if (HARYANVI_ARTISTS.some((a) => artistLower.includes(a))) return "haryanvi";

  // Punjabi artist check
  if (PUNJABI_ARTISTS.some((a) => artistLower.includes(a))) return "punjabi";

  // Hindi artist check
  if (HINDI_ARTISTS.some((a) => artistLower.includes(a))) return "hindi";

  // Title keyword checks
  if (PUNJABI_TITLE_KEYWORDS.some((kw) => combined.includes(kw)))
    return "punjabi";
  if (HINDI_TITLE_KEYWORDS.some((kw) => combined.includes(kw))) return "hindi";

  // Contains "haryanvi" or "haryana" in title/artist
  if (combined.includes("haryanvi") || combined.includes("haryana"))
    return "haryanvi";

  // Contains "bollywood"
  if (combined.includes("bollywood")) return "hindi";

  return "english";
}

/**
 * Returns a language-qualified search term for YouTube fallback queries.
 * Only applies to Indian-language tracks. English → empty string (no qualifier).
 */
export function getLanguageSearchTerm(lang: DetectedLanguage): string {
  switch (lang) {
    case "hindi":
      return "hindi";
    case "punjabi":
      return "punjabi";
    case "haryanvi":
      return "haryanvi";
    default:
      return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocked keywords for filtering
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_KEYWORDS = [
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
  "status",
  "mashup",
];

// ─────────────────────────────────────────────────────────────────────────────
// Candidate type
// ─────────────────────────────────────────────────────────────────────────────

interface Candidate {
  name: string;
  artist: string;
  thumbnail: string;
  durationMs?: number;
  spotifyId?: string;
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
      setIsLoading(false);
      return;
    }
    // Always trigger a fresh fetch when track changes — including replayed tracks.
    // We compare by both id and title to catch cases where the same video is
    // reloaded after a restart (same id, but user explicitly triggered a new play).
    const newKey = `${trackId}:${track.title}`;
    if (trackIdRef.current === newKey) return;
    trackIdRef.current = newKey;
    console.log("[useRelatedTracks] fetching for:", track.title);

    let cancelled = false;

    async function fetchRelated() {
      if (!track) return;
      setIsLoading(true);

      // Check final output cache first
      const ck = cacheKey("upnext_v5", track.id);
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

        // Detect the language of the CURRENT track for language-aware fallbacks
        const detectedLang = detectTrackLanguage(currentTitle, currentArtist);
        const langTerm = getLanguageSearchTerm(detectedLang);

        // Build history sets for dedup
        const history = getHistory();
        const historyIds = new Set(history.map((h) => h.id));
        const historyKeys = new Set(history.map((h) => h.titleKey));
        historyIds.add(track.id);
        historyKeys.add(normalizeKey(currentTitle, currentArtist));

        let candidates: Candidate[] = [];

        // ── Step 1 + 1b: Spotify AND YouTube run in PARALLEL ─────────────────
        // YouTube relatedToVideoId is MANDATORY — never skipped regardless of Spotify
        const [spotifyResult, ytRelatedResult] = await Promise.allSettled([
          // Spotify path (with built-in 6s timeout inside getSpotifyToken)
          (async (): Promise<Candidate[]> => {
            const token = await getSpotifyToken();
            if (!token) return [];
            const { trackId: spTrackId, artistId: spArtistId } =
              await resolveSpotifyIds(currentTitle, currentArtist, token);
            if (!spTrackId && !spArtistId) return [];
            const recs = await fetchSpotifyRecommendations(
              spTrackId,
              spArtistId,
              token,
            );
            return recs.map((r) => ({
              name: r.name,
              artist: r.artists[0]?.name ?? "",
              thumbnail: r.album.images[0]?.url ?? "",
              durationMs: r.duration_ms,
              spotifyId: r.id,
            }));
          })(),
          // YouTube related videos path — always executed
          (async (): Promise<Candidate[]> => {
            const ytRelatedUrl = (key: string) => {
              const u = new URL(`${YOUTUBE_API_BASE}/search`);
              u.searchParams.set("part", "snippet");
              u.searchParams.set("relatedToVideoId", track.id);
              u.searchParams.set("type", "video");
              u.searchParams.set("videoCategoryId", "10");
              u.searchParams.set("maxResults", "15");
              u.searchParams.set("key", key);
              return u.toString();
            };
            const ytRes = await fetchWithKeyFallback(ytRelatedUrl);
            if (!ytRes.ok) return [];
            const ytData = await ytRes.json();
            return (ytData.items ?? []).map(
              (item: {
                snippet?: {
                  title?: string;
                  channelTitle?: string;
                  thumbnails?: {
                    medium?: { url: string };
                    default?: { url: string };
                  };
                };
              }) => ({
                name: item.snippet?.title ?? "",
                artist: item.snippet?.channelTitle ?? "",
                thumbnail:
                  item.snippet?.thumbnails?.medium?.url ??
                  item.snippet?.thumbnails?.default?.url ??
                  "",
              }),
            );
          })(),
        ]);

        // Merge Spotify + YouTube results, deduplicate by normalizeKey
        const spotifyCandidates =
          spotifyResult.status === "fulfilled" ? spotifyResult.value : [];
        const ytCandidates =
          ytRelatedResult.status === "fulfilled" ? ytRelatedResult.value : [];

        const seenKeys = new Set<string>();
        for (const c of spotifyCandidates) {
          const k = normalizeKey(c.name, c.artist);
          if (!seenKeys.has(k)) {
            seenKeys.add(k);
            candidates.push(c);
          }
        }
        for (const c of ytCandidates) {
          const k = normalizeKey(c.name, c.artist);
          if (!seenKeys.has(k)) {
            seenKeys.add(k);
            candidates.push(c);
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
                t.image?.find((i: { size: string }) => i.size === "large")?.[
                  "#text"
                ] ??
                t.image?.[0]?.["#text"] ??
                "";
              const k = normalizeKey(t.name, artistName);
              if (!seenKeys.has(k)) {
                seenKeys.add(k);
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

        // ── Step 3: Last-resort direct YouTube search ─────────────────────────
        // If we still have very few candidates, do a simple artist search
        // Use language-qualified query for Indian tracks, generic for others
        if (candidates.length < 5 && !cancelled) {
          try {
            const artistQuery = langTerm
              ? `${currentArtist} ${langTerm} songs official audio`
              : `${currentArtist} songs official audio`;
            const artistSearchRes = await fetchWithKeyFallback((key) => {
              const u = new URL(`${YOUTUBE_API_BASE}/search`);
              u.searchParams.set("part", "snippet");
              u.searchParams.set("q", artistQuery);
              u.searchParams.set("type", "video");
              u.searchParams.set("videoCategoryId", "10");
              u.searchParams.set("maxResults", "10");
              u.searchParams.set("key", key);
              return u.toString();
            });
            if (artistSearchRes.ok) {
              const artistData = await artistSearchRes.json();
              for (const item of artistData.items ?? []) {
                const name: string = item.snippet?.title ?? "";
                const artist: string = item.snippet?.channelTitle ?? "";
                const thumbnail: string =
                  item.snippet?.thumbnails?.medium?.url ?? "";
                const k = normalizeKey(name, artist);
                if (!seenKeys.has(k)) {
                  seenKeys.add(k);
                  candidates.push({ name, artist, thumbnail });
                }
              }
            }
          } catch {
            // non-fatal
          }
        }

        if (cancelled) return;

        if (candidates.length === 0) {
          setRelatedTracks([]);
          return;
        }

        // ── Pre-filter: blocked keywords ──────────────────────────────────────
        candidates = candidates.filter((c) => {
          const lower = c.name.toLowerCase();
          return !BLOCKED_KEYWORDS.some((kw) => lower.includes(kw));
        });

        // ── Anti-repetition filter ────────────────────────────────────────────
        candidates = candidates.filter((c) => {
          const titleKey = normalizeKey(c.name, c.artist);
          return !historyKeys.has(titleKey);
        });

        // ── Artist diversity (max 2 per artist) ───────────────────────────────
        const artistCount = new Map<string, number>();
        candidates = candidates.filter((c) => {
          const normArtist = c.artist.toLowerCase().trim();
          const count = artistCount.get(normArtist) ?? 0;
          if (count >= 2) return false;
          artistCount.set(normArtist, count + 1);
          return true;
        });

        // ── Resolve each candidate to a YouTube video ─────────────────────────
        const resolvedTracks: Track[] = [];
        const seenTitleKeys = new Set<string>();
        const seenYtIds = new Set<string>([track.id]);

        const toProcess = candidates.slice(0, 20);

        for (const candidate of toProcess) {
          if (cancelled) break;
          if (resolvedTracks.length >= MAX_QUEUE) break;

          const titleKey = normalizeKey(candidate.name, candidate.artist);
          if (seenTitleKeys.has(titleKey)) continue;
          if (isInHistory("", titleKey, historyIds, historyKeys)) continue;

          try {
            const match = await findBestYouTubeMatch(
              candidate.name,
              candidate.artist,
              candidate.durationMs,
            );

            if (!match || match.confidence < 0.05) continue;
            if (seenYtIds.has(match.videoId)) continue;
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

        // ── Final fallback: direct YouTube search if queue still too short ─────
        // Uses language-aware query for Indian tracks only
        if (resolvedTracks.length < 3 && !cancelled) {
          try {
            const fallbackQuery = langTerm
              ? `${currentArtist} ${langTerm} official audio songs`
              : `${currentArtist} official audio songs`;
            const fallbackRes = await fetchWithKeyFallback((key) => {
              const u = new URL(`${YOUTUBE_API_BASE}/search`);
              u.searchParams.set("part", "snippet");
              u.searchParams.set("q", fallbackQuery);
              u.searchParams.set("type", "video");
              u.searchParams.set("videoCategoryId", "10");
              u.searchParams.set("maxResults", "10");
              u.searchParams.set("safeSearch", "strict");
              u.searchParams.set("key", key);
              return u.toString();
            });
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              for (const item of fallbackData.items ?? []) {
                if (resolvedTracks.length >= MAX_QUEUE) break;
                const ytId = item.id?.videoId as string | undefined;
                if (!ytId || seenYtIds.has(ytId) || historyIds.has(ytId))
                  continue;
                const ytTitle: string = item.snippet?.title ?? "";
                const ytChannel: string = item.snippet?.channelTitle ?? "";
                const ytThumb: string =
                  item.snippet?.thumbnails?.medium?.url ?? "";
                const isBlocked = BLOCKED_KEYWORDS.some((kw) =>
                  ytTitle.toLowerCase().includes(kw),
                );
                if (isBlocked) continue;
                seenYtIds.add(ytId);
                resolvedTracks.push({
                  id: ytId,
                  title: ytTitle,
                  channelName: ytChannel,
                  artist: ytChannel,
                  thumbnail: ytThumb,
                  source: "youtube" as const,
                });
              }
            }
          } catch {
            // Fallback failure is non-fatal
          }
        }

        if (cancelled) return;

        cacheSet(ck, resolvedTracks);
        setRelatedTracks(resolvedTracks);
      } catch (err) {
        console.error("[UpNext] fetch failed:", err);
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
