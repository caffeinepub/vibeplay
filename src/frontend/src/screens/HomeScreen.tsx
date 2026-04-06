import { ChevronRight, Clock, LogOut, Search, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { FilterChipBar } from "../components/FilterChipBar";
import { InterestPicker } from "../components/InterestPicker";
import { RecommendationFeed } from "../components/RecommendationFeed";
import { TrendingPlaylists } from "../components/TrendingPlaylists";
import { MOOD_CATEGORIES } from "../data/mockData";
import type { RecommendationSection, TabName, Track } from "../types";

interface HomeScreenProps {
  continueListening: Track[];
  recentSearches: string[];
  currentTrack: Track | null;
  onPlay: (track: Track, queue: Track[]) => void;
  onSearch: (query: string) => void;
  onNavigate: (tab: TabName) => void;
  username?: string;
  userId?: bigint;
  isLoggedIn?: boolean;
  onShowLogin?: () => void;
  onLogout?: () => void;
  // Recommendation engine
  recommendationSections?: RecommendationSection[];
  onLoadMoreRecommendations?: () => void;
  needsOnboarding?: boolean;
  onSetInterests?: (genres: string[]) => void;
  // Filter chips
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Generates a deterministic 7-character alphanumeric code from a bigint user ID.
 */
function generateUserCode(userId: bigint): string {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const base = BigInt(CHARS.length);
  const mask = base ** BigInt(7) - BigInt(1);
  let n = userId < BigInt(0) ? -userId : userId;
  n = n & mask;
  let code = "";
  for (let i = 0; i < 7; i++) {
    code = CHARS[Number(n % base)] + code;
    n = n / base;
  }
  return code;
}

export function HomeScreen({
  continueListening,
  recentSearches,
  currentTrack,
  onPlay,
  onSearch,
  onNavigate,
  username,
  userId,
  isLoggedIn,
  onShowLogin,
  onLogout,
  recommendationSections = [],
  onLoadMoreRecommendations,
  needsOnboarding = false,
  onSetInterests,
  onFiltersChange,
}: HomeScreenProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [interestPickerDismissed, setInterestPickerDismissed] = useState(false);

  const displayName = username || "Deepak";
  const userCode =
    isLoggedIn && userId != null ? generateUserCode(userId) : null;

  const showInterestPicker = needsOnboarding && !interestPickerDismissed;

  const handleInterestConfirm = (genres: string[]) => {
    onSetInterests?.(genres);
    setInterestPickerDismissed(true);
  };

  const handleInterestSkip = () => {
    setInterestPickerDismissed(true);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Gradient accent line at very top */}
        <div
          className="w-full"
          style={{
            height: 3,
            background:
              "linear-gradient(90deg, oklch(0.58 0.24 293), oklch(0.62 0.24 350), oklch(0.75 0.17 200))",
          }}
        />

        {/* Header / Greeting */}
        <div className="px-4 pt-5 pb-3">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <img
                  src="/assets/generated/vibeplay-logo-transparent.dim_400x400.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <p className="text-xs font-bold uppercase tracking-widest gradient-text">
                  VibePlay
                </p>
              </div>
              <h1
                className="text-3xl font-bold text-foreground"
                style={{
                  textShadow:
                    "0 0 24px rgba(168,85,247,0.35), 0 0 48px rgba(236,72,153,0.15)",
                }}
              >
                {getGreeting()}, {displayName} 👋
              </h1>
              {userCode && (
                <p
                  className="text-xs font-mono mt-0.5 tracking-widest"
                  style={{ color: "oklch(0.75 0.17 200)" }}
                >
                  #{userCode}
                </p>
              )}
            </div>

            {/* Profile / Auth button */}
            <div className="relative mt-1">
              <button
                type="button"
                data-ocid="home.profile.button"
                onClick={() => {
                  if (isLoggedIn) {
                    setShowUserMenu((v) => !v);
                  } else {
                    onShowLogin?.();
                  }
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation transition-colors"
                style={{
                  background: isLoggedIn
                    ? "rgba(168,85,247,0.15)"
                    : "oklch(var(--muted))",
                  border: isLoggedIn
                    ? "1.5px solid rgba(168,85,247,0.4)"
                    : "1.5px solid oklch(var(--border))",
                }}
                aria-label={isLoggedIn ? "User menu" : "Log in"}
              >
                {isLoggedIn && username ? (
                  <span className="text-xs font-bold gradient-text">
                    {username.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              <AnimatePresence>
                {showUserMenu && isLoggedIn && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-10 w-44 rounded-2xl border border-border bg-[#1a1a1a] shadow-2xl z-50 overflow-hidden"
                    style={{ borderColor: "rgba(168,85,247,0.25)" }}
                  >
                    <div
                      className="px-4 py-3 border-b"
                      style={{ borderColor: "rgba(168,85,247,0.15)" }}
                    >
                      <p className="text-xs text-muted-foreground">
                        Signed in as
                      </p>
                      <p className="text-sm font-semibold text-foreground truncate">
                        {username}
                      </p>
                      {userCode && (
                        <p
                          className="text-[10px] font-mono mt-0.5"
                          style={{ color: "oklch(0.75 0.17 200 / 0.7)" }}
                        >
                          #{userCode}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      data-ocid="home.logout.button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 touch-manipulation transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {showUserMenu && (
                // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
              )}
            </div>
          </motion.div>
        </div>

        {/* Filter Chip Bar — below greeting, above Continue Listening */}
        <FilterChipBar onFiltersChange={onFiltersChange} />

        {/* 🔥 Trending Playlists */}
        <TrendingPlaylists onPlay={onPlay} currentTrack={currentTrack} />

        {/* Continue Listening (native, non-recommendation section) */}
        {continueListening.length > 0 && (
          <section className="px-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock
                  className="w-4 h-4"
                  style={{ color: "oklch(0.58 0.24 293)" }}
                />
                Continue Listening
              </h2>
            </div>
            <div className="space-y-2">
              {continueListening.slice(0, 4).map((track, i) => (
                <motion.button
                  key={track.id}
                  type="button"
                  data-ocid={`home.continue.item.${i + 1}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => onPlay(track, continueListening)}
                  className="flex items-center gap-3 w-full bg-muted/30 hover:bg-muted/50 active:bg-muted/70 rounded-xl p-2.5 touch-manipulation transition-colors"
                  style={{
                    borderLeft: "3px solid oklch(0.58 0.24 293 / 0.5)",
                  }}
                >
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-muted"
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {track.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {track.channelName}
                    </p>
                  </div>
                  {currentTrack?.id === track.id && (
                    <div className="flex gap-0.5 items-end h-4 flex-shrink-0 mr-1">
                      {[0, 1, 2].map((j) => (
                        <div
                          key={j}
                          className="w-0.5 rounded-full animate-bounce"
                          style={{
                            height: `${50 + j * 25}%`,
                            animationDelay: `${j * 0.15}s`,
                            background: "oklch(0.58 0.24 293)",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* Recommendation Feed — between greeting and mood categories */}
        {recommendationSections.length > 0 && (
          <RecommendationFeed
            sections={recommendationSections}
            currentTrack={currentTrack}
            onPlay={onPlay}
            onLoadMore={onLoadMoreRecommendations}
          />
        )}

        {/* Mood Categories */}
        {MOOD_CATEGORIES.map((mood, moodIdx) => (
          <section key={mood.id} className="mb-6">
            <div className="px-4 flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  {mood.emoji} {mood.name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mood.description}
                </p>
              </div>
              <button
                type="button"
                data-ocid={`home.mood.${mood.id}.button`}
                className="flex items-center gap-1 text-xs font-medium touch-manipulation"
                style={{ color: "oklch(0.62 0.24 350)" }}
              >
                See all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
              <motion.button
                type="button"
                data-ocid={`home.mood.${mood.id}.card.1`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: moodIdx * 0.08 }}
                onClick={() => onPlay(mood.tracks[0], mood.tracks)}
                className="flex-shrink-0 w-36 rounded-2xl overflow-hidden relative touch-manipulation"
                style={{ height: 144 }}
              >
                <img
                  src={mood.image}
                  alt={mood.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-xs font-bold text-white">
                    {mood.name} Mix
                  </p>
                  <p className="text-[10px] text-white/70">
                    {mood.tracks.length} tracks
                  </p>
                </div>
              </motion.button>

              {mood.tracks.map((track, ti) => (
                <motion.button
                  key={track.id}
                  type="button"
                  data-ocid={`home.mood.${mood.id}.card.${ti + 2}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: moodIdx * 0.08 + ti * 0.04 }}
                  onClick={() => onPlay(track, mood.tracks)}
                  className="flex-shrink-0 w-28 rounded-2xl overflow-hidden relative touch-manipulation group"
                  style={{ height: 144 }}
                >
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2">
                      {track.title}
                    </p>
                    <p className="text-[10px] text-white/60 mt-0.5 truncate">
                      {track.channelName}
                    </p>
                  </div>
                  {currentTrack?.id === track.id && (
                    <div
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "oklch(0.62 0.24 350)" }}
                    >
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </section>
        ))}

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <section className="px-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Search
                  className="w-4 h-4"
                  style={{ color: "oklch(0.75 0.17 200)" }}
                />
                Recent Searches
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.slice(0, 8).map((q, i) => (
                <button
                  key={q}
                  type="button"
                  data-ocid={`home.recent.item.${i + 1}`}
                  onClick={() => {
                    onSearch(q);
                    onNavigate("search");
                  }}
                  className="px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors touch-manipulation"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="px-4 py-6 border-t border-border mt-4">
          <div className="flex items-center gap-2 mb-2">
            <img
              src="/assets/generated/vibeplay-logo-transparent.dim_400x400.png"
              alt="VibePlay"
              className="w-7 h-7 object-contain"
            />
            <img
              src="/assets/generated/vibeplay-wordmark-color.dim_400x100.png"
              alt="VibePlay"
              className="h-5 object-contain"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Made by{" "}
            <span className="text-muted-foreground/80 font-medium">
              Deepak Chahal
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            &copy; {new Date().getFullYear()}. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "oklch(0.75 0.17 200)" }}
            >
              caffeine.ai
            </a>
          </p>
        </footer>
      </div>

      {/* Interest Picker overlay */}
      {showInterestPicker && (
        <InterestPicker
          onConfirm={handleInterestConfirm}
          onSkip={handleInterestSkip}
        />
      )}
    </>
  );
}
