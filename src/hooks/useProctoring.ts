"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ViolationLog, ViolationType, ProctoringState } from "@/types";

interface UseProctoringOptions {
  onViolation?: (violation: ViolationLog) => void;
  onAutoSubmit?: () => void;
  maxViolations?: number;
}

export function useProctoring(options: UseProctoringOptions = {}) {
  const {
    onViolation,
    onAutoSubmit,
    maxViolations = 10,
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

  const [faceStatus, setFaceStatus] = useState<'detected' | 'not_detected' | 'multiple'>('detected');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Tracking refs
  const lastViolationTimeRef = useRef<Record<string, number>>({});
  const noFaceCountRef = useRef<number>(0);
  const multipleFaceCountRef = useRef<number>(0);
  const audioBaselineRef = useRef<number>(20);
  const consecutiveNoiseRef = useRef<number>(0);

  const addViolation = useCallback((type: ViolationType, details?: string) => {
    // Cooldown: prevent same violation type within 8 seconds
    const now = Date.now();
    const lastTime = lastViolationTimeRef.current[type] || 0;
    if (now - lastTime < 8000) {
      return;
    }
    lastViolationTimeRef.current[type] = now;

    const violation: ViolationLog = {
      type,
      timestamp: new Date().toISOString(),
      details,
    };

    setState(prev => {
      const newViolations = [...prev.violations, violation];
      
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
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Create canvas for frame analysis
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
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
      analyser.smoothingTimeConstant = 0.5;
      
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

  // Camera monitoring - face detection
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !state.cameraActive) return;

    const detectFace = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Calculate brightness
      let totalBrightness = 0;
      const totalPixels = canvas.width * canvas.height;
      
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / totalPixels;

      // Camera blocked check
      if (avgBrightness < 15) {
        noFaceCountRef.current++;
        if (noFaceCountRef.current >= 3) {
          setFaceStatus('not_detected');
          addViolation("no_face", "Camera is blocked or covered");
          noFaceCountRef.current = 0;
        }
        return;
      }

      // Detect skin-colored pixels
      const skinPixels: { x: number; y: number }[] = [];
      
      for (let y = 0; y < canvas.height; y += 3) {
        for (let x = 0; x < canvas.width; x += 3) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          if (isSkinColor(r, g, b)) {
            skinPixels.push({ x, y });
          }
        }
      }

      const skinRatio = skinPixels.length / (totalPixels / 9);

      // Find face regions using clustering
      const faceClusters = findFaceClusters(skinPixels, canvas.width, canvas.height);
      
      // Determine face status
      if (skinRatio < 0.015 || faceClusters.length === 0) {
        // No face detected
        noFaceCountRef.current++;
        multipleFaceCountRef.current = 0;
        
        if (noFaceCountRef.current >= 2) {
          setFaceStatus('not_detected');
          addViolation("no_face", "No face detected - please stay in frame");
          noFaceCountRef.current = 0;
        }
        
        setState(prev => ({ ...prev, facesDetected: 0 }));
      } else if (faceClusters.length >= 2) {
        // Multiple faces detected
        noFaceCountRef.current = 0;
        multipleFaceCountRef.current++;
        
        if (multipleFaceCountRef.current >= 2) {
          setFaceStatus('multiple');
          addViolation("multiple_faces", `Multiple people detected (${faceClusters.length} faces)`);
          multipleFaceCountRef.current = 0;
        }
        
        setState(prev => ({ ...prev, facesDetected: faceClusters.length }));
      } else {
        // Single face detected - all good
        noFaceCountRef.current = 0;
        multipleFaceCountRef.current = 0;
        setFaceStatus('detected');
        setState(prev => ({ ...prev, facesDetected: 1 }));
      }
    };

    const interval = setInterval(detectFace, 1500);
    return () => clearInterval(interval);
  }, [state.cameraActive, addViolation]);

  // Audio monitoring
  useEffect(() => {
    if (!analyserRef.current || !state.micActive) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkAudio = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avgVolume = sum / dataArray.length;

      // Focus on speech frequencies (roughly 85Hz - 3000Hz)
      let speechSum = 0;
      const startBin = Math.floor(85 / (44100 / analyser.fftSize));
      const endBin = Math.floor(3000 / (44100 / analyser.fftSize));
      
      for (let i = startBin; i < endBin && i < dataArray.length; i++) {
        speechSum += dataArray[i];
      }
      const speechAvg = speechSum / (endBin - startBin);

      // Detect voice/noise
      const isLoud = avgVolume > 35 || speechAvg > 50;

      if (isLoud) {
        consecutiveNoiseRef.current++;
        
        if (consecutiveNoiseRef.current >= 4) {
          addViolation("audio_alert", `Voice or loud noise detected (level: ${Math.round(avgVolume)})`);
          consecutiveNoiseRef.current = 0;
        }
      } else {
        consecutiveNoiseRef.current = Math.max(0, consecutiveNoiseRef.current - 1);
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

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      
      setState(prev => {
        if (prev.isFullscreen && !isFullscreen) {
          addViolation("fullscreen_exit", "Exited fullscreen mode");
        }
        return { ...prev, isFullscreen };
      });
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [addViolation]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addViolation("tab_switch", "Switched tabs or minimized window");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [addViolation]);

  // Window blur handler
  useEffect(() => {
    const handleBlur = () => {
      if (state.isFullscreen) {
        addViolation("tab_switch", "Switched to another application");
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [addViolation, state.isFullscreen]);

  // Prevent copy/paste
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      addViolation("copy_attempt", "Attempted to copy content");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addViolation("paste_attempt", "Attempted to paste content");
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
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
    faceStatus,
    videoRef,
    initializeMedia,
    requestFullscreen,
    addViolation,
  };
}

// Check if a pixel color is skin-like
function isSkinColor(r: number, g: number, b: number): boolean {
  // YCbCr conversion for better skin detection
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  
  // Skin ranges in YCbCr
  if (y > 80 && cb > 77 && cb < 127 && cr > 133 && cr < 173) {
    return true;
  }
  
  // RGB backup check
  if (r > 60 && g > 40 && b > 20 && r > g && r > b && (r - g) > 10 && (r - b) > 15) {
    return true;
  }
  
  return false;
}

// Find face clusters from skin pixels
function findFaceClusters(pixels: { x: number; y: number }[], width: number, height: number) {
  if (pixels.length < 20) return [];
  
  // Simple grid-based clustering
  const gridSize = 50;
  const grid: Map<string, { x: number; y: number }[]> = new Map();
  
  // Group pixels into grid cells
  for (const p of pixels) {
    const cellX = Math.floor(p.x / gridSize);
    const cellY = Math.floor(p.y / gridSize);
    const key = `${cellX},${cellY}`;
    
    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key)!.push(p);
  }
  
  // Find connected regions
  const visited = new Set<string>();
  const clusters: { x: number; y: number }[][] = [];
  
  for (const [key, cellPixels] of grid) {
    if (visited.has(key) || cellPixels.length < 5) continue;
    
    const cluster: { x: number; y: number }[] = [];
    const queue = [key];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      
      const currentPixels = grid.get(current);
      if (currentPixels) {
        cluster.push(...currentPixels);
      }
      
      // Check neighbors
      const [cx, cy] = current.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const neighborKey = `${cx + dx},${cy + dy}`;
          if (grid.has(neighborKey) && !visited.has(neighborKey)) {
            queue.push(neighborKey);
          }
        }
      }
    }
    
    // Only count as face if cluster is significant and in plausible area
    if (cluster.length >= 30) {
      // Calculate bounding box
      const minX = Math.min(...cluster.map(p => p.x));
      const maxX = Math.max(...cluster.map(p => p.x));
      const minY = Math.min(...cluster.map(p => p.y));
      const maxY = Math.max(...cluster.map(p => p.y));
      
      const clusterWidth = maxX - minX;
      const clusterHeight = maxY - minY;
      
      // Face-like aspect ratio check (height should be >= width for a face)
      if (clusterHeight >= clusterWidth * 0.5 && clusterWidth >= 30 && clusterHeight >= 40) {
        clusters.push(cluster);
      }
    }
  }
  
  return clusters;
}
