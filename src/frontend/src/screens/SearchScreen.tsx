import {
  AlertCircle,
  Clock,
  Loader2,
  Music2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TrackItem } from "../components/TrackItem";
import { useYouTubeSearch } from "../hooks/useYouTubeSearch";
import type { Playlist, Track } from "../types";

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
  const { results, isLoading, error, search, isDemoMode, hasVibeResults } =
    useYouTubeSearch();

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            data-ocid="search.input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search YouTube / VibePlay\u2026"
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
            Demo mode \u2014 add your YouTube API key in{" "}
            <code className="bg-muted px-1 rounded text-[10px]">
              constants.ts
            </code>
          </p>
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
              <p className="text-sm text-muted-foreground">Searching\u2026</p>
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
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-2 pb-4"
            >
              <div className="px-4 pb-2 flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground font-medium">
                  {results.length} results
                </p>
                {hasVibeResults && (
                  <span className="flex items-center gap-1 text-[10px] text-vibe-green/70 font-medium">
                    <Sparkles className="w-2.5 h-2.5" />
                    includes similar vibes
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {results.map((track, i) => (
                  <TrackItem
                    key={track.id}
                    track={track}
                    index={i + 1}
                    isPlaying={currentTrack?.id === track.id}
                    isFavorite={isFavorite(track.id)}
                    onPlay={(t) => onPlay(t, results)}
                    onToggleFavorite={onToggleFavorite}
                    playlists={playlists}
                    onAddToPlaylist={onAddToPlaylist}
                    isLoggedIn={isLoggedIn}
                    onShowLogin={onShowLogin}
                  />
                ))}
              </div>
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
