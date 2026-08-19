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
    maxViolations = 10,
    faceDetectionInterval = 2000,
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastFrameBrightnessRef = useRef<number>(128);
  const cameraBlockedCountRef = useRef<number>(0);
  const noiseLevelHistoryRef = useRef<number[]>([]);

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
        setTimeout(onAutoSubmit, 100);
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
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Create canvas for frame analysis
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvasRef.current = canvas;

      setState(prev => ({
        ...prev,
        cameraActive: true,
        micActive: true,
      }));

      // Initialize audio analysis
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      return true;
    } catch (error) {
      console.error("Failed to initialize media:", error);
      return false;
    }
  }, []);

  // Camera monitoring - detect if camera is blocked/covered
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !state.cameraActive) return;

    const checkCamera = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Calculate average brightness
      let totalBrightness = 0;
      let pixelCount = 0;
      
      // Sample every 10th pixel for performance
      for (let i = 0; i < data.length; i += 40) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalBrightness += (r + g + b) / 3;
        pixelCount++;
      }

      const avgBrightness = totalBrightness / pixelCount;

      // Detect if camera is blocked (very dark or very uniform)
      const isVeryDark = avgBrightness < 15;
      
      // Calculate variance to detect uniform image (covered camera)
      let variance = 0;
      for (let i = 0; i < data.length; i += 40) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        variance += Math.pow(brightness - avgBrightness, 2);
      }
      variance = variance / pixelCount;
      
      const isUniform = variance < 50; // Very low variance means uniform/covered

      if (isVeryDark || (isUniform && avgBrightness < 50)) {
        cameraBlockedCountRef.current++;
        
        // Only trigger violation after sustained blocking (3 consecutive checks = 6 seconds)
        if (cameraBlockedCountRef.current >= 3) {
          addViolation("no_face", `Camera appears to be blocked or covered (brightness: ${Math.round(avgBrightness)}, variance: ${Math.round(variance)})`);
          cameraBlockedCountRef.current = 0; // Reset after violation
        }
      } else {
        cameraBlockedCountRef.current = Math.max(0, cameraBlockedCountRef.current - 1);
      }

      // Simple face detection using skin tone detection
      let skinTonePixels = 0;
      let totalSampledPixels = 0;
      
      // Sample center region of the frame
      const startX = Math.floor(canvas.width * 0.2);
      const endX = Math.floor(canvas.width * 0.8);
      const startY = Math.floor(canvas.height * 0.1);
      const endY = Math.floor(canvas.height * 0.9);
      
      for (let y = startY; y < endY; y += 5) {
        for (let x = startX; x < endX; x += 5) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Skin tone detection (works for various skin tones)
          const isSkinTone = (
            r > 60 && r < 255 &&
            g > 40 && g < 230 &&
            b > 20 && b < 200 &&
            r > g && r > b &&
            Math.abs(r - g) > 10 &&
            r - b > 15
          );
          
          if (isSkinTone) skinTonePixels++;
          totalSampledPixels++;
        }
      }

      const skinToneRatio = skinTonePixels / totalSampledPixels;
      
      // Estimate number of faces based on skin tone coverage
      let estimatedFaces = 0;
      if (skinToneRatio > 0.02 && skinToneRatio < 0.35) {
        estimatedFaces = 1; // Normal single face
      } else if (skinToneRatio >= 0.35) {
        estimatedFaces = 2; // Multiple faces or very close to camera
        addViolation("multiple_faces", `Multiple people may be detected (skin coverage: ${(skinToneRatio * 100).toFixed(1)}%)`);
      } else if (skinToneRatio < 0.01 && !isVeryDark) {
        estimatedFaces = 0; // No face detected
        addViolation("no_face", "No face detected in camera frame");
      }

      setState(prev => ({ ...prev, facesDetected: Math.max(estimatedFaces, 0) }));
      lastFrameBrightnessRef.current = avgBrightness;
    };

    const interval = setInterval(checkCamera, faceDetectionInterval);
    return () => clearInterval(interval);
  }, [state.cameraActive, faceDetectionInterval, addViolation]);

  // Audio monitoring - detect talking/noise
  useEffect(() => {
    if (!analyserRef.current || !state.micActive) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let consecutiveHighNoise = 0;

    const checkAudio = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate RMS (root mean square) for better noise detection
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      
      // Keep history of noise levels
      noiseLevelHistoryRef.current.push(rms);
      if (noiseLevelHistoryRef.current.length > 10) {
        noiseLevelHistoryRef.current.shift();
      }
      
      // Calculate average baseline
      const avgNoise = noiseLevelHistoryRef.current.reduce((a, b) => a + b, 0) / noiseLevelHistoryRef.current.length;

      // Detect significant noise above baseline (talking, other people)
      if (rms > 60 && rms > avgNoise * 1.5) {
        consecutiveHighNoise++;
        
        // Trigger violation after sustained noise (2+ seconds)
        if (consecutiveHighNoise >= 4) {
          addViolation("audio_alert", `Significant audio detected (level: ${Math.round(rms)}, baseline: ${Math.round(avgNoise)})`);
          consecutiveHighNoise = 0;
        }
      } else {
        consecutiveHighNoise = Math.max(0, consecutiveHighNoise - 1);
      }
    };

    const interval = setInterval(checkAudio, 500);
    return () => clearInterval(interval);
  }, [state.micActive, addViolation]);

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
      
      setState(prev => {
        if (prev.isFullscreen && !isFullscreen) {
          // Was fullscreen, now exited
          addViolation("fullscreen_exit", "User exited fullscreen mode");
        }
        return { ...prev, isFullscreen };
      });
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [addViolation]);

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

  // Window blur handler (detects switching to other apps)
  useEffect(() => {
    const handleBlur = () => {
      if (document.fullscreenElement) {
        addViolation("tab_switch", "User switched to another application");
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [addViolation]);

  // Prevent copy/paste/right-click
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

  // Keyboard shortcuts prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent common shortcuts
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'p' || e.key === 'a')) ||
        (e.key === 'F12') ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.altKey && e.key === 'Tab')
      ) {
        e.preventDefault();
        addViolation("copy_attempt", `Blocked shortcut: ${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}`);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [addViolation]);

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

  return {
    state,
    videoRef,
    initializeMedia,
    requestFullscreen,
    exitFullscreen,
    addViolation,
  };
}
