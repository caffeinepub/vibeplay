/**
 * ImportPlaylistPanel — bottom-sheet overlay for importing YouTube/Spotify playlists.
 *
 * Flow:
 * 1. User pastes a URL → hit Import
 * 2. Progress shown while loading tracks
 * 3. Preview of fetched playlist (cover, title, track list)
 * 4. "Play All" → saves + plays, "Save to Library" → saves only
 */
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Disc3,
  Link2,
  ListMusic,
  Play,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import {
  type ImportedPlaylist,
  detectPlatform,
  extractSpotifyPlaylistId,
  extractYouTubePlaylistId,
  fetchSpotifyPlaylist,
  fetchYouTubePlaylist,
} from "../services/importPlaylistService";
import type { Track } from "../types";

interface ImportPlaylistPanelProps {
  onClose: () => void;
  onSave: (name: string, tracks: Track[]) => void;
}

type PanelStep = "input" | "loading" | "preview" | "error";

export function ImportPlaylistPanel({
  onClose,
  onSave,
}: ImportPlaylistPanelProps) {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<PanelStep>("input");
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [playlist, setPlaylist] = useState<ImportedPlaylist | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [urlValidationMsg, setUrlValidationMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Real-time validation triggered on blur — before the user even hits Import */
  const handleUrlBlur = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlValidationMsg("");
      return;
    }
    const platform = detectPlatform(trimmed);
    if (platform === "unknown") {
      setUrlValidationMsg(
        "Could not detect platform — paste a YouTube or Spotify playlist link.",
      );
    } else {
      setUrlValidationMsg("");
    }
  }, [url]);

  const handleProgress = useCallback((loaded: number, total: number) => {
    setProgress({ loaded, total });
  }, []);

  const handleImport = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    const platform = detectPlatform(trimmedUrl);
    if (platform === "unknown") {
      setErrorMsg(
        "Invalid playlist link. Paste a YouTube or Spotify playlist URL.",
      );
      setStep("error");
      return;
    }

    setStep("loading");
    setProgress({ loaded: 0, total: 0 });
    setErrorMsg("");
    setSaved(false);

    try {
      let result: ImportedPlaylist;

      if (platform === "youtube") {
        const id = extractYouTubePlaylistId(trimmedUrl);
        if (!id) throw new Error("Could not extract playlist ID from URL.");
        result = await fetchYouTubePlaylist(id, handleProgress);
      } else {
        const id = extractSpotifyPlaylistId(trimmedUrl);
        if (!id) throw new Error("Could not extract playlist ID from URL.");
        result = await fetchSpotifyPlaylist(id, handleProgress);
      }

      setPlaylist(result);
      setStep("preview");
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Failed to import playlist. Please try again.",
      );
      setStep("error");
    }
  }, [url, handleProgress]);

  const handleSave = useCallback(
    (andPlay = false) => {
      if (!playlist) return;
      onSave(playlist.title, playlist.tracks);
      setSaved(true);
      if (andPlay) {
        setTimeout(onClose, 300);
      }
    },
    [playlist, onSave, onClose],
  );

  const handleReset = useCallback(() => {
    setStep("input");
    setUrl("");
    setPlaylist(null);
    setErrorMsg("");
    setUrlValidationMsg("");
    setSaved(false);
    setProgress({ loaded: 0, total: 0 });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.loaded / progress.total) * 100)
      : 0;

  return (
    <motion.div
      data-ocid="import.panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close import panel"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClose()}
      />

      {/* Panel */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="relative bg-card border-t border-border rounded-t-3xl overflow-hidden"
        style={{ maxHeight: "85dvh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.58 0.24 293), oklch(0.62 0.24 350))",
              }}
            >
              <Link2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Import Playlist
              </h2>
              <p className="text-xs text-muted-foreground">
                YouTube or Spotify
              </p>
            </div>
          </div>
          <button
            type="button"
            data-ocid="import.close_button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted touch-manipulation transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: "calc(85dvh - 100px)" }}
        >
          <AnimatePresence mode="wait">
            {/* ── Step: Input / Error ──────────────────────────────────────── */}
            {(step === "input" || step === "error") && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="px-5 py-5 space-y-4"
              >
                {/* URL input */}
                <div className="space-y-2">
                  <label
                    htmlFor="import-playlist-url"
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    Playlist Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      id="import-playlist-url"
                      data-ocid="import.url.input"
                      type="url"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (step === "error") setStep("input");
                        if (urlValidationMsg) setUrlValidationMsg("");
                      }}
                      onBlur={handleUrlBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleImport()}
                      placeholder="Paste YouTube or Spotify playlist link…"
                      className={`flex-1 bg-muted/60 border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors ${urlValidationMsg ? "border-destructive/60 focus:border-destructive" : "border-border focus:border-vibe-green/50"}`}
                    />
                    <Button
                      data-ocid="import.import.button"
                      onClick={handleImport}
                      disabled={!url.trim() || !!urlValidationMsg}
                      size="sm"
                      className="px-4 rounded-xl flex-shrink-0 touch-manipulation"
                      style={{
                        background:
                          "linear-gradient(135deg, oklch(0.58 0.24 293), oklch(0.62 0.24 350))",
                        color: "white",
                        border: "none",
                      }}
                    >
                      Import
                    </Button>
                  </div>

                  {/* Inline URL validation error (shows on blur, before submit) */}
                  {urlValidationMsg && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-destructive flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {urlValidationMsg}
                    </motion.p>
                  )}
                </div>

                {/* Error message */}
                {step === "error" && errorMsg && (
                  <motion.div
                    data-ocid="import.error_state"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-start gap-3 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl"
                  >
                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{errorMsg}</p>
                  </motion.div>
                )}

                {/* Platform hints */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    Supported formats:
                  </p>
                  <div className="space-y-1.5">
                    {[
                      {
                        icon: "▶",
                        label: "YouTube",
                        example: "youtube.com/playlist?list=…",
                      },
                      {
                        icon: "♫",
                        label: "YouTube Music",
                        example: "music.youtube.com/playlist?list=…",
                      },
                      {
                        icon: "●",
                        label: "Spotify",
                        example: "open.spotify.com/playlist/…",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-2.5"
                      >
                        <span className="w-5 text-center text-xs text-muted-foreground/60">
                          {item.icon}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">
                            {item.label}:
                          </span>{" "}
                          {item.example}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step: Loading ────────────────────────────────────────────── */}
            {step === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="px-5 py-6 space-y-5"
                data-ocid="import.loading_state"
              >
                {/* Animated icon */}
                <div className="flex justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "linear",
                    }}
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, oklch(0.58 0.24 293 / 0.2), oklch(0.62 0.24 350 / 0.2))",
                    }}
                  >
                    <Disc3
                      className="w-6 h-6"
                      style={{ color: "oklch(0.62 0.24 350)" }}
                    />
                  </motion.div>
                </div>

                {/* Progress info */}
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Loading tracks…
                  </p>
                  {progress.total > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {progress.loaded} / {progress.total}
                    </p>
                  )}
                </div>

                {/* Progress bar */}
                {progress.total > 0 && (
                  <Progress value={progressPercent} className="h-1.5" />
                )}

                {/* Skeleton rows */}
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-3/4 rounded" />
                        <Skeleton className="h-2.5 w-1/2 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Step: Preview ────────────────────────────────────────────── */}
            {step === "preview" && playlist && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col"
                data-ocid="import.preview.panel"
              >
                {/* Playlist header */}
                <div className="px-5 py-4 flex items-center gap-4 border-b border-border/50">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-muted">
                    {playlist.thumbnail ? (
                      <img
                        src={playlist.thumbnail}
                        alt={playlist.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ListMusic className="w-7 h-7 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {playlist.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {playlist.tracks.length} track
                      {playlist.tracks.length !== 1 ? "s" : ""} ·{" "}
                      <span
                        className="capitalize"
                        style={{
                          color:
                            playlist.platform === "spotify"
                              ? "#1DB954"
                              : "oklch(0.62 0.24 350)",
                        }}
                      >
                        {playlist.platform}
                      </span>
                    </p>
                    {playlist.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {playlist.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    data-ocid="import.back.button"
                    onClick={handleReset}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted touch-manipulation transition-colors flex-shrink-0"
                    aria-label="Back to URL input"
                  >
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Action buttons */}
                <div className="px-5 py-3 flex gap-2 border-b border-border/50">
                  {saved ? (
                    <div
                      data-ocid="import.success_state"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-vibe-green/10 border border-vibe-green/20"
                    >
                      <CheckCircle2 className="w-4 h-4 text-vibe-green" />
                      <span className="text-sm font-semibold text-vibe-green">
                        Saved to Library!
                      </span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        data-ocid="import.play_all.button"
                        onClick={() => handleSave(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold touch-manipulation active:scale-[0.98] transition-transform"
                        style={{
                          background:
                            "linear-gradient(135deg, oklch(0.58 0.24 293), oklch(0.62 0.24 350))",
                          boxShadow: "0 2px 12px oklch(0.58 0.24 293 / 0.3)",
                        }}
                      >
                        <Play className="w-4 h-4 fill-white" />
                        Play All
                      </button>
                      <button
                        type="button"
                        data-ocid="import.save.button"
                        onClick={() => handleSave(false)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted/60 border border-border text-sm font-semibold text-foreground touch-manipulation active:scale-[0.98] transition-transform"
                      >
                        <ListMusic className="w-4 h-4" />
                        Save to Library
                      </button>
                    </>
                  )}
                </div>

                {/* Track list */}
                <div className="px-4 py-2 space-y-1">
                  {playlist.tracks.slice(0, 30).map((track, idx) => (
                    <div
                      key={`${track.id}-${idx}`}
                      data-ocid={`import.track.item.${idx + 1}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-xs text-muted-foreground/60 w-4 text-right flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        {track.thumbnail ? (
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ListMusic className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {track.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {track.channelName}
                        </p>
                      </div>
                    </div>
                  ))}
                  {playlist.tracks.length > 30 && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      + {playlist.tracks.length - 30} more tracks
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
