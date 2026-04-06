export interface Track {
  id: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration?: string;
  viewCount?: string;
  tags?: string[];
  // Spotify/Last.fm enrichment fields
  artist?: string;
  album?: string;
  albumArt?: string;
  source?: "spotify" | "lastfm" | "youtube";
  // Official channel flag
  isOfficial?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
}

export interface BackendPlaylist {
  id: bigint;
  name: string;
  videoIds: string[];
}

export type TabName = "home" | "search" | "player" | "library";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  queueIndex: number;
  progress: number;
  duration: number;
  currentTime: number;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
}

export interface MoodCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  image: string;
  tracks: Track[];
}

export interface YouTubeSearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { medium: { url: string } };
    tags?: string[];
  };
}

export interface RecommendationSection {
  id: string;
  title: string;
  subtitle?: string;
  tracks: Track[];
  isLoading: boolean;
}

export interface BehaviorEvent {
  type: "play" | "skip" | "like" | "unlike" | "search";
  videoId?: string;
  title?: string;
  channelName?: string;
  tags?: string[];
  query?: string;
  timestamp: number;
}

export interface UserPreferences {
  tagScores: Record<string, number>;
  boostedIds: string[];
  downrankedIds: string[];
  interests: string[];
  totalPlays: number;
}
