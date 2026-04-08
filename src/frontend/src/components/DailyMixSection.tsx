import { Skeleton } from "@/components/ui/skeleton";
import { Play } from "lucide-react";
import { motion } from "motion/react";
import type { DailyMix } from "../hooks/useDailyMix";
import type { Track } from "../types";

interface DailyMixSectionProps {
  mixes: DailyMix[];
  isLoading: boolean;
  currentTrack: Track | null;
  onPlay: (track: Track, queue: Track[]) => void;
}

/** 2×2 thumbnail collage for a mix card */
function MixCollage({ thumbnails }: { thumbnails: string[] }) {
  const filled = [...thumbnails, "", "", "", ""].slice(0, 4);
  return (
    <div className="grid grid-cols-2 gap-0.5 w-full h-full rounded-xl overflow-hidden">
      {filled.map((src, i) => {
        const cellKey = src ? `thumb-${src}` : `empty-${i}`;
        return src ? (
          <img
            key={cellKey}
            src={src}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = "0";
            }}
          />
        ) : (
          <div
            key={cellKey}
            className="w-full h-full"
            style={{ background: "oklch(0.18 0 0)" }}
          />
        );
      })}
    </div>
  );
}

export function DailyMixSection({
  mixes,
  isLoading,
  currentTrack,
  onPlay,
}: DailyMixSectionProps) {
  if (!isLoading && mixes.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="px-4 flex items-center justify-between mb-3">
        <div>
          <h2
            className="text-sm font-bold uppercase tracking-wider"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.62 0.24 350), oklch(0.75 0.17 200))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            🎵 Daily Mix
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Made for you · refreshes daily
          </p>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
        {isLoading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-40">
                <Skeleton className="w-40 h-40 rounded-2xl mb-2" />
                <Skeleton className="h-3.5 w-28 rounded mb-1" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            ))
          : mixes.map((mix, idx) => {
              const isCurrentlyPlaying =
                mix.tracks.length > 0 &&
                mix.tracks.some((t) => t.id === currentTrack?.id);
              return (
                <motion.button
                  key={mix.id}
                  type="button"
                  data-ocid={`home.dailymix.card.${mix.id}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.08 }}
                  onClick={() =>
                    mix.tracks.length > 0 && onPlay(mix.tracks[0], mix.tracks)
                  }
                  className="flex-shrink-0 w-40 touch-manipulation group"
                  disabled={mix.tracks.length === 0}
                >
                  {/* Cover */}
                  <div
                    className="w-40 h-40 rounded-2xl overflow-hidden relative mb-2"
                    style={{ background: mix.gradient }}
                  >
                    {mix.coverThumbnails.length > 0 ? (
                      <MixCollage thumbnails={mix.coverThumbnails} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-3xl">🎵</span>
                      </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Mix number badge */}
                    <div
                      className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
                      style={{ background: mix.gradient }}
                    >
                      Mix {mix.id}
                    </div>

                    {/* Play button overlay */}
                    <div
                      className="absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                      style={{
                        background: isCurrentlyPlaying
                          ? "oklch(0.62 0.24 350)"
                          : "rgba(255,255,255,0.15)",
                        backdropFilter: "blur(4px)",
                        boxShadow: isCurrentlyPlaying
                          ? "0 2px 12px oklch(0.62 0.24 350 / 0.5)"
                          : "none",
                      }}
                    >
                      {isCurrentlyPlaying ? (
                        <div className="flex gap-0.5 items-end h-3">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="w-0.5 rounded-full animate-bounce"
                              style={{
                                height: `${50 + i * 25}%`,
                                animationDelay: `${i * 0.15}s`,
                                background: "white",
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      )}
                    </div>
                  </div>

                  {/* Text */}
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {mix.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {mix.subtitle}
                    </p>
                    {mix.tracks.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {mix.tracks.length} tracks
                      </p>
                    )}
                  </div>
                </motion.button>
              );
            })}
      </div>
    </section>
  );
}
