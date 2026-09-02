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
  const durationRef = useRef(durationMinutes);
  
  // Keep the callback ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);
  
  // Track when duration changes (assessment loaded)
  useEffect(() => {
    durationRef.current = durationMinutes;
  }, [durationMinutes]);
  
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

  const [isRunning, setIsRunning] = useState(false); // Start as false, enable when ready
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

  // Recalculate time when duration changes (assessment loads) - only once
  useEffect(() => {
    if (!enabled || initializedRef.current) return;
    
    // Only recalculate if we don't have a stored value and assessment just loaded
    if (typeof window !== 'undefined' && storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const remaining = parseInt(stored, 10);
        if (!isNaN(remaining)) {
          // Use stored value
          initializedRef.current = true;
          setIsRunning(remaining > 0);
          return;
        }
      }
    }
    
    // Calculate based on start time and actual duration
    if (startTime && durationMinutes > 0) {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      const total = durationMinutes * 60;
      const remaining = Math.max(0, total - elapsed);
      
      setTimeRemaining(remaining);
      initializedRef.current = true;
      setIsRunning(remaining > 0);
    } else if (durationMinutes > 0) {
      // No start time, use full duration
      setTimeRemaining(durationMinutes * 60);
      initializedRef.current = true;
      setIsRunning(true);
    }
  }, [enabled, durationMinutes, startTime, storageKey]);

  // Save to localStorage periodically
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined' && initializedRef.current) {
      localStorage.setItem(storageKey, timeRemaining.toString());
    }
  }, [timeRemaining, storageKey]);

  // Timer countdown
  useEffect(() => {
    if (!isRunning || hasEnded || !enabled) return;

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
