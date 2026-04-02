import type { Track } from "../types";

export function cleanTitleForComparison(title: string): string {
  return title
    .toLowerCase()
    .replace(
      /\b(remix|slowed|lofi|lo-fi|reverb|edit|cover|sped up|nightcore|bass boosted|acoustic|unplugged|reprise|remaster|remastered|version|ver\.|instrumental|karaoke|extended|radio edit|official|video|audio|lyrics|feat\.|ft\.|official video|official audio|full song|hd|hq)\b/gi,
      "",
    )
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, "")
    .replace(/[|\\\-\u2013\u2014]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function viewCountScore(viewCount?: string): number {
  if (!viewCount) return 0;
  const count = Number.parseInt(viewCount, 10);
  if (Number.isNaN(count) || count <= 0) return 0;
  // Logarithmic scale: 1M views = ~14 points, 100M views = ~18 points, max 20
  return Math.min(20, Math.log10(count) * 3);
}

export function rankSearchResults(tracks: Track[], query: string): Track[] {
  if (!query.trim()) return tracks;
  const q = query.toLowerCase().trim();

  const scored = tracks.map((track) => {
    const title = track.title.toLowerCase();
    const channel = track.channelName.toLowerCase();
    const cleanedTitle = cleanTitleForComparison(track.title);
    let score = 0;

    // 1. Exact title match (highest)
    if (title === q || cleanedTitle === q) {
      score += 100;
    } else if (title.startsWith(q) || cleanedTitle.startsWith(q)) {
      // 2. Starts with query
      score += 80;
    } else if (title.includes(q) || cleanedTitle.includes(q)) {
      // 3. Partial/includes match
      score += 60;
    }

    // 4. Artist name match
    if (channel.includes(q)) {
      score += 40;
    } else {
      // Partial word match in title
      const queryWords = q.split(/\s+/).filter((w) => w.length > 2);
      if (queryWords.length > 0) {
        const matchedWords = queryWords.filter(
          (w) => title.includes(w) || cleanedTitle.includes(w),
        );
        if (matchedWords.length > 0) {
          score += (matchedWords.length / queryWords.length) * 30;
        }
      }
    }

    // 5. Popularity boost
    score += viewCountScore(track.viewCount);

    return { track, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((x) => x.track);
}
