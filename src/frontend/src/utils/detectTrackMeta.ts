// Detects language from video title/channel name
export function detectLanguage(title: string, channel: string): string {
  const text = `${title} ${channel}`.toLowerCase();

  // Script-based detection (unicode ranges)
  if (/[\u0900-\u097F]/.test(title)) return "Hindi"; // Devanagari
  if (/[\u0A80-\u0AFF]/.test(title)) return "Gujarati";
  if (/[\u0A00-\u0A7F]/.test(title)) return "Punjabi";
  if (/[\u0B80-\u0BFF]/.test(title)) return "Tamil";
  if (/[\u0C00-\u0C7F]/.test(title)) return "Telugu";
  if (/[\u0C80-\u0CFF]/.test(title)) return "Kannada";
  if (/[\u0D00-\u0D7F]/.test(title)) return "Malayalam";
  if (/[\u0980-\u09FF]/.test(title)) return "Bengali";
  if (/[\u0600-\u06FF]/.test(title)) return "Urdu";

  // Haryanvi detection (before Hindi, more specific)
  if (
    /\b(haryanvi|haryanavi|haryana|haryani|dj haryanvi|haryanvi song|sapna choudhary|renuka panwar|raju punjabi|masoom sharma|pradeep sonu|sandeep surila|amit saini rohtakiya|bheegi bheegi|fauji|ragni)\b/.test(
      text,
    )
  )
    return "Haryanvi";

  // Keyword-based detection (common English labels in Indian music)
  if (/\b(punjabi|bhangra|jatt|munde|kudiye|yaarian)\b/.test(text))
    return "Punjabi";
  if (
    /\b(hindi|bollywood|filmy|filmi|aashiq|ishq|dil|pyaar|mohabbat|teri|meri|mere|tere|kuch|kya|nahi|hai|hoon|hain)\b/.test(
      text,
    )
  )
    return "Hindi";
  if (/\b(tamil|kollywood|anirudh|yuvan|harris)\b/.test(text)) return "Tamil";
  if (/\b(telugu|tollywood|dsp|thaman)\b/.test(text)) return "Telugu";
  if (/\b(kannada|sandalwood)\b/.test(text)) return "Kannada";
  if (/\b(malayalam|mollywood)\b/.test(text)) return "Malayalam";
  if (/\b(bengali|bangla)\b/.test(text)) return "Bengali";
  if (/\b(marathi)\b/.test(text)) return "Marathi";
  if (/\b(gujarati|garba|dandiya)\b/.test(text)) return "Gujarati";

  return "English";
}

// Detects music type/mood from title keywords
export function detectMusicType(title: string): string {
  const t = title.toLowerCase();
  if (/\b(remix|edm|dj)\b/.test(t)) return "Remix";
  if (/\b(lo-?fi|lofi|chill|chilled)\b/.test(t)) return "Lo-Fi";
  if (/\b(acoustic|unplugged)\b/.test(t)) return "Acoustic";
  if (/\b(sad|broken|painful|heartbreak|lonely)\b/.test(t)) return "Sad";
  if (/\b(romantic|love song|baby|sweetheart|beautiful)\b/.test(t))
    return "Romantic";
  if (/\b(party|dance|club|floor)\b/.test(t)) return "Party";
  if (/\b(devotional|bhajan|aarti|mantra|kirtan)\b/.test(t))
    return "Devotional";
  if (/\b(classical|raga|taal|instrumental)\b/.test(t)) return "Classical";
  if (/\b(folk|sufi|qawwali)\b/.test(t)) return "Folk/Sufi";
  return "";
}

// Builds a combined label from language + type
export function buildTrackLabel(title: string, channel: string): string {
  const lang = detectLanguage(title, channel);
  const type = detectMusicType(title);
  if (type) return `${lang} \u00b7 ${type}`;
  return lang;
}

// Strips version keywords for title comparison
export function cleanTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(
      /\b(remix|slowed|lofi|lo-fi|reverb|edit|cover|sped up|nightcore|bass boosted|acoustic|unplugged|reprise|remaster|remastered|version|ver\.|instrumental|karaoke|extended|radio edit)\b/gi,
      "",
    )
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The set of Indian languages for which language+mood enhanced queries apply.
 */
const INDIAN_LANGUAGES = new Set([
  "Hindi",
  "Haryanvi",
  "Punjabi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Bhojpuri",
  "Urdu",
]);

/**
 * Builds an Indian-language+mood YouTube search query string from a song title.
 * Returns null if the song is English or unrecognised — so the enhancement is
 * only applied to Indian-language content.
 *
 * Examples:
 *   "Haryanvi sad songs"
 *   "Hindi romantic songs"
 *   "Punjabi party songs"
 *   "Tamil songs"  (when no mood detected)
 */
export function buildIndianLanguageMoodQuery(
  title: string,
  channelName: string,
): string | null {
  const lang = detectLanguage(title, channelName);
  if (!INDIAN_LANGUAGES.has(lang)) return null;

  const mood = detectMusicType(title);
  // Normalise mood label to a search-friendly term
  const moodMap: Record<string, string> = {
    Romantic: "romantic",
    Sad: "sad",
    Party: "party",
    "Lo-Fi": "lofi",
    Remix: "remix",
    Acoustic: "acoustic",
    Devotional: "devotional",
    Classical: "classical",
    "Folk/Sufi": "sufi",
  };
  const moodTerm = moodMap[mood] ?? "";

  if (moodTerm) {
    return `${lang.toLowerCase()} ${moodTerm} songs`;
  }
  return `${lang.toLowerCase()} songs`;
}
