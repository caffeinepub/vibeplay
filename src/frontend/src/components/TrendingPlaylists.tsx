import { Skeleton } from "@/components/ui/skeleton";
import { Play } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { YOUTUBE_API_BASE, fetchWithKeyFallback } from "../constants";
import type { Track } from "../types";
import { applyOfficialFilter } from "../utils/officialFilter";

interface TrendingPlaylist {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  query: string;
  description: string;
}

const TRENDING_PLAYLISTS: TrendingPlaylist[] = [
  {
    id: "love-songs",
    name: "Love Songs",
    emoji: "\u2764\uFE0F",
    gradient: "linear-gradient(135deg, #FF4D8A, #FF6B6B)",
    query: "bollywood romantic love songs hindi official 2024",
    description: "Romantic Bollywood hits",
  },
  {
    id: "party-songs",
    name: "Party Songs",
    emoji: "\uD83C\uDF89",
    gradient: "linear-gradient(135deg, #FF9F1C, #FF6B6B)",
    query: "bollywood party dance songs hindi official 2024",
    description: "High-energy Bollywood",
  },
  {
    id: "heartbreak",
    name: "Heartbreak",
    emoji: "\uD83D\uDC94",
    gradient: "linear-gradient(135deg, #4B0082, #1E3A8A)",
    query: "hindi sad heartbreak emotional songs official 2024",
    description: "Sad Hindi songs",
  },
  {
    id: "old-school",
    name: "Old School Romance",
    emoji: "\uD83D\uDCFB",
    gradient: "linear-gradient(135deg, #8B4513, #D2691E)",
    query: "old hindi romantic songs 90s 80s classic bollywood official",
    description: "Classic vintage love songs",
  },
];

interface TrendingPlaylistsProps {
  onPlay: (track: Track, queue: Track[]) => void;
  currentTrack: Track | null;
}

async function fetchPlaylistTracks(query: string): Promise<Track[]> {
  try {
    const res = await fetchWithKeyFallback((key) => {
      const url = new URL(`${YOUTUBE_API_BASE}/search`);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("videoCategoryId", "10");
      url.searchParams.set("maxResults", "20");
      url.searchParams.set("safeSearch", "strict");
      url.searchParams.set("relevanceLanguage", "hi");
      url.searchParams.set("key", key);
      return url.toString();
    });
    if (!res.ok) return [];
    const data = await res.json();
    const tracks: Track[] = (data.items ?? []).map(
      (item: {
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: { medium: { url: string } };
        };
      }) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channelName: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
        source: "youtube" as const,
      }),
    );
    return applyOfficialFilter(tracks);
  } catch {
    return [];
  }
}

export function TrendingPlaylists({
  onPlay,
  currentTrack,
}: TrendingPlaylistsProps) {
  const [playlistTracks, setPlaylistTracks] = useState<Record<string, Track[]>>(
    {},
  );
  const [loadingPlaylists, setLoadingPlaylists] = useState<
    Record<string, boolean>
  >(() => Object.fromEntries(TRENDING_PLAYLISTS.map((p) => [p.id, true])));
  const loadedRef = useRef(false);

  const loadPlaylist = useCallback(async (playlist: TrendingPlaylist) => {
    setLoadingPlaylists((prev) => ({ ...prev, [playlist.id]: true }));
    const tracks = await fetchPlaylistTracks(playlist.query);
    setPlaylistTracks((prev) => ({ ...prev, [playlist.id]: tracks }));
    setLoadingPlaylists((prev) => ({ ...prev, [playlist.id]: false }));
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    // Load all playlists staggered to avoid hammering the API
    TRENDING_PLAYLISTS.forEach((pl, i) => {
      setTimeout(() => loadPlaylist(pl), i * 600);
    });
  }, [loadPlaylist]);

  return (
    <section className="mb-6">
      {/* Section header */}
      <div className="px-4 mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <span>\uD83D\uDD25</span>
          <span
            style={{
              background:
                "linear-gradient(90deg, oklch(0.62 0.24 350), oklch(0.72 0.19 55))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Trending Playlists
          </span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Indian music handpicked for you
        </p>
      </div>

      {/* Playlists horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
        {TRENDING_PLAYLISTS.map((playlist, idx) => {
          const tracks = playlistTracks[playlist.id] ?? [];
          const isLoading = loadingPlaylists[playlist.id] ?? true;

          return (
            <motion.div
              key={playlist.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="flex-shrink-0 w-40 rounded-2xl overflow-hidden relative"
              style={{ height: 180 }}
            >
              {/* Background gradient */}
              <div
                className="absolute inset-0"
                style={{ background: playlist.gradient }}
              />

              {/* Thumbnail grid overlay */}
              {!isLoading && tracks.length >= 4 && (
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-25">
                  {tracks.slice(0, 4).map((t) => (
                    <img
                      key={t.id}
                      src={t.thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ))}
                </div>
              )}

              {/* Skeleton loading */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Skeleton className="w-full h-full rounded-2xl opacity-20" />
                </div>
              )}

              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-between p-3">
                <div>
                  <span className="text-2xl">{playlist.emoji}</span>
                  <p className="text-[10px] font-semibold text-white/70 mt-1 leading-tight">
                    {playlist.description}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-bold text-white leading-tight mb-2">
                    {playlist.name}
                  </p>
                  {isLoading ? (
                    <Skeleton className="w-full h-7 rounded-full opacity-30" />
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        tracks.length > 0 && onPlay(tracks[0], tracks)
                      }
                      disabled={tracks.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white touch-manipulation transition-all active:scale-95 disabled:opacity-50"
                      style={{
                        background: "rgba(255,255,255,0.2)",
                        border: "1px solid rgba(255,255,255,0.35)",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      <Play className="w-3 h-3 fill-white" />
                      Play All
                    </button>
                  )}
                  {!isLoading && tracks.length > 0 && (
                    <p className="text-[9px] text-white/50 mt-1">
                      {tracks.length} songs
                    </p>
                  )}
                </div>
              </div>

              {/* Playing indicator */}
              {!isLoading &&
                currentTrack &&
                tracks.some((t) => t.id === currentTrack.id) && (
                  <div
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.3)" }}
                  >
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  </div>
                )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
