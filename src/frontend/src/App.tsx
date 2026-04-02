import { Toaster } from "@/components/ui/sonner";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BottomNav } from "./components/BottomNav";
import { MiniPlayer } from "./components/MiniPlayer";
import { useAuth } from "./hooks/useAuth";
import {
  useContinueListening,
  useFavorites,
  usePlaylists,
  useRecentSearches,
} from "./hooks/useLocalStorage";
import { useRelatedTracks } from "./hooks/useRelatedTracks";
import { useUserData } from "./hooks/useUserData";
import { useYouTubePlayer } from "./hooks/useYouTubePlayer";
import { HomeScreen } from "./screens/HomeScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { PlayerScreen } from "./screens/PlayerScreen";
import { SearchScreen } from "./screens/SearchScreen";
import type { RepeatMode, TabName, Track } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabName>("home");
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [pendingSearch, setPendingSearch] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { currentUser, sessionToken, isLoggedIn, login, register, logout } =
    useAuth();

  const player = useYouTubePlayer();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const { recentSearches, addRecentSearch } = useRecentSearches();
  const { continueListening, addToHistory } = useContinueListening();
  const { playlists, createPlaylist, deletePlaylist, addTrackToPlaylist } =
    usePlaylists();
  const { relatedTracks, isLoading: isLoadingRelated } =
    useRelatedTracks(currentTrack);

  // Backend user data
  const userData = useUserData(sessionToken, isLoggedIn);

  useEffect(() => {
    player.onTrackChange((track) => {
      setCurrentTrack(track);
      addToHistory(track);
      userData.cacheTrack(track);
    });
  }, [player.onTrackChange, addToHistory, userData.cacheTrack]);

  useEffect(() => {
    if (currentTrack) {
      player.updateMediaSession(currentTrack);
    }
  }, [currentTrack, player.updateMediaSession]);

  const handlePlay = useCallback(
    (track: Track, queue: Track[] = [track]) => {
      const queueIndex = queue.findIndex((t) => t.id === track.id);
      setCurrentTrack(track);
      addToHistory(track);
      userData.cacheTrack(track);
      player.playTrack(track, queue, queueIndex >= 0 ? queueIndex : 0);
    },
    [player.playTrack, addToHistory, userData.cacheTrack],
  );

  useEffect(() => {
    player.onQueueEmpty(() => {
      if (relatedTracks.length > 0) {
        handlePlay(relatedTracks[0], relatedTracks);
      }
    });
  }, [player.onQueueEmpty, relatedTracks, handlePlay]);

  useEffect(() => {
    if (currentTrack && relatedTracks.length > 0) {
      const idx = relatedTracks.findIndex((t) => t.id === currentTrack.id);
      if (idx !== -1) {
        player.updateQueue(relatedTracks, idx);
      }
    }
  }, [relatedTracks, currentTrack, player.updateQueue]);

  const handleToggleFavorite = useCallback(
    async (track: Track) => {
      if (isLoggedIn) {
        const alreadyLiked = userData.isLiked(track.id);
        await userData.toggleLike(track);
        toast.success(
          alreadyLiked ? "Removed from favorites" : "Added to favorites",
        );
      } else {
        if (isFavorite(track.id)) {
          removeFavorite(track.id);
        } else {
          addFavorite(track);
        }
      }
    },
    [isLoggedIn, userData, isFavorite, addFavorite, removeFavorite],
  );

  const handleIsFavorite = useCallback(
    (trackId: string) => {
      if (isLoggedIn) return userData.isLiked(trackId);
      return isFavorite(trackId);
    },
    [isLoggedIn, userData, isFavorite],
  );

  const handleToggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      player.setShuffle(!prev);
      return !prev;
    });
  }, [player.setShuffle]);

  const handleCycleRepeat = useCallback(() => {
    setRepeat((prev) => {
      const next: RepeatMode =
        prev === "off" ? "all" : prev === "all" ? "one" : "off";
      player.setRepeat(next);
      return next;
    });
  }, [player.setRepeat]);

  const handlePlayRelated = useCallback(
    (track: Track) => {
      handlePlay(track, relatedTracks);
    },
    [handlePlay, relatedTracks],
  );

  const handleAddToPlaylist = useCallback(
    (playlistId: string, track: Track) => {
      addTrackToPlaylist(playlistId, track);
      const playlist = playlists.find((p) => p.id === playlistId);
      toast.success(`Added to ${playlist?.name ?? "playlist"}`);
    },
    [addTrackToPlaylist, playlists],
  );

  const handleShowLogin = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  const handleCloseLogin = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    toast.success("Logged out");
  }, [logout]);

  // Liked tracks list for library: backend video IDs resolved to cached tracks
  const likedTracks = userData.likedVideoIds
    .map(
      (id) =>
        favorites.find((f) => f.id === id) ||
        continueListening.find((t) => t.id === id) ||
        (currentTrack?.id === id ? currentTrack : undefined),
    )
    .filter(Boolean) as Track[];

  return (
    <div
      className="relative flex flex-col bg-background dark"
      style={{
        width: "100%",
        maxWidth: 430,
        height: "100dvh",
        overflow: "hidden",
        margin: "0 auto",
        boxShadow: "0 0 40px rgba(0,0,0,0.6)",
      }}
    >
      {/* Hidden YouTube player container */}
      <div
        ref={player.containerRef}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          top: -9999,
          left: -9999,
          overflow: "hidden",
          zIndex: -1,
        }}
        aria-hidden="true"
      />

      {/* Page Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
              data-ocid="home.page"
            >
              <HomeScreen
                continueListening={continueListening}
                recentSearches={recentSearches}
                currentTrack={currentTrack}
                onPlay={handlePlay}
                onSearch={setPendingSearch}
                onNavigate={(tab) => setActiveTab(tab)}
                username={currentUser?.username}
                isLoggedIn={isLoggedIn}
                onShowLogin={handleShowLogin}
                onLogout={handleLogout}
              />
            </motion.div>
          )}
          {activeTab === "search" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
              data-ocid="search.page"
            >
              <SearchScreen
                initialQuery={pendingSearch}
                currentTrack={currentTrack}
                recentSearches={recentSearches}
                favorites={favorites}
                onPlay={handlePlay}
                onAddRecentSearch={(q) => {
                  addRecentSearch(q);
                  setPendingSearch("");
                }}
                onToggleFavorite={handleToggleFavorite}
                isFavorite={handleIsFavorite}
                playlists={playlists}
                onAddToPlaylist={handleAddToPlaylist}
                isLoggedIn={isLoggedIn}
                onShowLogin={handleShowLogin}
              />
            </motion.div>
          )}
          {activeTab === "player" && (
            <motion.div
              key="player"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col min-h-0"
              data-ocid="player.page"
            >
              <PlayerScreen
                track={currentTrack}
                isPlaying={player.isPlaying}
                progress={player.progress}
                currentTime={player.currentTime}
                duration={player.duration}
                volume={player.volume}
                shuffle={shuffle}
                repeat={repeat}
                isFavorite={
                  currentTrack ? handleIsFavorite(currentTrack.id) : false
                }
                relatedTracks={relatedTracks}
                isLoadingRelated={isLoadingRelated}
                onTogglePlay={player.togglePlay}
                onNext={player.playNext}
                onPrev={player.playPrev}
                onSeek={player.seekTo}
                onVolumeChange={player.setVolume}
                onToggleShuffle={handleToggleShuffle}
                onCycleRepeat={handleCycleRepeat}
                onToggleFavorite={() =>
                  currentTrack && handleToggleFavorite(currentTrack)
                }
                onBack={() => setActiveTab("home")}
                onPlayRelated={handlePlayRelated}
              />
            </motion.div>
          )}
          {activeTab === "library" && (
            <motion.div
              key="library"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
              data-ocid="library.page"
            >
              <LibraryScreen
                favorites={favorites}
                playlists={playlists}
                currentTrack={currentTrack}
                onPlay={handlePlay}
                onToggleFavorite={handleToggleFavorite}
                isFavorite={handleIsFavorite}
                onCreatePlaylist={createPlaylist}
                onDeletePlaylist={deletePlaylist}
                onAddToPlaylist={handleAddToPlaylist}
                isLoggedIn={isLoggedIn}
                onShowLogin={handleShowLogin}
                likedTracks={likedTracks}
                backendPlaylists={userData.playlists}
                onCreateBackendPlaylist={userData.createPlaylist}
                onDeleteBackendPlaylist={userData.deletePlaylist}
                onAddToBackendPlaylist={userData.addTrackToPlaylist}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mini Player */}
      <AnimatePresence>
        {currentTrack && activeTab !== "player" && (
          <MiniPlayer
            track={currentTrack}
            isPlaying={player.isPlaying}
            progress={player.progress}
            onTogglePlay={player.togglePlay}
            onNext={player.playNext}
            onExpand={() => setActiveTab("player")}
          />
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== "search") setPendingSearch("");
        }}
        hasActiveTrack={!!currentTrack}
      />

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <LoginScreen
            onClose={handleCloseLogin}
            onLogin={login}
            onRegister={register}
          />
        )}
      </AnimatePresence>

      <Toaster richColors position="top-center" />
    </div>
  );
}
