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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Tracking refs
  const baselineFrameRef = useRef<ImageData | null>(null);
  const frameHistoryRef = useRef<number[]>([]);
  const lastViolationTimeRef = useRef<Record<string, number>>({});
  const audioBaselineRef = useRef<number>(0);
  const audioSamplesRef = useRef<number[]>([]);

  const addViolation = useCallback((type: ViolationType, details?: string) => {
    // Cooldown: prevent same violation type within 10 seconds
    const now = Date.now();
    const lastTime = lastViolationTimeRef.current[type] || 0;
    if (now - lastTime < 10000) {
      return; // Skip if same violation within 10 seconds
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
          echoCancellation: true,
          noiseSuppression: false, // We want to detect noise
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

      // Initialize audio analysis with better settings
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Calibrate audio baseline after 2 seconds
      setTimeout(() => {
        calibrateAudioBaseline();
      }, 2000);

      return true;
    } catch (error) {
      console.error("Failed to initialize media:", error);
      return false;
    }
  }, []);

  // Calibrate audio baseline
  const calibrateAudioBaseline = useCallback(() => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    // Take 5 samples over 1 second
    let samples: number[] = [];
    let count = 0;
    
    const takeSample = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      samples.push(sum / dataArray.length);
      count++;
      
      if (count < 5) {
        setTimeout(takeSample, 200);
      } else {
        // Set baseline as average + small buffer
        audioBaselineRef.current = (samples.reduce((a, b) => a + b, 0) / samples.length) + 10;
        console.log("Audio baseline calibrated:", audioBaselineRef.current);
      }
    };
    
    takeSample();
  }, []);

  // Camera monitoring - improved detection
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !state.cameraActive) return;

    const analyzeFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 1. Calculate overall brightness
      let totalBrightness = 0;
      const pixelCount = data.length / 4;
      
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / pixelCount;

      // 2. Check for camera blocked (very dark)
      if (avgBrightness < 20) {
        addViolation("no_face", "Camera appears to be blocked or covered");
        return;
      }

      // 3. Detect skin tones and estimate face regions
      let skinPixels = 0;
      const skinRegions: { x: number; y: number }[] = [];
      
      for (let y = 0; y < canvas.height; y += 4) {
        for (let x = 0; x < canvas.width; x += 4) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Improved skin tone detection for various skin colors
          const isSkinTone = detectSkinTone(r, g, b);
          
          if (isSkinTone) {
            skinPixels++;
            skinRegions.push({ x, y });
          }
        }
      }

      const totalSampled = (canvas.width / 4) * (canvas.height / 4);
      const skinRatio = skinPixels / totalSampled;

      // 4. Cluster skin regions to detect multiple faces/people
      const clusters = clusterRegions(skinRegions, 40);
      const significantClusters = clusters.filter(c => c.length > 15);

      // Store frame data for motion detection
      frameHistoryRef.current.push(skinRatio);
      if (frameHistoryRef.current.length > 10) {
        frameHistoryRef.current.shift();
      }

      // 5. Detect violations
      
      // No face detected (very low skin coverage)
      if (skinRatio < 0.01 && avgBrightness > 30) {
        addViolation("no_face", "No person detected in camera frame");
      }
      
      // Multiple people detected (multiple significant clusters)
      if (significantClusters.length >= 2) {
        addViolation("multiple_faces", `Multiple people detected (${significantClusters.length} faces/regions)`);
      }
      
      // Large object/phone detection (sudden increase in non-skin area in center)
      if (baselineFrameRef.current) {
        const centerRegion = getCenterRegionStats(data, canvas.width, canvas.height);
        const baselineCenter = getCenterRegionStats(
          baselineFrameRef.current.data, 
          canvas.width, 
          canvas.height
        );
        
        // Detect if something is blocking center (like a phone)
        const brightnessChange = Math.abs(centerRegion.brightness - baselineCenter.brightness);
        const colorChange = centerRegion.colorVariance - baselineCenter.colorVariance;
        
        if (brightnessChange > 50 && colorChange < -20) {
          addViolation("no_face", "Object detected blocking camera (possible phone or device)");
        }
      }

      // Store baseline after first few frames
      if (!baselineFrameRef.current && frameHistoryRef.current.length >= 5) {
        baselineFrameRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }

      // Update state
      setState(prev => ({ 
        ...prev, 
        facesDetected: significantClusters.length || (skinRatio > 0.02 ? 1 : 0)
      }));
    };

    const interval = setInterval(analyzeFrame, 2000);
    return () => clearInterval(interval);
  }, [state.cameraActive, addViolation]);

  // Improved audio monitoring
  useEffect(() => {
    if (!analyserRef.current || !state.micActive) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(analyser.fftSize);
    
    let consecutiveHighNoise = 0;

    const checkAudio = () => {
      // Get frequency data
      analyser.getByteFrequencyData(dataArray);
      // Get time domain data for better voice detection
      analyser.getByteTimeDomainData(timeDataArray);
      
      // Calculate average frequency level
      let freqSum = 0;
      for (let i = 0; i < bufferLength; i++) {
        freqSum += dataArray[i];
      }
      const avgFreq = freqSum / bufferLength;
      
      // Calculate RMS from time domain (better for voice detection)
      let rmsSum = 0;
      for (let i = 0; i < timeDataArray.length; i++) {
        const sample = (timeDataArray[i] - 128) / 128;
        rmsSum += sample * sample;
      }
      const rms = Math.sqrt(rmsSum / timeDataArray.length) * 100;
      
      // Store samples for adaptive threshold
      audioSamplesRef.current.push(rms);
      if (audioSamplesRef.current.length > 50) {
        audioSamplesRef.current.shift();
      }
      
      // Calculate dynamic threshold
      const avgRms = audioSamplesRef.current.reduce((a, b) => a + b, 0) / audioSamplesRef.current.length;
      const threshold = Math.max(audioBaselineRef.current, avgRms * 2, 15);
      
      // Detect voice/noise
      const isLoud = rms > threshold && avgFreq > 20;
      
      // Focus on speech frequencies (300Hz - 3400Hz)
      let speechEnergy = 0;
      const speechStart = Math.floor(300 / (audioContextRef.current?.sampleRate || 44100) * bufferLength * 2);
      const speechEnd = Math.floor(3400 / (audioContextRef.current?.sampleRate || 44100) * bufferLength * 2);
      
      for (let i = speechStart; i < speechEnd && i < bufferLength; i++) {
        speechEnergy += dataArray[i];
      }
      speechEnergy = speechEnergy / (speechEnd - speechStart);
      
      const isSpeech = speechEnergy > 40;

      if (isLoud || isSpeech) {
        consecutiveHighNoise++;
        
        // Trigger after sustained noise (1.5 seconds)
        if (consecutiveHighNoise >= 3) {
          addViolation(
            "audio_alert", 
            `Voice or noise detected (level: ${rms.toFixed(1)}, speech: ${speechEnergy.toFixed(1)})`
          );
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

  // Window blur handler
  useEffect(() => {
    const handleBlur = () => {
      if (state.isFullscreen) {
        addViolation("tab_switch", "User switched to another application");
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [addViolation, state.isFullscreen]);

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
      if (
        (e.ctrlKey && ['c', 'v', 'p', 'a', 'u'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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

// Helper: Detect skin tone for various ethnicities
function detectSkinTone(r: number, g: number, b: number): boolean {
  // Convert to YCbCr color space (better for skin detection)
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  
  // Skin tone ranges in YCbCr
  const isSkinYCbCr = (
    y > 80 &&
    cb > 77 && cb < 127 &&
    cr > 133 && cr < 173
  );
  
  // Also check RGB rules for robustness
  const isSkinRGB = (
    r > 60 && r < 255 &&
    g > 40 && g < 230 &&
    b > 20 && b < 210 &&
    r > g && r > b &&
    Math.abs(r - g) > 10
  );
  
  return isSkinYCbCr || isSkinRGB;
}

// Helper: Cluster nearby regions to detect multiple faces
function clusterRegions(regions: { x: number; y: number }[], threshold: number): { x: number; y: number }[][] {
  if (regions.length === 0) return [];
  
  const clusters: { x: number; y: number }[][] = [];
  const visited = new Set<number>();
  
  for (let i = 0; i < regions.length; i++) {
    if (visited.has(i)) continue;
    
    const cluster: { x: number; y: number }[] = [regions[i]];
    visited.add(i);
    
    for (let j = i + 1; j < regions.length; j++) {
      if (visited.has(j)) continue;
      
      // Check if close to any point in cluster
      const isClose = cluster.some(p => {
        const dx = p.x - regions[j].x;
        const dy = p.y - regions[j].y;
        return Math.sqrt(dx * dx + dy * dy) < threshold;
      });
      
      if (isClose) {
        cluster.push(regions[j]);
        visited.add(j);
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}

// Helper: Get center region statistics
function getCenterRegionStats(data: Uint8ClampedArray, width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const regionSize = 50;
  
  let brightness = 0;
  let colors: number[] = [];
  let count = 0;
  
  for (let y = centerY - regionSize; y < centerY + regionSize; y += 2) {
    for (let x = centerX - regionSize; x < centerX + regionSize; x += 2) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      brightness += (r + g + b) / 3;
      colors.push(r, g, b);
      count++;
    }
  }
  
  const avgBrightness = count > 0 ? brightness / count : 0;
  
  // Calculate color variance
  const avgColor = colors.reduce((a, b) => a + b, 0) / colors.length;
  const variance = colors.reduce((sum, c) => sum + Math.pow(c - avgColor, 2), 0) / colors.length;
  
  return { brightness: avgBrightness, colorVariance: variance };
}
