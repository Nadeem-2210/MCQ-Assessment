"use client";

import { useState, useEffect, useCallback } from "react";

interface UseTimerOptions {
  durationMinutes: number;
  startTime?: string;
  onTimeUp?: () => void;
  storageKey?: string;
}

export function useTimer(options: UseTimerOptions) {
  const { durationMinutes, startTime, onTimeUp, storageKey } = options;
  
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const remaining = parseInt(stored, 10);
        if (!isNaN(remaining) && remaining > 0) {
          return remaining;
        }
      }
    }

    if (startTime) {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      const total = durationMinutes * 60;
      return Math.max(0, total - elapsed);
    }

    return durationMinutes * 60;
  });

  const [isRunning, setIsRunning] = useState(true);
  const [hasEnded, setHasEnded] = useState(false);

  // Save to localStorage periodically
  useEffect(() => {
    if (storageKey && timeRemaining > 0) {
      localStorage.setItem(storageKey, timeRemaining.toString());
    }
  }, [timeRemaining, storageKey]);

  // Timer countdown
  useEffect(() => {
    if (!isRunning || hasEnded) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setHasEnded(true);
          setIsRunning(false);
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, hasEnded, onTimeUp]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (!hasEnded) {
      setIsRunning(true);
    }
  }, [hasEnded]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const isWarning = timeRemaining <= 300 && timeRemaining > 60; // 5 min warning
  const isCritical = timeRemaining <= 60; // 1 min critical

  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    isRunning,
    hasEnded,
    isWarning,
    isCritical,
    pause,
    resume,
  };
}
