import { Pause, Play, SkipForward } from "lucide-react";
import { motion } from "motion/react";
import type { Track } from "../types";

interface MiniPlayerProps {
  track: Track;
  isPlaying: boolean;
  progress: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onExpand: () => void;
}

export function MiniPlayer({
  track,
  isPlaying,
  progress,
  onTogglePlay,
  onNext,
  onExpand,
}: MiniPlayerProps) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 40 }}
      className="relative bg-[oklch(0.15_0_0)] border-t border-border overflow-hidden"
      style={{ flexShrink: 0 }}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-border">
        <motion.div
          className="h-full bg-vibe-green"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ minHeight: 64 }}
      >
        {/* Tappable area to expand */}
        <button
          type="button"
          data-ocid="miniplayer.panel"
          onClick={onExpand}
          className="flex items-center gap-3 flex-1 min-w-0 touch-manipulation"
        >
          {/* Thumbnail */}
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
            <img
              src={track.thumbnail}
              alt={track.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          {/* Track info */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-foreground truncate">
              {track.title}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {track.channelName}
            </p>
          </div>
        </button>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            data-ocid="miniplayer.toggle"
            onClick={onTogglePlay}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-vibe-green text-black touch-manipulation"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
          </button>
          <button
            type="button"
            data-ocid="miniplayer.next.button"
            onClick={onNext}
            className="w-10 h-10 flex items-center justify-center rounded-full touch-manipulation"
          >
            <SkipForward className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
