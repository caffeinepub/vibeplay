import { Slider } from "@/components/ui/slider";
import {
  ChevronDown,
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import type { RepeatMode, Track } from "../types";

function formatTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface PlayerScreenProps {
  track: Track | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  isFavorite: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (percent: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: () => void;
  onBack: () => void;
}

export function PlayerScreen({
  track,
  isPlaying,
  progress,
  currentTime,
  duration,
  volume,
  shuffle,
  repeat,
  isFavorite,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onBack,
}: PlayerScreenProps) {
  const [showVolume, setShowVolume] = useState(false);

  if (!track) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
          <ListMusic className="w-10 h-10 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground">
          Nothing Playing
        </p>
        <p className="text-sm text-muted-foreground text-center">
          Search for a song or pick a mood to start listening
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 flex-shrink-0">
        <button
          type="button"
          data-ocid="player.back.button"
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 touch-manipulation"
        >
          <ChevronDown className="w-5 h-5 text-foreground" />
        </button>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Now Playing
        </p>
        <button
          type="button"
          data-ocid="player.volume.button"
          onClick={() => setShowVolume(!showVolume)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 touch-manipulation"
        >
          <Volume2 className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Volume Slider */}
      {showVolume && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="px-8 pb-2 flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <Slider
              data-ocid="player.volume.select"
              value={[volume]}
              min={0}
              max={100}
              step={1}
              onValueChange={([val]) => onVolumeChange(val)}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">
              {volume}%
            </span>
          </div>
        </motion.div>
      )}

      {/* Album Art */}
      <div className="flex-1 flex items-center justify-center px-8 py-4 min-h-0">
        <motion.div
          key={track.id}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`w-full max-w-xs aspect-square rounded-3xl overflow-hidden shadow-2xl ${
            isPlaying ? "animate-pulse-green" : ""
          }`}
          style={{ maxHeight: "min(50vw, 260px)" }}
        >
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "/assets/generated/vibeplay-logo-transparent.dim_120x120.png";
            }}
          />
        </motion.div>
      </div>

      {/* Track info */}
      <div className="px-6 pb-3 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <h2 className="text-lg font-bold text-foreground leading-tight line-clamp-2">
              {track.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {track.channelName}
            </p>
          </div>
          <button
            type="button"
            data-ocid="player.favorite.toggle"
            onClick={onToggleFavorite}
            className="w-10 h-10 flex items-center justify-center rounded-full touch-manipulation flex-shrink-0 mt-0.5"
          >
            <Heart
              className={`w-5 h-5 transition-all ${
                isFavorite
                  ? "fill-vibe-green text-vibe-green scale-110"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 pb-2 flex-shrink-0">
        <Slider
          data-ocid="player.progress.select"
          value={[progress]}
          min={0}
          max={100}
          step={0.1}
          onValueChange={([val]) => onSeek(val)}
          className="w-full"
        />
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-muted-foreground">
            {formatTime(currentTime)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 pb-5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <button
            type="button"
            data-ocid="player.shuffle.toggle"
            onClick={onToggleShuffle}
            className="w-11 h-11 flex items-center justify-center rounded-full touch-manipulation"
          >
            <Shuffle
              className={`w-5 h-5 transition-colors ${shuffle ? "text-vibe-green" : "text-muted-foreground"}`}
            />
          </button>

          <button
            type="button"
            data-ocid="player.prev.button"
            onClick={onPrev}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-muted/50 touch-manipulation active:scale-95 transition-transform"
          >
            <SkipBack className="w-5 h-5 fill-foreground text-foreground" />
          </button>

          <button
            type="button"
            data-ocid="player.play.button"
            onClick={onTogglePlay}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-vibe-green touch-manipulation active:scale-95 transition-transform shadow-glow"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-black text-black" />
            ) : (
              <Play className="w-7 h-7 fill-black text-black ml-0.5" />
            )}
          </button>

          <button
            type="button"
            data-ocid="player.next.button"
            onClick={onNext}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-muted/50 touch-manipulation active:scale-95 transition-transform"
          >
            <SkipForward className="w-5 h-5 fill-foreground text-foreground" />
          </button>

          <button
            type="button"
            data-ocid="player.repeat.toggle"
            onClick={onCycleRepeat}
            className="w-11 h-11 flex items-center justify-center rounded-full touch-manipulation"
          >
            {repeat === "one" ? (
              <Repeat1 className="w-5 h-5 text-vibe-green" />
            ) : (
              <Repeat
                className={`w-5 h-5 transition-colors ${
                  repeat === "all" ? "text-vibe-green" : "text-muted-foreground"
                }`}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
