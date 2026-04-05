import {
  AlertCircle,
  Clock,
  Loader2,
  Music2,
  Search,
  Sparkles,
  TrendingUp,
  User,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TrackItem } from "../components/TrackItem";
import { useSmartSearch } from "../hooks/useSmartSearch";
import type { Playlist, Track } from "../types";
import { buildTrackLabel } from "../utils/detectTrackMeta";

interface SearchScreenProps {
  initialQuery?: string;
  currentTrack: Track | null;
  recentSearches: string[];
  favorites: Track[];
  onPlay: (track: Track, queue: Track[]) => void;
  onAddRecentSearch: (q: string) => void;
  onToggleFavorite: (track: Track) => void;
  isFavorite: (id: string) => boolean;
  playlists?: Playlist[];
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  isLoggedIn?: boolean;
  onShowLogin?: () => void;
}

// Groups an array of tracks by their computed label
function groupByLabel(tracks: Track[]): { label: string; tracks: Track[] }[] {
  const map = new Map<string, Track[]>();
  for (const track of tracks) {
    const label = buildTrackLabel(track.title, track.channelName);
    const existing = map.get(label);
    if (existing) {
      existing.push(track);
    } else {
      map.set(label, [track]);
    }
  }
  return Array.from(map.entries()).map(([label, tracksArr]) => ({
    label,
    tracks: tracksArr,
  }));
}

// Extract unique artists from tracks
function extractArtists(
  tracks: Track[],
): { channelName: string; topTrack: Track; count: number }[] {
  const artistMap = new Map<string, { topTrack: Track; count: number }>();
  for (const track of tracks) {
    const name = track.channelName.toLowerCase().trim();
    if (artistMap.has(name)) {
      const entry = artistMap.get(name)!;
      entry.count += 1;
    } else {
      artistMap.set(name, { topTrack: track, count: 1 });
    }
  }
  return Array.from(artistMap.entries())
    .map(([, val]) => ({
      channelName: val.topTrack.channelName,
      topTrack: val.topTrack,
      count: val.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// Extract trending tracks (viewCount >= 1,000,000)
function extractTrending(tracks: Track[]): Track[] {
  return tracks
    .filter((t) => {
      const v = Number.parseInt(t.viewCount ?? "0", 10);
      return !Number.isNaN(v) && v >= 1_000_000;
    })
    .sort((a, b) => {
      const va = Number.parseInt(a.viewCount ?? "0", 10);
      const vb = Number.parseInt(b.viewCount ?? "0", 10);
      return vb - va;
    });
}

function formatViewCount(viewCount?: string): string {
  if (!viewCount) return "";
  const v = Number.parseInt(viewCount, 10);
  if (Number.isNaN(v)) return "";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B views`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M views`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K views`;
  return `${v} views`;
}

/** Small Spotify source badge shown on tracks with rich Spotify metadata */
function SpotifyBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-[#1DB954] bg-[#1DB954]/10 border border-[#1DB954]/25 px-1.5 py-0.5 rounded-full leading-none">
      <span className="text-[9px]">&#9654;</span>
      Spotify
    </span>
  );
}

export function SearchScreen({
  initialQuery = "",
  currentTrack,
  recentSearches,
  onPlay,
  onAddRecentSearch,
  onToggleFavorite,
  isFavorite,
  playlists,
  onAddToPlaylist,
  isLoggedIn,
  onShowLogin,
}: SearchScreenProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    results,
    isLoading,
    error,
    search,
    isDemoMode,
    isFuzzyResult,
    hasSpotifyResults,
  } = useSmartSearch();

  useEffect(() => {
    if (initialQuery) {
      search(initialQuery);
    }
  }, [initialQuery, search]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    search(query);
    onAddRecentSearch(query.trim());
    inputRef.current?.blur();
  }

  function handleRecentClick(q: string) {
    setQuery(q);
    search(q);
    onAddRecentSearch(q);
  }

  function handleClear() {
    setQuery("");
    inputRef.current?.focus();
  }

  // Section split
  const topResults = results.slice(0, 2);
  const songResults = results.slice(2);
  const relatedGroups = groupByLabel(songResults);
  const artists = extractArtists(results);
  const trendingTracks = extractTrending(results);

  // Flat index offset for TrackItem index prop (so indices are continuous)
  let globalIndex = 0;

  // Active section tab state
  const [activeTab, setActiveTab] = useState<
    "all" | "songs" | "artists" | "trending"
  >("all");

  // Reset tab when new results arrive
  useEffect(() => {
    if (results.length > 0) setActiveTab("all");
  }, [results.length]);

  /** Renders a track row with optional Spotify badge and album info */
  function renderTrackRow(track: Track, idx: number, queue: Track[]) {
    const displayThumbnail = track.albumArt || track.thumbnail;
    const enrichedTrack = track.albumArt
      ? { ...track, thumbnail: track.albumArt }
      : track;

    return (
      <div key={track.id} className="relative">
        {/* Spotify badge overlay */}
        {track.source === "spotify" && (
          <div className="absolute left-14 bottom-1.5 z-10">
            <SpotifyBadge />
          </div>
        )}
        {/* Album subtitle under channel name — rendered as overlay info */}
        {track.album && (
          <div className="absolute left-14 top-1 z-10 max-w-[120px]">
            <span className="text-[9px] text-muted-foreground/60 truncate block">
              {track.album}
            </span>
          </div>
        )}
        <TrackItem
          track={enrichedTrack}
          index={idx}
          isPlaying={currentTrack?.id === track.id}
          isFavorite={isFavorite(track.id)}
          onPlay={(t) => onPlay(t, queue)}
          onToggleFavorite={onToggleFavorite}
          playlists={playlists}
          onAddToPlaylist={onAddToPlaylist}
          isLoggedIn={isLoggedIn}
          onShowLogin={onShowLogin}
        />
        {/* Suppress unused var warning */}
        {displayThumbnail && null}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search Bar */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            data-ocid="search.input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, artists\u2026"
            className="w-full bg-muted/60 border border-border rounded-2xl pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-vibe-green/50 focus:bg-muted/80 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 touch-manipulation"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </form>

        {isDemoMode && (
          <p className="text-[11px] text-muted-foreground/60 mt-2 px-1">
            Demo mode — add your YouTube API key in{" "}
            <code className="bg-muted px-1 rounded text-[10px]">
              constants.ts
            </code>
          </p>
        )}

        {/* Spotify enrichment badge */}
        {hasSpotifyResults && !isLoading && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 px-1"
          >
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1DB954] bg-[#1DB954]/10 border border-[#1DB954]/20 px-2 py-0.5 rounded-full">
              <span className="text-[11px]">&#9654;</span>
              Enriched with Spotify metadata
            </span>
          </motion.div>
        )}

        {/* Fuzzy match badge */}
        {isFuzzyResult && !isLoading && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 px-1"
          >
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
              <Zap className="w-2.5 h-2.5" />
              Showing similar results for possible typos
            </span>
          </motion.div>
        )}

        {/* Section tabs — show when results available */}
        {results.length > 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-0.5"
          >
            {(
              [
                { key: "all", label: "All" },
                { key: "songs", label: "Songs" },
                { key: "artists", label: "Artists" },
                ...(trendingTracks.length > 0
                  ? [{ key: "trending", label: "Trending" }]
                  : []),
              ] as { key: typeof activeTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                data-ocid={`search.${tab.key}.tab`}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all touch-manipulation ${
                  activeTab === tab.key
                    ? "bg-vibe-green text-black border-vibe-green"
                    : "bg-muted/40 text-muted-foreground border-border hover:border-vibe-green/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              data-ocid="search.loading_state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-20"
            >
              <Loader2 className="w-8 h-8 text-vibe-green animate-spin" />
              <p className="text-sm text-muted-foreground">Searching…</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              data-ocid="search.error_state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-20 px-6"
            >
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-muted-foreground text-center">
                {error}
              </p>
            </motion.div>
          ) : results.length > 0 ? (
            <motion.div
              key={`results-${activeTab}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="px-2 pb-4 space-y-5"
            >
              {/* ── ALL TAB ── */}
              {activeTab === "all" && (
                <>
                  {/* Results summary */}
                  <div className="px-4 pt-1">
                    <p className="text-xs text-muted-foreground/70">
                      {results.length} results
                      {trendingTracks.length > 0 &&
                        ` \u00b7 ${trendingTracks.length} trending`}
                    </p>
                  </div>

                  {/* Top Results */}
                  {topResults.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 mb-2 flex items-center gap-1.5">
                        <Music2 className="w-3 h-3 text-vibe-green" />
                        <span>Top Results</span>
                      </p>
                      <div className="space-y-1">
                        {topResults.map((track) => {
                          globalIndex += 1;
                          const idx = globalIndex;
                          const isTrending =
                            Number.parseInt(track.viewCount ?? "0", 10) >=
                            1_000_000;
                          return (
                            <div
                              key={track.id}
                              className="relative border-l-2 border-vibe-green/50 pl-1"
                            >
                              {isTrending && (
                                <span className="absolute right-4 top-3 z-10 text-[9px] font-bold text-vibe-green bg-vibe-green/10 border border-vibe-green/25 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                  <TrendingUp className="w-2 h-2" />
                                  {formatViewCount(track.viewCount)}
                                </span>
                              )}
                              {renderTrackRow(track, idx, results)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Songs Section */}
                  {relatedGroups.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" />
                        Songs
                      </p>
                      <div className="space-y-3">
                        {relatedGroups.map((group) => (
                          <div key={group.label}>
                            <div className="px-4 mb-1">
                              <span className="text-[10px] font-semibold text-vibe-green/70 bg-vibe-green/10 px-2 py-0.5 rounded-full">
                                {group.label}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {group.tracks.map((track) => {
                                globalIndex += 1;
                                const idx = globalIndex;
                                const isTrending =
                                  Number.parseInt(track.viewCount ?? "0", 10) >=
                                  1_000_000;
                                return (
                                  <div key={track.id} className="relative">
                                    {isTrending && (
                                      <span className="absolute right-4 top-3 z-10 text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                        <TrendingUp className="w-2 h-2" />
                                        {formatViewCount(track.viewCount)}
                                      </span>
                                    )}
                                    {renderTrackRow(track, idx, results)}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Artists preview (compact, max 4) */}
                  {artists.length > 1 && (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 mb-2 flex items-center gap-1.5">
                        <User className="w-3 h-3" />
                        Artists
                      </p>
                      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-1">
                        {artists.slice(0, 4).map((artist) => (
                          <button
                            key={artist.channelName}
                            type="button"
                            data-ocid="search.artists.button"
                            onClick={() => onPlay(artist.topTrack, results)}
                            className="flex flex-col items-center gap-2 flex-shrink-0 w-20 touch-manipulation group"
                          >
                            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border group-hover:border-vibe-green/50 transition-colors">
                              <img
                                src={
                                  artist.topTrack.albumArt ||
                                  artist.topTrack.thumbnail
                                }
                                alt={artist.channelName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground text-center leading-tight line-clamp-2">
                              {artist.channelName}
                            </span>
                            <span className="text-[9px] text-muted-foreground/50">
                              {artist.count} song{artist.count !== 1 ? "s" : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending section (if any) */}
                  {trendingTracks.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 mb-2 flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3 text-amber-400" />
                        <span className="text-amber-400">Trending</span>
                      </p>
                      <div className="space-y-1">
                        {trendingTracks.map((track) => {
                          globalIndex += 1;
                          const idx = globalIndex;
                          return (
                            <div key={track.id} className="relative">
                              <span className="absolute right-4 top-3 z-10 text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
                                {formatViewCount(track.viewCount)}
                              </span>
                              {renderTrackRow(track, idx, results)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── SONGS TAB ── */}
              {activeTab === "songs" && (
                <>
                  <div className="px-4 pt-1">
                    <p className="text-xs text-muted-foreground/70">
                      {results.length} songs
                    </p>
                  </div>
                  <div className="space-y-1">
                    {results.map((track) => {
                      globalIndex += 1;
                      const idx = globalIndex;
                      return renderTrackRow(track, idx, results);
                    })}
                  </div>
                </>
              )}

              {/* ── ARTISTS TAB ── */}
              {activeTab === "artists" && (
                <>
                  <div className="px-4 pt-1">
                    <p className="text-xs text-muted-foreground/70">
                      {artists.length} artist{artists.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="space-y-1 px-2">
                    {artists.map((artist) => (
                      <button
                        key={artist.channelName}
                        type="button"
                        data-ocid="search.artists.button"
                        onClick={() => onPlay(artist.topTrack, results)}
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-muted/40 active:bg-muted/60 transition-colors touch-manipulation"
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-border flex-shrink-0">
                          <img
                            src={
                              artist.topTrack.albumArt ||
                              artist.topTrack.thumbnail
                            }
                            alt={artist.channelName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-foreground truncate">
                            {artist.channelName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {artist.count} song{artist.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <Music2 className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── TRENDING TAB ── */}
              {activeTab === "trending" && (
                <>
                  <div className="px-4 pt-1 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <p className="text-xs text-muted-foreground/70">
                      {trendingTracks.length} trending
                    </p>
                  </div>
                  <div className="space-y-1">
                    {trendingTracks.map((track) => {
                      globalIndex += 1;
                      const idx = globalIndex;
                      return (
                        <div key={track.id} className="relative">
                          <span className="absolute right-4 top-3 z-10 text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
                            {formatViewCount(track.viewCount)}
                          </span>
                          {renderTrackRow(track, idx, results)}
                        </div>
                      );
                    })}
                    {trendingTracks.length === 0 && (
                      <div
                        data-ocid="search.trending.empty_state"
                        className="flex flex-col items-center justify-center gap-2 py-12"
                      >
                        <TrendingUp className="w-8 h-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          No trending results found
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pb-4"
            >
              {recentSearches.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Recent Searches
                  </p>
                  <div className="space-y-1">
                    {recentSearches.map((q, i) => (
                      <button
                        key={q}
                        type="button"
                        data-ocid={`search.recent.item.${i + 1}`}
                        onClick={() => handleRecentClick(q)}
                        className="flex items-center gap-3 w-full py-3 px-3 rounded-xl hover:bg-muted/40 active:bg-muted/60 transition-colors touch-manipulation"
                      >
                        <Clock className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                        <span className="text-sm text-foreground">{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  data-ocid="search.empty_state"
                  className="flex flex-col items-center justify-center gap-3 py-20"
                >
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <Music2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Search for music
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Find your favorite songs, artists, and more
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
