import { Heart, ListPlus, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Playlist, Track } from "../types";

interface TrackItemProps {
  track: Track;
  index: number;
  isPlaying?: boolean;
  isFavorite?: boolean;
  onPlay: (track: Track) => void;
  onToggleFavorite?: (track: Track) => void;
  showIndex?: boolean;
  playlists?: Playlist[];
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
}

export function TrackItem({
  track,
  index,
  isPlaying,
  isFavorite,
  onPlay,
  onToggleFavorite,
  showIndex = false,
  playlists,
  onAddToPlaylist,
}: TrackItemProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <div
      data-ocid={`track.item.${index}`}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 ${
        isPlaying
          ? "bg-vibe-green/10 border border-vibe-green/20"
          : "hover:bg-muted/40 active:bg-muted/60"
      }`}
    >
      {/* Thumbnail */}
      <button
        type="button"
        className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative touch-manipulation"
        onClick={() => onPlay(track)}
        aria-label={`Play ${track.title}`}
      >
        <img
          src={track.thumbnail}
          alt={track.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {showIndex && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-xs font-bold text-white">{index}</span>
          </div>
        )}
        {isPlaying && (
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
      </button>

      {/* Info */}
      <button
        type="button"
        className="flex-1 min-w-0 text-left touch-manipulation"
        onClick={() => onPlay(track)}
      >
        <p
          className={`text-sm font-semibold truncate ${isPlaying ? "text-vibe-green" : "text-foreground"}`}
        >
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {track.channelName}
          {track.duration && (
            <span className="ml-2 text-muted-foreground/60">
              {track.duration}
            </span>
          )}
        </p>
      </button>

      {/* Favorite + Playlist + Play buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {onToggleFavorite && (
          <button
            type="button"
            data-ocid={`track.toggle.${index}`}
            onClick={() => onToggleFavorite(track)}
            className="w-9 h-9 flex items-center justify-center rounded-full touch-manipulation"
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isFavorite
                  ? "fill-vibe-green text-vibe-green"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        )}

        {onAddToPlaylist && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              data-ocid={`track.open_modal_button.${index}`}
              onClick={() => setDropdownOpen((v) => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-full touch-manipulation hover:bg-muted/60 transition-colors"
              aria-label="Add to playlist"
            >
              <ListPlus className="w-4 h-4 text-muted-foreground" />
            </button>

            {dropdownOpen && (
              <div
                data-ocid={`track.popover.${index}`}
                className="absolute right-0 bottom-full mb-1 w-48 rounded-xl border border-border bg-[#1a1a1a] shadow-2xl z-50 overflow-hidden"
              >
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 pt-3 pb-1">
                  Add to playlist
                </p>
                {!playlists || playlists.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-3">
                    No playlists yet
                  </p>
                ) : (
                  <div className="pb-1">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => {
                          onAddToPlaylist(pl.id, track);
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-white/5 active:bg-white/10 touch-manipulation transition-colors truncate"
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          data-ocid={`track.play.button.${index}`}
          onClick={() => onPlay(track)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-muted/60 touch-manipulation"
        >
          <Play className="w-3.5 h-3.5 fill-foreground text-foreground" />
        </button>
      </div>
    </div>
  );
}
