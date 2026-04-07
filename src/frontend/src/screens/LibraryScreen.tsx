import {
  ChevronLeft,
  Heart,
  Link2,
  ListMusic,
  Lock,
  Music2,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ImportPlaylistPanel } from "../components/ImportPlaylistPanel";
import { TrackItem } from "../components/TrackItem";
import type { BackendPlaylistWithTracks } from "../hooks/useUserData";
import type { Playlist, Track } from "../types";

interface LibraryScreenProps {
  favorites: Track[];
  playlists: Playlist[];
  currentTrack: Track | null;
  onPlay: (track: Track, queue: Track[]) => void;
  onToggleFavorite: (track: Track) => void;
  isFavorite: (id: string) => boolean;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  // Auth-aware props
  isLoggedIn?: boolean;
  onShowLogin?: () => void;
  // Backend data (when logged in)
  likedTracks?: Track[];
  backendPlaylists?: BackendPlaylistWithTracks[];
  onCreateBackendPlaylist?: (name: string) => void;
  onDeleteBackendPlaylist?: (id: bigint) => void;
  onAddToBackendPlaylist?: (playlistId: bigint, track: Track) => void;
  // Import playlist (login required)
  onImportPlaylist?: (name: string, tracks: Track[]) => Promise<void>;
}

type LibraryTab = "favorites" | "playlists";

export function LibraryScreen({
  favorites,
  playlists,
  currentTrack,
  onPlay,
  onToggleFavorite,
  isFavorite,
  onCreatePlaylist,
  onDeletePlaylist,
  onAddToPlaylist,
  isLoggedIn = false,
  onShowLogin,
  likedTracks,
  backendPlaylists,
  onCreateBackendPlaylist,
  onDeleteBackendPlaylist,
  onAddToBackendPlaylist,
  onImportPlaylist,
}: LibraryScreenProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>("favorites");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<{
    id: string;
    name: string;
    tracks: Track[];
  } | null>(null);

  // Use backend data when logged in, localStorage when guest
  const displayFavorites = isLoggedIn && likedTracks ? likedTracks : favorites;
  const displayPlaylists =
    isLoggedIn && backendPlaylists
      ? backendPlaylists.map((bp) => ({
          id: String(bp.id),
          name: bp.name,
          tracks: bp.tracks,
          createdAt: 0,
        }))
      : playlists;

  // Keep selectedPlaylist in sync when tracks are added/removed
  useEffect(() => {
    if (!selectedPlaylist) return;
    const updated = displayPlaylists.find((p) => p.id === selectedPlaylist.id);
    if (updated) setSelectedPlaylist(updated);
  }, [displayPlaylists, selectedPlaylist]);

  function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) return;
    if (isLoggedIn && onCreateBackendPlaylist) {
      onCreateBackendPlaylist(newPlaylistName.trim());
    } else {
      onCreatePlaylist(newPlaylistName.trim());
    }
    setNewPlaylistName("");
    setShowCreatePlaylist(false);
  }

  function handleDeletePlaylist(id: string) {
    if (isLoggedIn && onDeleteBackendPlaylist && backendPlaylists) {
      const bp = backendPlaylists.find((p) => String(p.id) === id);
      if (bp) onDeleteBackendPlaylist(bp.id);
    } else {
      onDeletePlaylist(id);
    }
    // If we deleted the open playlist, go back to list
    if (selectedPlaylist?.id === id) {
      setSelectedPlaylist(null);
    }
  }

  function handleAddToPlaylist(playlistId: string, track: Track) {
    if (isLoggedIn && onAddToBackendPlaylist && backendPlaylists) {
      const bp = backendPlaylists.find((p) => String(p.id) === playlistId);
      if (bp) onAddToBackendPlaylist(bp.id, track);
    } else if (onAddToPlaylist) {
      onAddToPlaylist(playlistId, track);
    }
  }

  async function handleImportSave(name: string, tracks: Track[]) {
    if (!onImportPlaylist) return;
    setIsImporting(true);
    try {
      await onImportPlaylist(name, tracks);
    } finally {
      setIsImporting(false);
      setShowImportPanel(false);
    }
  }

  // ── Playlist detail view ────────────────────────────────────────────
  if (selectedPlaylist !== null) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-ocid="library.playlist.back.button"
              onClick={() => setSelectedPlaylist(null)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted touch-manipulation transition-colors"
              aria-label="Back to playlists"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">
                {selectedPlaylist.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                {selectedPlaylist.tracks.length} track
                {selectedPlaylist.tracks.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Play All button */}
          {selectedPlaylist.tracks.length > 0 && (
            <button
              type="button"
              data-ocid="library.playlist.play_all.button"
              onClick={() =>
                onPlay(selectedPlaylist.tracks[0], selectedPlaylist.tracks)
              }
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full bg-vibe-green text-black text-sm font-semibold touch-manipulation hover:bg-vibe-green/90 transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              Play All
            </button>
          )}
        </div>

        {/* Track list */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {selectedPlaylist.tracks.length === 0 ? (
            <div
              data-ocid="library.playlist.tracks.empty_state"
              className="flex flex-col items-center justify-center gap-3 py-20"
            >
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <Music2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No songs yet
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Add songs from Search or Favorites
              </p>
            </div>
          ) : (
            <div className="px-2 pb-4 space-y-1">
              {selectedPlaylist.tracks.map((track, i) => (
                <TrackItem
                  key={track.id}
                  track={track}
                  index={i + 1}
                  isPlaying={currentTrack?.id === track.id}
                  isFavorite={isLoggedIn ? true : isFavorite(track.id)}
                  onPlay={(t) => onPlay(t, selectedPlaylist.tracks)}
                  onToggleFavorite={onToggleFavorite}
                  playlists={displayPlaylists}
                  onAddToPlaylist={handleAddToPlaylist}
                  isLoggedIn={isLoggedIn}
                  onShowLogin={onShowLogin}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Your Library</h1>

          {/* Playlists tab action buttons */}
          {activeTab === "playlists" && (
            <div className="flex items-center gap-2">
              {/* Import Playlist — only visible when logged in */}
              {isLoggedIn && (
                <button
                  type="button"
                  data-ocid="library.import.button"
                  onClick={() => setShowImportPanel(true)}
                  disabled={isImporting}
                  title="Import Playlist"
                  className="w-9 h-9 flex items-center justify-center rounded-full touch-manipulation transition-colors"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.58 0.24 293 / 0.2), oklch(0.62 0.24 350 / 0.2))",
                  }}
                >
                  <Link2
                    className="w-4 h-4"
                    style={{ color: "oklch(0.62 0.24 350)" }}
                  />
                </button>
              )}

              {/* Create Playlist */}
              <button
                type="button"
                data-ocid="library.create.button"
                onClick={() => setShowCreatePlaylist(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-vibe-green/20 hover:bg-vibe-green/30 touch-manipulation transition-colors"
              >
                <Plus className="w-4 h-4 text-vibe-green" />
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          {(["favorites", "playlists"] as LibraryTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              data-ocid={`library.${tab}.tab`}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium touch-manipulation transition-all ${
                activeTab === tab
                  ? "bg-vibe-green text-black"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab === "favorites" ? (
                <span className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5" />
                  Favorites ({displayFavorites.length})
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ListMusic className="w-3.5 h-3.5" />
                  Playlists ({displayPlaylists.length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showCreatePlaylist && (
          <motion.div
            data-ocid="library.playlist.dialog"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mb-3 p-4 bg-card rounded-2xl border border-border flex-shrink-0"
          >
            <p className="text-sm font-semibold text-foreground mb-2">
              New Playlist
            </p>
            <input
              data-ocid="library.playlist.input"
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
              placeholder="Playlist name\u2026"
              className="w-full bg-muted/60 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-vibe-green/50 transition-colors"
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                data-ocid="library.playlist.cancel_button"
                onClick={() => {
                  setShowCreatePlaylist(false);
                  setNewPlaylistName("");
                }}
                className="flex-1 py-2 rounded-xl bg-muted/50 text-sm text-muted-foreground touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                data-ocid="library.playlist.confirm_button"
                onClick={handleCreatePlaylist}
                className="flex-1 py-2 rounded-xl bg-vibe-green text-black text-sm font-semibold touch-manipulation"
              >
                Create
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <AnimatePresence mode="wait">
          {activeTab === "favorites" ? (
            <motion.div
              key="favorites"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-2 pb-4"
            >
              {!isLoggedIn ? (
                // Guest gate for favorites
                <div
                  data-ocid="library.favorites.empty_state"
                  className="flex flex-col items-center justify-center gap-4 py-20 px-6"
                >
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <Lock className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground mb-1">
                      Save your favorites
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Log in to like songs and access them anywhere
                    </p>
                  </div>
                  <button
                    type="button"
                    data-ocid="library.login.button"
                    onClick={onShowLogin}
                    className="px-6 py-2.5 rounded-full bg-vibe-green text-black text-sm font-semibold touch-manipulation"
                  >
                    Log In
                  </button>
                  {favorites.length > 0 && (
                    <div className="w-full mt-2">
                      <p className="text-xs text-muted-foreground text-center mb-3">
                        Your local favorites:
                      </p>
                      <div className="space-y-1">
                        {favorites.map((track, i) => (
                          <TrackItem
                            key={track.id}
                            track={track}
                            index={i + 1}
                            isPlaying={currentTrack?.id === track.id}
                            isFavorite={isFavorite(track.id)}
                            onPlay={(t) => onPlay(t, favorites)}
                            onToggleFavorite={onToggleFavorite}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : displayFavorites.length === 0 ? (
                <div
                  data-ocid="library.favorites.empty_state"
                  className="flex flex-col items-center justify-center gap-3 py-20"
                >
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <Heart className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    No favorites yet
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Tap the ♥ on any song to save it here
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {displayFavorites.map((track, i) => (
                    <TrackItem
                      key={track.id}
                      track={track}
                      index={i + 1}
                      isPlaying={currentTrack?.id === track.id}
                      isFavorite={isLoggedIn ? true : isFavorite(track.id)}
                      onPlay={(t) => onPlay(t, displayFavorites)}
                      onToggleFavorite={onToggleFavorite}
                      playlists={displayPlaylists}
                      onAddToPlaylist={handleAddToPlaylist}
                      isLoggedIn={isLoggedIn}
                      onShowLogin={onShowLogin}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="playlists"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pb-4"
            >
              {!isLoggedIn ? (
                // Guest gate for playlists
                <div
                  data-ocid="library.playlists.empty_state"
                  className="flex flex-col items-center justify-center gap-4 py-20 px-6"
                >
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <Lock className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground mb-1">
                      Create playlists
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Log in to organize your music into playlists
                    </p>
                  </div>
                  <button
                    type="button"
                    data-ocid="library.login.button"
                    onClick={onShowLogin}
                    className="px-6 py-2.5 rounded-full bg-vibe-green text-black text-sm font-semibold touch-manipulation"
                  >
                    Log In
                  </button>
                </div>
              ) : displayPlaylists.length === 0 ? (
                <div
                  data-ocid="library.playlists.empty_state"
                  className="flex flex-col items-center justify-center gap-3 py-20"
                >
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <Music2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    No playlists yet
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Tap + to create your first playlist, or 🔗 to import one
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayPlaylists.map((playlist, i) => (
                    <motion.div
                      key={playlist.id}
                      data-ocid={`library.playlist.item.${i + 1}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedPlaylist(playlist)}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 active:scale-[0.98] touch-manipulation transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-vibe-green/20 flex items-center justify-center flex-shrink-0">
                        <ListMusic className="w-6 h-6 text-vibe-green" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {playlist.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {playlist.tracks.length} tracks
                        </p>
                      </div>
                      <button
                        type="button"
                        data-ocid={`library.playlist.delete_button.${i + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlaylist(playlist.id);
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-destructive/20 touch-manipulation transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Import Playlist Panel (bottom sheet overlay) */}
      <AnimatePresence>
        {showImportPanel && (
          <ImportPlaylistPanel
            onClose={() => setShowImportPanel(false)}
            onSave={handleImportSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
