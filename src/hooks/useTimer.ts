"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTimerOptions {
  durationMinutes: number;
  startTime?: string;
  onTimeUp?: () => void;
  storageKey?: string;
}

export function useTimer(options: UseTimerOptions) {
  const { durationMinutes, startTime, onTimeUp, storageKey } = options;
  
  // Ref to track if onTimeUp was already called to prevent duplicates
  const timeUpCalledRef = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  
  // Keep the callback ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);
  
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return durationMinutes * 60;
    }
    
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const remaining = parseInt(stored, 10);
        if (!isNaN(remaining) && remaining > 0) {
          return remaining;
        }
        // If stored value is 0 or negative, time is up
        if (!isNaN(remaining) && remaining <= 0) {
          return 0;
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
  const [hasEnded, setHasEnded] = useState(() => {
    // Check if timer already ended on mount
    if (typeof window === 'undefined') return false;
    
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const remaining = parseInt(stored, 10);
        if (!isNaN(remaining) && remaining <= 0) {
          return true;
        }
      }
    }
    return false;
  });

  // Save to localStorage periodically
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, timeRemaining.toString());
    }
  }, [timeRemaining, storageKey]);

  // Timer countdown
  useEffect(() => {
    if (!isRunning || hasEnded) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Timer has ended
          setHasEnded(true);
          setIsRunning(false);
          
          // Trigger callback only once
          if (!timeUpCalledRef.current) {
            timeUpCalledRef.current = true;
            // Use setTimeout to ensure state updates complete first
            setTimeout(() => {
              onTimeUpRef.current?.();
            }, 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, hasEnded]);

  // Check if time already ended on mount (for page refresh scenarios)
  useEffect(() => {
    if (timeRemaining === 0 && !timeUpCalledRef.current && !hasEnded) {
      timeUpCalledRef.current = true;
      setHasEnded(true);
      setIsRunning(false);
      setTimeout(() => {
        onTimeUpRef.current?.();
      }, 0);
    }
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (!hasEnded && !timeUpCalledRef.current) {
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
  const isExpired = hasEnded || timeRemaining === 0;

  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    isRunning,
    hasEnded,
    isWarning,
    isCritical,
    isExpired,
    pause,
    resume,
  };
}
