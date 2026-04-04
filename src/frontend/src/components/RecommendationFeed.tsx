import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import type { RecommendationSection, Track } from "../types";

interface RecommendationFeedProps {
  sections: RecommendationSection[];
  currentTrack: Track | null;
  onPlay: (track: Track, queue: Track[]) => void;
  onLoadMore?: () => void;
}

// Section accent colours cycling: purple, cyan, amber, pink
const SECTION_ACCENT_COLORS: Record<string, string> = {
  recommended: "oklch(0.58 0.24 293)",
  "because-watched": "oklch(0.75 0.17 200)",
  trending: "oklch(0.72 0.19 55)",
  "continue-watching": "oklch(0.62 0.24 350)",
};

const SECTION_ACCENT_FALLBACKS = [
  "oklch(0.58 0.24 293)",
  "oklch(0.75 0.17 200)",
  "oklch(0.72 0.19 55)",
  "oklch(0.62 0.24 350)",
];

function getSectionAccent(id: string, idx: number): string {
  return (
    SECTION_ACCENT_COLORS[id] ??
    SECTION_ACCENT_FALLBACKS[idx % SECTION_ACCENT_FALLBACKS.length]
  );
}

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-28" style={{ height: 144 }}>
      <Skeleton className="w-full h-full rounded-2xl" />
    </div>
  );
}

function TrackCard({
  track,
  isPlaying,
  onPlay,
  queue,
}: {
  track: Track;
  isPlaying: boolean;
  onPlay: (track: Track, queue: Track[]) => void;
  queue: Track[];
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={() => onPlay(track, queue)}
      className="flex-shrink-0 w-28 rounded-2xl overflow-hidden relative touch-manipulation group"
      style={{ height: 144 }}
    >
      <img
        src={track.thumbnail}
        alt={track.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute bottom-2 left-2 right-2">
        <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2">
          {track.title}
        </p>
        <p className="text-[10px] text-white/60 mt-0.5 truncate">
          {track.channelName}
        </p>
      </div>
      {isPlaying && (
        <div
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.58 0.24 293), oklch(0.62 0.24 350))",
          }}
        >
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        </div>
      )}
    </motion.button>
  );
}

export function RecommendationFeed({
  sections,
  currentTrack,
  onPlay,
  onLoadMore,
}: RecommendationFeedProps) {
  if (sections.length === 0) return null;

  return (
    <div className="mb-2">
      {sections.map((section, sectionIdx) => {
        const hasContent = section.tracks.length > 0;
        if (!hasContent && !section.isLoading) return null;

        const accentColor = getSectionAccent(section.id, sectionIdx);

        return (
          <motion.section
            key={section.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIdx * 0.07, duration: 0.35 }}
            className="mb-6"
          >
            {/* Section header with coloured accent */}
            <div className="px-4 mb-3 flex items-center gap-2">
              <div
                className="w-0.5 h-4 rounded-full flex-shrink-0"
                style={{ background: accentColor }}
              />
              <div className="flex-1 min-w-0">
                <h2
                  className="text-sm font-bold uppercase tracking-wider"
                  style={{ color: accentColor }}
                >
                  {section.title}
                </h2>
                {section.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {section.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Cards row */}
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
              {section.isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
                    <SkeletonCard key={i} />
                  ))
                : section.tracks.map((track) => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      isPlaying={currentTrack?.id === track.id}
                      onPlay={onPlay}
                      queue={section.tracks}
                    />
                  ))}

              {/* Load more inline card for Recommended section */}
              {section.id === "recommended" &&
                !section.isLoading &&
                onLoadMore &&
                section.tracks.length > 0 && (
                  <motion.button
                    type="button"
                    data-ocid="rec.load_more.button"
                    whileTap={{ scale: 0.94 }}
                    onClick={onLoadMore}
                    className="flex-shrink-0 w-28 rounded-2xl flex flex-col items-center justify-center gap-1.5 touch-manipulation"
                    style={{
                      height: 144,
                      background: "oklch(0.58 0.24 293 / 0.08)",
                      border: "1.5px solid oklch(0.58 0.24 293 / 0.25)",
                    }}
                  >
                    <ChevronRight
                      className="w-5 h-5"
                      style={{ color: "oklch(0.58 0.24 293)" }}
                    />
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: "oklch(0.58 0.24 293)" }}
                    >
                      Load more
                    </span>
                  </motion.button>
                )}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
