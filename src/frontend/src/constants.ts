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
];

// Primary key (kept for backward compat)
export const YOUTUBE_API_KEY = YOUTUBE_API_KEYS[0];

export const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

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

// Track which key index is currently active
let activeKeyIndex = 0;

/** Returns the currently active API key */
export function getActiveApiKey(): string {
  return YOUTUBE_API_KEYS[activeKeyIndex];
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
 */
export async function fetchWithKeyFallback(
  buildUrl: (key: string) => string,
): Promise<Response> {
  const startIndex = activeKeyIndex;
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt < YOUTUBE_API_KEYS.length; attempt++) {
    const key = YOUTUBE_API_KEYS[activeKeyIndex];
    const url = buildUrl(key);
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastRes = res;
      // 403 = quota exceeded / key invalid; try next key
      if (res.status === 403) {
        activeKeyIndex = (activeKeyIndex + 1) % YOUTUBE_API_KEYS.length;
        if (activeKeyIndex === startIndex) break; // all keys tried
        continue;
      }
      // Other errors — return as-is
      return res;
    } catch (_networkErr) {
      throw new Error("Network error. Check your internet connection.");
    }
  }
  // All keys exhausted — return last failed response
  return lastRes ?? fetch(buildUrl(YOUTUBE_API_KEYS[activeKeyIndex]));
}
