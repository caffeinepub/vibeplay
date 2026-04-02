export interface Track {
  id: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration?: string;
  viewCount?: string;
  tags?: string[];
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
    thumbnails: { medium: { url: string }; high: { url: string } };
    publishedAt: string;
  };
}
