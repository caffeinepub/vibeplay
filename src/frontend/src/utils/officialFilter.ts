/**
 * Official filter utilities for VibePlay search.
 * Blocks remix/lofi/cover/shorts results and detects official music channels.
 */

// Keyword blocklist for search results
export const SEARCH_BLOCKED_KEYWORDS = [
  "remix",
  "lofi",
  "lo-fi",
  "slowed",
  "sped up",
  "sped-up",
  "karaoke",
  "cover",
  "fan made",
  "fan edit",
  "reverb",
  "mashup",
  "dj ",
  "unplugged",
  "live at",
  "8d audio",
  "nightcore",
  "bass boosted",
];

// Version-only keywords (block exact version variants but allow "official version")
export const VERSION_BLOCKED_KEYWORDS = [
  "slowed version",
  "lofi version",
  "remix version",
];

// Official music channels/labels
export const OFFICIAL_CHANNEL_KEYWORDS = [
  "t-series",
  "tseries",
  "sony music",
  "zee music",
  "saregama",
  "yrf music",
  "dharma music",
  "universal music india",
  "warner music india",
  "tips music",
  "speed records",
  "desi music factory",
  "think music",
  "aditya music",
  "lahari music",
  "vevo",
  "records",
  "music company",
];

/**
 * Returns true if the title/channel should be BLOCKED from search results.
 */
export function isBlockedResult(title: string, _channelName: string): boolean {
  const lower = title.toLowerCase();
  // Block if title contains any blocked keyword
  for (const kw of SEARCH_BLOCKED_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  // Block YouTube Shorts-style titles
  if (lower.includes("#shorts") || lower.includes("#reels")) return true;
  return false;
}

/**
 * Returns true if the channel appears to be an official/verified source.
 */
export function isOfficialChannel(channelName: string): boolean {
  const lower = channelName.toLowerCase();
  return OFFICIAL_CHANNEL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Applies the official-only filter to a list of tracks.
 * Removes blocked results. Non-official channels are kept but don't get the badge.
 */
export function applyOfficialFilter<
  T extends { title: string; channelName: string },
>(tracks: T[]): T[] {
  return tracks.filter((t) => !isBlockedResult(t.title, t.channelName));
}
