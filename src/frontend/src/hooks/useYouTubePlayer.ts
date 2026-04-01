import { useCallback, useEffect, useRef, useState } from "react";
import type { RepeatMode, Track } from "../types";

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          height: string;
          width: string;
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(vol: number): void;
  getVolume(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

export function useYouTubePlayer() {
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);

  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(0);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>("off");
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const onTrackChangeRef = useRef<((track: Track) => void) | null>(null);
  const onEndRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (window.YT?.Player) {
      setIsApiReady(true);
      return;
    }
    window.onYouTubeIframeAPIReady = () => setIsApiReady(true);
    if (!document.querySelector("script[src*='youtube.com/iframe_api']")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  }, []);

  const initPlayer = useCallback(
    (videoId: string) => {
      if (!isApiReady || !containerRef.current) return;
      const existingIframe = containerRef.current.querySelector("iframe");
      if (existingIframe) existingIframe.remove();

      const el = document.createElement("div");
      el.id = `yt-player-${Date.now()}`;
      containerRef.current.appendChild(el);

      playerRef.current = new window.YT.Player(el.id, {
        height: "1",
        width: "1",
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(volume);
            e.target.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setDuration(playerRef.current?.getDuration() ?? 0);
              if (!progressIntervalRef.current) {
                progressIntervalRef.current = setInterval(() => {
                  setCurrentTime(playerRef.current?.getCurrentTime() ?? 0);
                }, 1000);
              }
            } else if (
              e.data === window.YT.PlayerState.PAUSED ||
              e.data === window.YT.PlayerState.BUFFERING
            ) {
              setIsPlaying(e.data === window.YT.PlayerState.BUFFERING);
            } else if (e.data === window.YT.PlayerState.ENDED) {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
              setIsPlaying(false);
              onEndRef.current?.();
            }
          },
          onError: () => {
            setIsPlaying(false);
            onEndRef.current?.();
          },
        },
      });
    },
    [isApiReady, volume],
  );

  const playTrack = useCallback(
    (track: Track, queue?: Track[], index?: number) => {
      if (queue) {
        queueRef.current = queue;
        queueIndexRef.current = index ?? 0;
      }
      onTrackChangeRef.current?.(track);
      if (playerRef.current) {
        playerRef.current.loadVideoById(track.id);
        setIsPlaying(true);
      } else {
        initPlayer(track.id);
      }
    },
    [initPlayer],
  );

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const playNext = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length === 0) return;
    let nextIndex: number;
    if (shuffleRef.current) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = (queueIndexRef.current + 1) % queue.length;
    }
    queueIndexRef.current = nextIndex;
    const nextTrack = queue[nextIndex];
    onTrackChangeRef.current?.(nextTrack);
    playerRef.current?.loadVideoById(nextTrack.id);
  }, []);

  const playPrev = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length === 0) return;
    let prevIndex = queueIndexRef.current - 1;
    if (prevIndex < 0) prevIndex = queue.length - 1;
    queueIndexRef.current = prevIndex;
    const prevTrack = queue[prevIndex];
    onTrackChangeRef.current?.(prevTrack);
    playerRef.current?.loadVideoById(prevTrack.id);
  }, []);

  const seekTo = useCallback((percent: number) => {
    if (!playerRef.current) return;
    const dur = playerRef.current.getDuration();
    playerRef.current.seekTo((percent / 100) * dur, true);
    setCurrentTime((percent / 100) * dur);
  }, []);

  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    playerRef.current?.setVolume(val);
  }, []);

  const setShuffle = useCallback((val: boolean) => {
    shuffleRef.current = val;
  }, []);

  const setRepeat = useCallback((val: RepeatMode) => {
    repeatRef.current = val;
  }, []);

  const onTrackChange = useCallback((cb: (track: Track) => void) => {
    onTrackChangeRef.current = cb;
  }, []);

  const onEnd = useCallback((cb: () => void) => {
    onEndRef.current = cb;
  }, []);

  useEffect(() => {
    onEndRef.current = () => {
      const queue = queueRef.current;
      if (queue.length === 0) return;
      if (repeatRef.current === "one") {
        playerRef.current?.loadVideoById(queue[queueIndexRef.current].id);
        return;
      }
      let nextIndex = queueIndexRef.current + 1;
      if (nextIndex >= queue.length) {
        if (repeatRef.current === "all") nextIndex = 0;
        else return;
      }
      queueIndexRef.current = nextIndex;
      const nextTrack = queue[nextIndex];
      onTrackChangeRef.current?.(nextTrack);
      playerRef.current?.loadVideoById(nextTrack.id);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return {
    containerRef,
    isApiReady,
    isPlaying,
    currentTime,
    duration,
    progress,
    volume,
    playTrack,
    togglePlay,
    playNext,
    playPrev,
    seekTo,
    setVolume,
    setShuffle,
    setRepeat,
    onTrackChange,
    onEnd,
    queue: queueRef.current,
    queueIndex: queueIndexRef.current,
  };
}
