import { Heart, ListMusic, Music2, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { TrackItem } from "../components/TrackItem";
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
}: LibraryScreenProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>("favorites");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) return;
    onCreatePlaylist(newPlaylistName.trim());
    setNewPlaylistName("");
    setShowCreatePlaylist(false);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Your Library</h1>
          {activeTab === "playlists" && (
            <button
              type="button"
              data-ocid="library.create.button"
              onClick={() => setShowCreatePlaylist(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-vibe-green/20 hover:bg-vibe-green/30 touch-manipulation transition-colors"
            >
              <Plus className="w-4 h-4 text-vibe-green" />
            </button>
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
                  Favorites ({favorites.length})
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ListMusic className="w-3.5 h-3.5" />
                  Playlists ({playlists.length})
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
              placeholder="Playlist name…"
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
              {favorites.length === 0 ? (
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
              {playlists.length === 0 ? (
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
                    Tap + to create your first playlist
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {playlists.map((playlist, i) => (
                    <motion.div
                      key={playlist.id}
                      data-ocid={`library.playlist.item.${i + 1}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/50"
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
                        onClick={() => onDeletePlaylist(playlist.id)}
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
    </div>
  );
}
