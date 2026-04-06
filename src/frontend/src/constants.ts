// VibePlay Configuration
// Multiple API keys with automatic fallback if one hits quota
// Keys are shuffled to distribute load evenly
export const YOUTUBE_API_KEYS = [
  "AIzaSyAZ9zdA5n1j5BJ7jrIO-47fAoEb5uH1luw",
  "AIzaSyCWSI7iXKWhjEGWnRM4p2wCR-tSQuTZUtM",
  "AIzaSyD39AS4Zd95fD4yJa-8ti4bgJKTwzV9BXQ",
  "AIzaSyDctpgtQqfZcm9RfZFmvE9eLdxo1B6uu7g",
  "AIzaSyCd_YcD9ib4UmZoLFznAPYJ7ndWU4PTQF8",
  "AIzaSyAP-MdoIXQIopq-fR7-nABQVEfO-01DKSA",
  "AIzaSyB1LSIvhPbL4iSUQnsWrXhireIXQHM7INY",
  "AIzaSyAuFchL9ZS4DX7mLxq60JSGkbQQPlMwaiI",
  "AIzaSyATY3_8aH9TwDhcOibQMlHamStZbqYCdX4",
  "AIzaSyDMoPFf0HXjJqz7tep6RfdDk2VBmSExzKg",
  "AIzaSyCF6vBJ_RcZN9YNuoOVa8a3DBSy6gXh_B8",
  "AIzaSyD1ZBkKir687901Sbk8NLm9g71i4rUXo4c",
  "AIzaSyAEH5Y74v7BPyxeoQm5lJDTFipJq7-wYC0",
  "AIzaSyD5ZfbVi42lPN84pGlCNQyoD7vYHa1LqC8",
];

// Primary key (kept for backward compat)
export const YOUTUBE_API_KEY = YOUTUBE_API_KEYS[0];

export const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

// ─── Spotify API ──────────────────────────────────────────────────────
export const SPOTIFY_CLIENT_ID = "eb77177675b443d8a8f660bc6ae19d00";
export const SPOTIFY_CLIENT_SECRET = "6d0edab9807f4aa59c89d6a478cec7d1";
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
export const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token";

// ─── Last.fm API ─────────────────────────────────────────────────────
export const LASTFM_API_KEY = "162457c7d4c0b5761df3b540f31468df";
export const LASTFM_API_BASE = "https://ws.audioscrobbler.com/2.0/";

// Maximum number of search results to fetch
export const MAX_SEARCH_RESULTS = 10;

// LocalStorage keys
export const LS_FAVORITES = "vibeplay_favorites";
export const LS_RECENT_SEARCHES = "vibeplay_recent_searches";
export const LS_QUEUE = "vibeplay_queue";
export const LS_CONTINUE_LISTENING = "vibeplay_continue_listening";
export const LS_PLAYLISTS = "vibeplay_playlists";
export const LS_BEHAVIOR_EVENTS = "vibeplay_behavior_events";
export const LS_USER_PREFERENCES = "vibeplay_user_preferences";
export const LS_RECOMMENDATION_CACHE = "vibeplay_rec_cache";
export const LS_INTERESTS_SET = "vibeplay_interests_set";

// Max recent searches to store
export const MAX_RECENT_SEARCHES = 10;

// Max continue listening items
export const MAX_CONTINUE_LISTENING = 20;

// Track which key index is currently active (shuffled for load distribution)
let shuffledKeys = [...YOUTUBE_API_KEYS].sort(() => Math.random() - 0.5);
let activeKeyIndex = 0;

/** Returns the currently active API key */
export function getActiveApiKey(): string {
  return shuffledKeys[activeKeyIndex];
}

/**
 * Parses a YouTube API error response for a human-readable message.
 */
export async function parseYouTubeError(res: Response): Promise<string> {
  try {
    const data = await res.clone().json();
    const reason = data?.error?.errors?.[0]?.reason ?? "";
    const message = data?.error?.message ?? "";
    if (res.status === 403) {
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        return "All API keys have hit their daily quota. Try again after midnight Pacific Time.";
      }
      if (reason === "keyInvalid" || reason === "forbidden") {
        return "API key is invalid or restricted. Check Google Cloud Console.";
      }
      return message || "API key error (403). Check Google Cloud Console.";
    }
    if (res.status === 400) {
      return message || "Bad request (400). Check API parameters.";
    }
    return message || `YouTube API error (${res.status}).`;
  } catch {
    return `YouTube API error (${res.status}). Check your network.`;
  }
}

/**
 * Tries to fetch a URL with automatic API key fallback.
 * If the response indicates quota exceeded or forbidden, rotates to the next key and retries.
 * Keys are pre-shuffled for even load distribution across all 14 keys.
 */
export async function fetchWithKeyFallback(
  buildUrl: (key: string) => string,
): Promise<Response> {
  const startIndex = activeKeyIndex;
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt < shuffledKeys.length; attempt++) {
    const key = shuffledKeys[activeKeyIndex];
    const url = buildUrl(key);
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastRes = res;
      // 403 = quota exceeded / key invalid; try next key
      if (res.status === 403) {
        activeKeyIndex = (activeKeyIndex + 1) % shuffledKeys.length;
        if (activeKeyIndex === startIndex) break; // all keys tried
        continue;
      }
      // Other errors — return as-is
      return res;
    } catch (_networkErr) {
      throw new Error("Network error. Check your internet connection.");
    }
  }
  // All keys exhausted — reshuffle and reset for next session
  shuffledKeys = [...YOUTUBE_API_KEYS].sort(() => Math.random() - 0.5);
  activeKeyIndex = 0;
  return lastRes ?? fetch(buildUrl(shuffledKeys[0]));
}
