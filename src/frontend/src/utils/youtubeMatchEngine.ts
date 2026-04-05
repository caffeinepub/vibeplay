/**
 * YouTube Match Engine — intelligent video matching with scoring.
 *
 * For each Spotify/Last.fm track, this engine:
 * 1. Builds a normalized query ("song artist official audio hd")
 * 2. Fetches 10–15 YouTube results
 * 3. Scores each result on:
 *    - Title similarity (40%)
 *    - Official audio/video keywords (20%)
 *    - Channel credibility (15%)
 *    - Duration match vs Spotify duration (15%)
 *    - View count quality signal (10%)
 * 4. Rejects blocked keyword videos
 * 5. Returns best match with confidence score
 */
import { YOUTUBE_API_BASE, fetchWithKeyFallback } from "../constants";
import { cacheGet, cacheKey, cacheSet } from "./apiCache";

const BLOCKED_KEYWORDS = [
  "lyrics",
  "lyric",
  "remix",
  "lo-fi",
  "lofi",
  "slowed",
  "reverb",
  "cover",
  "live",
  "status",
  "dj ",
  "karaoke",
  "nightcore",
  "bass boosted",
  "sped up",
  "speed up",
  "acoustic version",
  "unplugged",
];

const BOOST_KEYWORDS = [
  "official audio",
  "official song",
  "official video",
  "audio song",
];

export interface MatchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelName: string;
  duration: string; // formatted e.g. "3:45"
  durationSeconds: number;
  confidence: number; // 0–1
}

/**
 * Normalize text: lowercase, remove special chars, trim extra spaces.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute word overlap ratio between two normalized strings.
 * Returns 0–1.
 */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter((w) => w.length > 1));
  const wordsB = new Set(b.split(" ").filter((w) => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) matches++;
  }
  return matches / Math.max(wordsA.size, wordsB.size);
}

/**
 * Parse ISO 8601 duration (PT3M45S) to seconds.
 */
function parseDurationToSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = Number.parseInt(match[1] || "0");
  const m = Number.parseInt(match[2] || "0");
  const s = Number.parseInt(match[3] || "0");
  return h * 3600 + m * 60 + s;
}

/**
 * Format seconds to "M:SS".
 */
function formatDuration(seconds: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Checks if a video title contains any blocked keywords.
 */
function isBlocked(title: string): boolean {
  const lower = title.toLowerCase();
  return BLOCKED_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Score a single video result for how well it matches the target song.
 */
function scoreVideo(
  songName: string,
  artistName: string,
  spotifyDurationSec: number | null,
  video: {
    title: string;
    channelTitle: string;
    viewCount?: number;
    durationSec: number;
  },
): number {
  const normTitle = normalize(video.title);
  const normSong = normalize(songName);
  const normArtist = normalize(artistName);
  const normChannel = normalize(video.channelTitle);

  // ── 1. Title Similarity (40%) ──────────────────────────────────────────────
  const songMatch = wordOverlap(normSong, normTitle);
  const artistMatch = wordOverlap(normArtist, normTitle);
  // Both song name AND artist should appear in title
  const titleScore = songMatch * 0.65 + artistMatch * 0.35;

  // ── 2. Official Audio/Video Keywords (20%) ─────────────────────────────────
  const lower = video.title.toLowerCase();
  const hasOfficialAudio =
    lower.includes("official audio") || lower.includes("audio song");
  const hasOfficialVideo =
    lower.includes("official video") || lower.includes("official music video");
  const hasOfficialSong = lower.includes("official song");
  let keywordScore = 0;
  if (hasOfficialAudio) keywordScore = 1.0;
  else if (hasOfficialSong) keywordScore = 0.85;
  else if (hasOfficialVideo) keywordScore = 0.7;
  else {
    // Partial boost if any boost keyword present
    const anyBoost = BOOST_KEYWORDS.some((kw) => lower.includes(kw));
    keywordScore = anyBoost ? 0.5 : 0.1;
  }

  // ── 3. Channel Credibility (15%) ───────────────────────────────────────────
  // VEVO channels and artist name in channel get a credibility boost
  let channelScore = 0.3; // baseline
  if (normChannel.includes("vevo")) channelScore = 1.0;
  else if (wordOverlap(normArtist, normChannel) > 0.5) channelScore = 0.85;
  else if (
    normChannel.includes("music") ||
    normChannel.includes("records") ||
    normChannel.includes("official")
  )
    channelScore = 0.6;

  // ── 4. Duration Matching (15%) ─────────────────────────────────────────────
  let durationScore = 0.5; // neutral if no Spotify duration
  if (spotifyDurationSec && spotifyDurationSec > 0 && video.durationSec > 0) {
    const diff = Math.abs(video.durationSec - spotifyDurationSec);
    if (diff <= 5) durationScore = 1.0;
    else if (diff <= 10) durationScore = 0.85;
    else if (diff <= 20) durationScore = 0.65;
    else if (diff <= 30) durationScore = 0.4;
    else durationScore = 0.1;
  }

  // ── 5. View Count / Quality Signal (10%) ───────────────────────────────────
  let qualityScore = 0.5;
  if (video.viewCount) {
    if (video.viewCount >= 100_000_000) qualityScore = 1.0;
    else if (video.viewCount >= 10_000_000) qualityScore = 0.85;
    else if (video.viewCount >= 1_000_000) qualityScore = 0.7;
    else if (video.viewCount >= 100_000) qualityScore = 0.5;
    else qualityScore = 0.2;
  }

  // ── Weighted Total ──────────────────────────────────────────────────────────
  return (
    titleScore * 0.4 +
    keywordScore * 0.2 +
    channelScore * 0.15 +
    durationScore * 0.15 +
    qualityScore * 0.1
  );
}

/**
 * Builds the YouTube search query for a song.
 * "song name artist name official audio hd"
 */
export function buildMatchQuery(songName: string, artistName: string): string {
  const name = songName
    .trim()
    .replace(/[^a-zA-Z0-9\s\u0900-\u097F\u0A00-\u0AFF\u0A80-\u0AFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const artist = artistName
    .trim()
    .replace(/[^a-zA-Z0-9\s\u0900-\u097F\u0A00-\u0AFF\u0A80-\u0AFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${name} ${artist} official audio`.toLowerCase().trim();
}

/**
 * Main function: find the best YouTube video match for a given song.
 * Returns null if no acceptable match found.
 *
 * @param songName - Track name
 * @param artistName - Artist name
 * @param spotifyDurationMs - Spotify track duration in milliseconds (optional)
 */
export async function findBestYouTubeMatch(
  songName: string,
  artistName: string,
  spotifyDurationMs?: number,
): Promise<MatchResult | null> {
  const cacheK = cacheKey("ytmatch", songName, artistName);
  const cached = cacheGet<MatchResult>(cacheK);
  if (cached) return cached;

  const query = buildMatchQuery(songName, artistName);
  const spotifyDurationSec = spotifyDurationMs
    ? spotifyDurationMs / 1000
    : null;

  try {
    // ── Fetch 15 results ──────────────────────────────────────────────────────
    const searchRes = await fetchWithKeyFallback((key) => {
      const url = new URL(`${YOUTUBE_API_BASE}/search`);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("videoCategoryId", "10"); // Music
      url.searchParams.set("maxResults", "15");
      url.searchParams.set("key", key);
      return url.toString();
    });
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const items = searchData.items ?? [];
    if (items.length === 0) return null;

    const videoIds: string[] = items
      .filter((item: { id: { videoId?: string } }) => item.id?.videoId)
      .map((item: { id: { videoId: string } }) => item.id.videoId);

    if (videoIds.length === 0) return null;

    // ── Fetch video details (duration + statistics) ────────────────────────────
    const detailsRes = await fetchWithKeyFallback((key) => {
      const url = new URL(`${YOUTUBE_API_BASE}/videos`);
      url.searchParams.set("part", "contentDetails,snippet,statistics");
      url.searchParams.set("id", videoIds.join(","));
      url.searchParams.set("key", key);
      return url.toString();
    });
    if (!detailsRes.ok) return null;

    const detailsData = await detailsRes.json();
    const detailItems = detailsData.items ?? [];

    interface VideoDetail {
      id: string;
      snippet: {
        title: string;
        channelTitle: string;
        thumbnails: { medium: { url: string }; high: { url: string } };
      };
      contentDetails: { duration: string };
      statistics?: { viewCount?: string };
    }

    // ── Score and filter each video ────────────────────────────────────────────
    const scored: Array<{
      videoId: string;
      title: string;
      channelTitle: string;
      thumbnail: string;
      durationSec: number;
      score: number;
    }> = [];

    for (const item of detailItems as VideoDetail[]) {
      const title = item.snippet.title;
      const channelTitle = item.snippet.channelTitle;
      const thumbnail =
        item.snippet.thumbnails.high?.url ||
        item.snippet.thumbnails.medium?.url ||
        "";
      const durationSec = parseDurationToSeconds(
        item.contentDetails.duration || "",
      );
      const viewCount = Number.parseInt(item.statistics?.viewCount ?? "0", 10);

      // ── Reject blocked keywords ──────────────────────────────────────────────
      if (isBlocked(title)) continue;

      const score = scoreVideo(songName, artistName, spotifyDurationSec, {
        title,
        channelTitle,
        viewCount,
        durationSec,
      });

      scored.push({
        videoId: item.id,
        title,
        channelTitle,
        thumbnail,
        durationSec,
        score,
      });
    }

    if (scored.length === 0) {
      // All were blocked — relax to best clean version (no remix/lyrics)
      for (const item of detailItems as VideoDetail[]) {
        const title = item.snippet.title;
        const lower = title.toLowerCase();
        // Only reject the hardest blocked keywords in fallback
        if (
          lower.includes("karaoke") ||
          lower.includes("lyrics") ||
          lower.includes("remix")
        )
          continue;
        const channelTitle = item.snippet.channelTitle;
        const thumbnail =
          item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.medium?.url ||
          "";
        const durationSec = parseDurationToSeconds(
          item.contentDetails.duration || "",
        );
        const viewCount = Number.parseInt(
          item.statistics?.viewCount ?? "0",
          10,
        );
        const score = scoreVideo(songName, artistName, spotifyDurationSec, {
          title,
          channelTitle,
          viewCount,
          durationSec,
        });
        scored.push({
          videoId: item.id,
          title,
          channelTitle,
          thumbnail,
          durationSec,
          score,
        });
      }
    }

    if (scored.length === 0) return null;

    // ── Sort by score descending ───────────────────────────────────────────────
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];

    // ── Wrong song detection: must contain song name OR artist in title ────────
    const normBestTitle = normalize(best.title);
    const normSong = normalize(songName);
    const normArtist = normalize(artistName);
    const hasSong = wordOverlap(normSong, normBestTitle) > 0.3;
    const hasArtist = wordOverlap(normArtist, normBestTitle) > 0.2;

    let finalResult = best;

    if (!hasSong && !hasArtist && scored.length > 1) {
      // Mismatch — try next best
      const next = scored.find(
        (s) =>
          wordOverlap(normalize(songName), normalize(s.title)) > 0.3 ||
          wordOverlap(normalize(artistName), normalize(s.title)) > 0.2,
      );
      if (next) finalResult = next;
    }

    const result: MatchResult = {
      videoId: finalResult.videoId,
      title: finalResult.title,
      thumbnail: finalResult.thumbnail,
      channelName: finalResult.channelTitle,
      duration: formatDuration(finalResult.durationSec),
      durationSeconds: finalResult.durationSec,
      confidence: finalResult.score,
    };

    cacheSet(cacheK, result);
    return result;
  } catch {
    return null;
  }
}
