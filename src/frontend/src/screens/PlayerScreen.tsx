import { Skeleton } from "@/components/ui/skeleton";
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
  relatedTracks: Track[];
  isLoadingRelated: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (percent: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: () => void;
  onBack: () => void;
  onPlayRelated: (track: Track) => void;
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
  relatedTracks,
  isLoadingRelated,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onBack,
  onPlayRelated,
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
    <div className="flex-1 flex flex-col overflow-y-auto">
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
      <div className="flex items-center justify-center px-8 py-4 flex-shrink-0">
        <motion.div
          key={track.id}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`w-full max-w-xs aspect-square rounded-3xl overflow-hidden shadow-2xl ${
            isPlaying ? "animate-pulse-green" : ""
          }`}
          style={{ maxHeight: "min(50vw, 240px)" }}
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

      {/* Up Next Section */}
      <div className="px-4 pb-6 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <ListMusic className="w-4 h-4 text-vibe-green" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Up Next
          </h3>
          {!isLoadingRelated && relatedTracks.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {relatedTracks.length} songs
            </span>
          )}
        </div>

        <div data-ocid="player.upnext.list" className="flex flex-col gap-1">
          {isLoadingRelated ? (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  data-ocid="player.upnext.loading_state"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                >
                  <Skeleton className="w-11 h-11 rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                  <Skeleton className="w-8 h-3 rounded flex-shrink-0" />
                </div>
              ))}
            </>
          ) : relatedTracks.length === 0 ? (
            <div
              data-ocid="player.upnext.empty_state"
              className="flex flex-col items-center gap-2 py-6"
            >
              <ListMusic className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                No recommendations yet
              </p>
            </div>
          ) : (
            relatedTracks.map((relTrack, idx) => (
              <button
                key={relTrack.id}
                type="button"
                data-ocid={`player.upnext.item.${idx + 1}`}
                onClick={() => onPlayRelated(relTrack)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left transition-colors touch-manipulation ${
                  relTrack.id === track.id
                    ? "bg-vibe-green/10 border border-vibe-green/20"
                    : "hover:bg-muted/40 active:bg-muted/60"
                }`}
              >
                {/* Thumbnail */}
                <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative">
                  <img
                    src={relTrack.thumbnail}
                    alt={relTrack.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {relTrack.id === track.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="flex gap-0.5 items-end h-4">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-0.5 bg-vibe-green rounded-full animate-bounce"
                            style={{
                              height: `${60 + i * 20}%`,
                              animationDelay: `${i * 0.15}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      relTrack.id === track.id
                        ? "text-vibe-green"
                        : "text-foreground"
                    }`}
                  >
                    {relTrack.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {relTrack.channelName}
                  </p>
                </div>

                {/* Duration */}
                {relTrack.duration && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {relTrack.duration}
                  </span>
                )}

                {/* Play indicator */}
                {relTrack.id !== track.id && (
                  <div className="w-7 h-7 flex items-center justify-center rounded-full bg-muted/60 flex-shrink-0">
                    <Play className="w-3 h-3 fill-foreground text-foreground" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
