export interface Track {
  id: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration?: string;
  viewCount?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
}

export type TabName = "home" | "search" | "player" | "library";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  queueIndex: number;
  progress: number; // 0-100
  duration: number; // seconds
  currentTime: number; // seconds
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number; // 0-100
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
