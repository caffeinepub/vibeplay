import { Toaster } from "@/components/ui/sonner";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { MiniPlayer } from "./components/MiniPlayer";
import {
  useContinueListening,
  useFavorites,
  usePlaylists,
  useRecentSearches,
} from "./hooks/useLocalStorage";
import { useRelatedTracks } from "./hooks/useRelatedTracks";
import { useYouTubePlayer } from "./hooks/useYouTubePlayer";
import { HomeScreen } from "./screens/HomeScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { PlayerScreen } from "./screens/PlayerScreen";
import { SearchScreen } from "./screens/SearchScreen";
import type { RepeatMode, TabName, Track } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabName>("home");
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [pendingSearch, setPendingSearch] = useState("");

  const player = useYouTubePlayer();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const { recentSearches, addRecentSearch } = useRecentSearches();
  const { continueListening, addToHistory } = useContinueListening();
  const { playlists, createPlaylist, deletePlaylist } = usePlaylists();
  const { relatedTracks, isLoading: isLoadingRelated } =
    useRelatedTracks(currentTrack);

  useEffect(() => {
    player.onTrackChange((track) => {
      setCurrentTrack(track);
      addToHistory(track);
    });
  }, [player.onTrackChange, addToHistory]);

  const handlePlay = useCallback(
    (track: Track, queue: Track[] = [track]) => {
      const queueIndex = queue.findIndex((t) => t.id === track.id);
      setCurrentTrack(track);
      addToHistory(track);
      player.playTrack(track, queue, queueIndex >= 0 ? queueIndex : 0);
    },
    [player.playTrack, addToHistory],
  );

  // Auto-play first related track when queue is exhausted
  useEffect(() => {
    player.onQueueEmpty(() => {
      if (relatedTracks.length > 0) {
        handlePlay(relatedTracks[0], relatedTracks);
      }
    });
  }, [player.onQueueEmpty, relatedTracks, handlePlay]);

  // Keep auto-play queue fresh when relatedTracks updates for the new song
  useEffect(() => {
    if (currentTrack && relatedTracks.length > 0) {
      const idx = relatedTracks.findIndex((t) => t.id === currentTrack.id);
      if (idx !== -1) {
        player.updateQueue(relatedTracks, idx);
      }
    }
  }, [relatedTracks, currentTrack, player.updateQueue]);

  const handleToggleFavorite = useCallback(
    (track: Track) => {
      if (isFavorite(track.id)) {
        removeFavorite(track.id);
      } else {
        addFavorite(track);
      }
    },
    [isFavorite, addFavorite, removeFavorite],
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
                isFavorite={isFavorite}
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
                isFavorite={currentTrack ? isFavorite(currentTrack.id) : false}
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
                isFavorite={isFavorite}
                onCreatePlaylist={createPlaylist}
                onDeletePlaylist={deletePlaylist}
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

      <Toaster richColors position="top-center" />
    </div>
  );
}
