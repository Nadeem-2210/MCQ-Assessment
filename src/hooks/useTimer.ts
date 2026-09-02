"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTimerOptions {
  durationMinutes: number;
  startTime?: string;
  onTimeUp?: () => void;
  storageKey?: string;
  enabled?: boolean; // New: only start timer when enabled
}

export function useTimer(options: UseTimerOptions) {
  const { durationMinutes, startTime, onTimeUp, storageKey, enabled = true } = options;
  
  // Ref to track if onTimeUp was already called to prevent duplicates
  const timeUpCalledRef = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  const initializedRef = useRef(false);
  
  // Keep the callback ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);
  
  // Calculate initial time remaining
  const calculateTimeRemaining = useCallback(() => {
    if (startTime && durationMinutes > 0) {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      const total = durationMinutes * 60;
      return Math.max(0, total - elapsed);
    }
    return durationMinutes * 60;
  }, [startTime, durationMinutes]);
  
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    // Start with full duration, will be recalculated when enabled
    return durationMinutes * 60;
  });

  const [isRunning, setIsRunning] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  // Initialize timer when enabled and duration/startTime are set
  useEffect(() => {
    if (!enabled || initializedRef.current) return;
    if (durationMinutes <= 0) return;
    
    const remaining = calculateTimeRemaining();
    setTimeRemaining(remaining);
    initializedRef.current = true;
    
    if (remaining <= 0) {
      setHasEnded(true);
      setIsRunning(false);
    } else {
      setIsRunning(true);
    }
  }, [enabled, durationMinutes, startTime, calculateTimeRemaining]);

  // Timer countdown
  useEffect(() => {
    if (!isRunning || hasEnded || !enabled || !initializedRef.current) return;

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
  }, [isRunning, hasEnded, enabled]);

  // Check if time already ended on mount (for page refresh scenarios)
  useEffect(() => {
    if (timeRemaining === 0 && !timeUpCalledRef.current && !hasEnded && enabled && initializedRef.current) {
      timeUpCalledRef.current = true;
      setHasEnded(true);
      setIsRunning(false);
      setTimeout(() => {
        onTimeUpRef.current?.();
      }, 0);
    }
  }, [enabled, hasEnded, timeRemaining]);

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
