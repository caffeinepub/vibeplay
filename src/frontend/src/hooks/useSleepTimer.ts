/**
 * Sleep Timer hook — auto-pauses playback after a set duration.
 * Timer state is persisted in sessionStorage (resets on browser close).
 */
import { useCallback, useEffect, useRef, useState } from "react";

const SS_KEY = "vp_sleep_timer";

interface SleepTimerState {
  endsAt: number; // epoch ms when timer fires
}

function readSession(): SleepTimerState | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SleepTimerState;
  } catch {
    return null;
  }
}

function writeSession(state: SleepTimerState | null) {
  try {
    if (!state) {
      sessionStorage.removeItem(SS_KEY);
    } else {
      sessionStorage.setItem(SS_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore
  }
}

export function useSleepTimer(onTimerEnd: () => void) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimerEndRef = useRef(onTimerEnd);

  // Keep callback ref fresh
  useEffect(() => {
    onTimerEndRef.current = onTimerEnd;
  }, [onTimerEnd]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cancelTimer = useCallback(() => {
    stopInterval();
    setIsActive(false);
    setRemainingSeconds(0);
    writeSession(null);
  }, [stopInterval]);

  const startCountdown = useCallback(
    (endsAt: number) => {
      stopInterval();
      const tick = () => {
        const remaining = Math.round((endsAt - Date.now()) / 1000);
        if (remaining <= 0) {
          stopInterval();
          setRemainingSeconds(0);
          setIsActive(false);
          writeSession(null);
          onTimerEndRef.current();
          return;
        }
        setRemainingSeconds(remaining);
      };
      tick(); // immediate first tick
      intervalRef.current = setInterval(tick, 1000);
    },
    [stopInterval],
  );

  // Restore timer from sessionStorage on mount
  useEffect(() => {
    const saved = readSession();
    if (saved && saved.endsAt > Date.now()) {
      setIsActive(true);
      setRemainingSeconds(Math.round((saved.endsAt - Date.now()) / 1000));
      startCountdown(saved.endsAt);
    }
    return stopInterval;
  }, [startCountdown, stopInterval]);

  const setTimer = useCallback(
    (minutes: number) => {
      if (minutes <= 0) {
        cancelTimer();
        return;
      }
      const endsAt = Date.now() + minutes * 60 * 1000;
      writeSession({ endsAt });
      setIsActive(true);
      startCountdown(endsAt);
    },
    [cancelTimer, startCountdown],
  );

  /** Format remaining time as mm:ss */
  const formattedRemaining = (() => {
    if (!isActive || remainingSeconds <= 0) return null;
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  })();

  return {
    setTimer,
    cancelTimer,
    remainingSeconds,
    isActive,
    formattedRemaining,
  };
}
