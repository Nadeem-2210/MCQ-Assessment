"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ViolationLog, ViolationType, ProctoringState } from "@/types";

interface UseProctoringOptions {
  onViolation?: (violation: ViolationLog) => void;
  onAutoSubmit?: () => void;
  maxViolations?: number;
  faceDetectionInterval?: number;
}

export function useProctoring(options: UseProctoringOptions = {}) {
  const {
    onViolation,
    onAutoSubmit,
    maxViolations = 5,
    faceDetectionInterval = 3000,
  } = options;

  const [state, setState] = useState<ProctoringState>({
    cameraActive: false,
    micActive: false,
    facesDetected: 1,
    isFullscreen: false,
    tabSwitchCount: 0,
    audioAlerts: 0,
    violations: [],
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const addViolation = useCallback((type: ViolationType, details?: string) => {
    const violation: ViolationLog = {
      type,
      timestamp: new Date().toISOString(),
      details,
    };

    setState(prev => {
      const newViolations = [...prev.violations, violation];
      
      // Check if max violations reached
      if (newViolations.length >= maxViolations && onAutoSubmit) {
        setTimeout(onAutoSubmit, 0);
      }

      return {
        ...prev,
        violations: newViolations,
        tabSwitchCount: type === "tab_switch" ? prev.tabSwitchCount + 1 : prev.tabSwitchCount,
        audioAlerts: type === "audio_alert" ? prev.audioAlerts + 1 : prev.audioAlerts,
      };
    });

    onViolation?.(violation);
  }, [maxViolations, onAutoSubmit, onViolation]);

  // Initialize camera and microphone
  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setState(prev => ({
        ...prev,
        cameraActive: true,
        micActive: true,
      }));

      // Initialize audio analysis
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

    } catch (error) {
      console.error("Failed to initialize media:", error);
    }
  }, []);

  // Request fullscreen
  const requestFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setState(prev => ({ ...prev, isFullscreen: true }));
    } catch (error) {
      console.error("Failed to enter fullscreen:", error);
    }
  }, []);

  // Exit fullscreen
  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, []);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      setState(prev => ({ ...prev, isFullscreen }));

      if (!isFullscreen && state.isFullscreen) {
        addViolation("fullscreen_exit", "User exited fullscreen mode");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [addViolation, state.isFullscreen]);

  // Visibility change (tab switch) handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addViolation("tab_switch", "User switched tabs or minimized window");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [addViolation]);

  // Prevent copy/paste
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      addViolation("copy_attempt", "User attempted to copy content");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addViolation("paste_attempt", "User attempted to paste content");
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addViolation("right_click", "User attempted right-click");
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [addViolation]);

  // Audio monitoring
  useEffect(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let audioAlertCooldown = false;

    const checkAudio = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

      // High volume threshold (adjust as needed)
      if (average > 100 && !audioAlertCooldown) {
        addViolation("audio_alert", `High audio level detected: ${Math.round(average)}`);
        audioAlertCooldown = true;
        setTimeout(() => { audioAlertCooldown = false; }, 10000); // 10s cooldown
      }
    };

    const interval = setInterval(checkAudio, 1000);
    return () => clearInterval(interval);
  }, [addViolation]);

  // Simple face detection check (counts video activity)
  // Note: For production, use face-api.js or TensorFlow.js
  useEffect(() => {
    if (!videoRef.current || !state.cameraActive) return;

    const checkFaces = async () => {
      // Placeholder - in production, use face-api.js
      // For now, just verify camera is active
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        // Camera is working
        setState(prev => ({ ...prev, facesDetected: 1 }));
      }
    };

    const interval = setInterval(checkFaces, faceDetectionInterval);
    return () => clearInterval(interval);
  }, [state.cameraActive, faceDetectionInterval]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Keyboard shortcuts prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent common shortcuts
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'p')) ||
        (e.key === 'F12') ||
        (e.ctrlKey && e.shiftKey && e.key === 'I')
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    state,
    videoRef,
    initializeMedia,
    requestFullscreen,
    exitFullscreen,
    addViolation,
  };
}
