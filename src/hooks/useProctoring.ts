"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ViolationLog, ViolationType, ProctoringState } from "@/types";
import { FEATURES } from "@/config/features";

interface UseProctoringOptions {
  onViolation?: (violation: ViolationLog) => void;
  onAutoSubmit?: () => void;
  onSeriousViolation?: (violation: ViolationLog) => void;
  maxViolations?: number;
}

// Violation severity classification
export type ViolationSeverity = 'normal' | 'warning' | 'serious';

export interface ViolationStatus {
  severity: ViolationSeverity;
  message: string;
  type: ViolationType | null;
  timestamp: number;
}

// Define which violations are serious vs warning
const SERIOUS_VIOLATIONS: ViolationType[] = ['multiple_faces', 'phone_detected'];
const WARNING_VIOLATIONS: ViolationType[] = ['no_face', 'audio_alert', 'fullscreen_exit'];
const MINOR_VIOLATIONS: ViolationType[] = ['tab_switch', 'copy_attempt', 'paste_attempt', 'right_click'];

// Thresholds for escalating to serious
const VIOLATION_ESCALATION_CONFIG = {
  // Number of same-type violations before escalating to serious popup
  escalationThreshold: 3,
  // Time window for counting repeated violations (ms)
  escalationWindowMs: 60000, // 1 minute
  // Cooldown before showing another serious popup (ms)
  seriousPopupCooldownMs: 30000, // 30 seconds
  // Cooldown for updating the status message below camera (ms)
  statusMessageCooldownMs: 3000, // 3 seconds
};

// Mobile phone detection configuration - Improved for reliable detection
const PHONE_DETECTION_CONFIG = {
  // Color ranges for common phone colors (in RGB) - Extended for better coverage
  phoneColors: [
    // Black phones (most common) - widened range
    { rMin: 0, rMax: 70, gMin: 0, gMax: 70, bMin: 0, bMax: 70 },
    // Dark gray phones
    { rMin: 35, rMax: 100, gMin: 35, gMax: 100, bMin: 35, bMax: 100 },
    // White/silver phones
    { rMin: 190, rMax: 255, gMin: 190, gMax: 255, bMin: 190, bMax: 255 },
    // Rose gold / gold phones
    { rMin: 180, rMax: 255, gMin: 140, gMax: 200, bMin: 120, bMax: 180 },
    // Blue phones
    { rMin: 20, rMax: 80, gMin: 40, gMax: 120, bMin: 100, bMax: 180 },
    // Reflective/shiny (phone screen reflection)
    { rMin: 200, rMax: 255, gMin: 200, gMax: 255, bMin: 220, bMax: 255 },
  ],
  // Detection area - focus on where hands would hold a phone
  detectionZone: {
    xMin: 0.1,  // 10% from left
    xMax: 0.9,  // 90% from left  
    yMin: 0.2,  // 20% from top (below face)
    yMax: 0.85, // 85% from top
  },
  minPhonePixelRatio: 0.004, // Lower threshold to catch more phones
  minAspectRatio: 1.3, // Slightly lower for phones held at angles
  maxAspectRatio: 3.5, // Higher to catch landscape orientation
  minPhoneSize: 15, // Lower minimum for phones held further away
  maxPhoneSize: 200, // Higher max for phones held close
  detectionThreshold: 2, // Reduced from 3 - faster detection
  cooldownMs: 12000, // 12 second cooldown between phone violations
  // Edge detection for phone outline
  edgeThreshold: 30, // Minimum edge contrast
  minEdgeRatio: 0.15, // Minimum ratio of edge pixels in cluster
  // Confidence scoring
  minConfidenceScore: 0.6, // Minimum confidence to trigger violation
};

// Voice detection configuration - Improved to reduce false positives
const VOICE_DETECTION_CONFIG = {
  // Volume thresholds (0-255 scale) - Increased to reduce sensitivity
  ambientNoiseBaseline: 30, // Higher expected ambient noise level
  speechThreshold: 65, // Higher threshold - only clear speech triggers
  loudNoiseThreshold: 85, // Much louder sounds needed
  
  // Duration requirements (in check intervals, each ~500ms) - Increased
  minSpeechDuration: 8, // Must be sustained for 4+ seconds (8 * 500ms)
  cooldownChecks: 30, // 15 seconds cooldown (30 * 500ms)
  
  // Speech frequency analysis
  speechFreqStart: 100, // Hz - start of human speech range (raised from 85)
  speechFreqEnd: 2500, // Hz - end of human speech range (lowered from 3000)
  speechBinThreshold: 70, // Higher threshold for speech frequency bins
  
  // Noise filtering - More aggressive
  maxSuddenSpike: 60, // Lower threshold - ignore more sudden spikes
  adaptiveBaselineWeight: 0.01, // Slower baseline adaptation
  
  // Additional filters
  minConsistentBins: 4, // Minimum speech-range bins that must be active
  volumeVarianceThreshold: 15, // Speech has consistent volume, noise varies
  maxVolumeForBaseline: 50, // Don't include loud sounds in baseline calculation
};

export function useProctoring(options: UseProctoringOptions = {}) {
  // Check if proctoring is disabled via feature flag
  const isProctoringEnabled = FEATURES.PROCTORING_ENABLED;

  const {
    onViolation,
    onAutoSubmit,
    onSeriousViolation,
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
  
  // New: Current violation status for UI display
  const [currentViolationStatus, setCurrentViolationStatus] = useState<ViolationStatus>({
    severity: 'normal',
    message: '',
    type: null,
    timestamp: 0,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Tracking refs
  const lastViolationTimeRef = useRef<Record<string, number>>({});
  const noFaceCountRef = useRef<number>(0);
  const multipleFaceCountRef = useRef<number>(0);
  const phoneDetectionCountRef = useRef<number>(0);
  const lastPhoneDetectionTimeRef = useRef<number>(0);
  
  // Audio tracking - improved
  const audioBaselineRef = useRef<number>(VOICE_DETECTION_CONFIG.ambientNoiseBaseline);
  const consecutiveSpeechRef = useRef<number>(0);
  const audioCooldownRef = useRef<number>(0);
  const lastAudioLevelRef = useRef<number>(0);
  const audioHistoryRef = useRef<number[]>([]);
  
  // New: Violation tracking for escalation
  const violationHistoryRef = useRef<{ type: ViolationType; timestamp: number }[]>([]);
  const lastSeriousPopupTimeRef = useRef<number>(0);
  const lastStatusUpdateTimeRef = useRef<number>(0);

  // Determine violation severity
  const getViolationSeverity = useCallback((type: ViolationType): ViolationSeverity => {
    if (!isProctoringEnabled) return 'normal';
    if (SERIOUS_VIOLATIONS.includes(type)) return 'serious';
    if (WARNING_VIOLATIONS.includes(type)) return 'warning';
    return 'normal';
  }, [isProctoringEnabled]);

  // Check if violation should escalate to serious popup
  const shouldShowSeriousPopup = useCallback((type: ViolationType): boolean => {
    // Never show serious popup if proctoring is disabled
    if (!isProctoringEnabled) return false;
    
    const now = Date.now();
    const config = VIOLATION_ESCALATION_CONFIG;
    
    // Always show for inherently serious violations (multiple faces, phone)
    if (SERIOUS_VIOLATIONS.includes(type)) {
      // But still respect cooldown
      if (now - lastSeriousPopupTimeRef.current < config.seriousPopupCooldownMs) {
        return false;
      }
      return true;
    }
    
    // Check for escalation based on repeated violations
    const recentViolations = violationHistoryRef.current.filter(
      v => v.type === type && now - v.timestamp < config.escalationWindowMs
    );
    
    if (recentViolations.length >= config.escalationThreshold) {
      if (now - lastSeriousPopupTimeRef.current < config.seriousPopupCooldownMs) {
        return false;
      }
      return true;
    }
    
    return false;
  }, []);

  // Update the status message below camera
  const updateViolationStatus = useCallback((type: ViolationType, message: string) => {
    // Don't update violation status if proctoring is disabled
    if (!isProctoringEnabled) return;
    
    const now = Date.now();
    const config = VIOLATION_ESCALATION_CONFIG;
    
    // Debounce status updates
    if (now - lastStatusUpdateTimeRef.current < config.statusMessageCooldownMs) {
      return;
    }
    
    const severity = getViolationSeverity(type);
    
    setCurrentViolationStatus({
      severity,
      message,
      type,
      timestamp: now,
    });
    
    lastStatusUpdateTimeRef.current = now;
    
    // Auto-clear status after some time for minor violations
    if (severity === 'normal') {
      setTimeout(() => {
        setCurrentViolationStatus(prev => {
          if (prev.timestamp === now) {
            return { severity: 'normal', message: '', type: null, timestamp: 0 };
          }
          return prev;
        });
      }, 5000);
    }
  }, [getViolationSeverity]);

  // Clear violation status when condition resolves
  const clearViolationStatus = useCallback(() => {
    setCurrentViolationStatus({
      severity: 'normal',
      message: '',
      type: null,
      timestamp: 0,
    });
  }, []);

  const addViolation = useCallback((type: ViolationType, details?: string) => {
    // Don't add violations if proctoring is disabled
    if (!isProctoringEnabled) return;
    
    // Cooldown: prevent same violation type within 8 seconds
    const now = Date.now();
    const lastTime = lastViolationTimeRef.current[type] || 0;
    if (now - lastTime < 8000) {
      return;
    }
    lastViolationTimeRef.current[type] = now;

    // Track violation for escalation logic
    violationHistoryRef.current.push({ type, timestamp: now });
    // Clean old violations from history
    violationHistoryRef.current = violationHistoryRef.current.filter(
      v => now - v.timestamp < VIOLATION_ESCALATION_CONFIG.escalationWindowMs
    );

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

    // Update status message below camera (always for warnings)
    const statusMessage = details || type.replace(/_/g, ' ');
    updateViolationStatus(type, statusMessage);

    // Check if serious popup should be shown
    if (shouldShowSeriousPopup(type)) {
      lastSeriousPopupTimeRef.current = now;
      onSeriousViolation?.(violation);
    }

    // Always call onViolation for logging purposes
    onViolation?.(violation);
  }, [maxViolations, onAutoSubmit, onViolation, onSeriousViolation, shouldShowSeriousPopup, updateViolationStatus]);

  // Initialize camera and microphone
  const initializeMedia = useCallback(async () => {
    // Don't initialize media if proctoring is disabled
    if (!isProctoringEnabled) {
      console.log("Proctoring disabled - skipping camera/microphone initialization");
      return true;
    }
    
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

  // Camera monitoring - face detection and mobile phone detection
  useEffect(() => {
    // Skip camera monitoring if proctoring is disabled
    if (!isProctoringEnabled) return;
    if (!videoRef.current || !canvasRef.current || !state.cameraActive) return;

    const detectFaceAndPhone = () => {
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

      // Detect skin-colored pixels for face detection
      const skinPixels: { x: number; y: number }[] = [];
      // Detect phone-like pixels (dark rectangular objects)
      const phonePixels: { x: number; y: number }[] = [];
      
      for (let y = 0; y < canvas.height; y += 3) {
        for (let x = 0; x < canvas.width; x += 3) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          if (isSkinColor(r, g, b)) {
            skinPixels.push({ x, y });
          }
          
          // Check for phone-like colors (avoid skin area)
          if (isPhoneColor(r, g, b) && !isSkinColor(r, g, b)) {
            phonePixels.push({ x, y });
          }
        }
      }

      const skinRatio = skinPixels.length / (totalPixels / 9);

      // Find face regions using clustering
      const faceClusters = findFaceClusters(skinPixels, canvas.width, canvas.height);
      
      // Phone detection - look for rectangular dark/metallic objects
      const now = Date.now();
      const phoneDetected = detectMobilePhone(phonePixels, skinPixels, canvas.width, canvas.height);
      
      if (phoneDetected) {
        phoneDetectionCountRef.current++;
        
        // Only trigger if detected consistently and cooldown has passed
        if (phoneDetectionCountRef.current >= PHONE_DETECTION_CONFIG.detectionThreshold) {
          if (now - lastPhoneDetectionTimeRef.current > PHONE_DETECTION_CONFIG.cooldownMs) {
            addViolation("phone_detected", "Mobile phone detected - electronic devices are not allowed");
            lastPhoneDetectionTimeRef.current = now;
          }
          phoneDetectionCountRef.current = 0;
        }
      } else {
        // Decay the counter if no phone detected
        phoneDetectionCountRef.current = Math.max(0, phoneDetectionCountRef.current - 1);
      }
      
      // Determine face status
      if (skinRatio < 0.015 || faceClusters.length === 0) {
        // No face detected
        noFaceCountRef.current++;
        multipleFaceCountRef.current = 0;
        
        if (noFaceCountRef.current >= 2) {
          setFaceStatus('not_detected');
          addViolation("no_face", "No face detected - please stay in frame");
          noFaceCountRef.current = 0;
        } else {
          // Update status without creating violation (just warning)
          setFaceStatus('not_detected');
          updateViolationStatus('no_face', 'Face not detected - please stay visible');
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
        } else {
          setFaceStatus('multiple');
          updateViolationStatus('multiple_faces', 'Multiple faces detected');
        }
        
        setState(prev => ({ ...prev, facesDetected: faceClusters.length }));
      } else {
        // Single face detected - all good
        noFaceCountRef.current = 0;
        multipleFaceCountRef.current = 0;
        setFaceStatus('detected');
        // Clear warning status when face is properly detected
        if (currentViolationStatus.type === 'no_face' || currentViolationStatus.type === 'multiple_faces') {
          clearViolationStatus();
        }
        setState(prev => ({ ...prev, facesDetected: 1 }));
      }
    };

    const interval = setInterval(detectFaceAndPhone, 1500);
    return () => clearInterval(interval);
  }, [state.cameraActive, addViolation, updateViolationStatus, clearViolationStatus, currentViolationStatus.type]);

  // Audio monitoring - improved voice detection with better noise handling
  useEffect(() => {
    // Skip audio monitoring if proctoring is disabled
    if (!isProctoringEnabled) return;
    if (!analyserRef.current || !state.micActive) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const config = VOICE_DETECTION_CONFIG;

    const checkAudio = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Handle cooldown
      if (audioCooldownRef.current > 0) {
        audioCooldownRef.current--;
        consecutiveSpeechRef.current = 0;
        return;
      }
      
      // Calculate average volume across all frequencies
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avgVolume = sum / dataArray.length;

      // Calculate speech-specific frequencies (100Hz - 2500Hz human voice range)
      let speechSum = 0;
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      const startBin = Math.floor(config.speechFreqStart / (sampleRate / analyser.fftSize));
      const endBin = Math.min(
        Math.floor(config.speechFreqEnd / (sampleRate / analyser.fftSize)),
        dataArray.length
      );
      const speechBinCount = endBin - startBin;
      
      let speechBinsAboveThreshold = 0;
      const speechBinValues: number[] = [];
      for (let i = startBin; i < endBin && i < dataArray.length; i++) {
        speechSum += dataArray[i];
        speechBinValues.push(dataArray[i]);
        if (dataArray[i] > config.speechBinThreshold) {
          speechBinsAboveThreshold++;
        }
      }
      const speechAvg = speechSum / Math.max(1, speechBinCount);
      
      // Calculate volume variance (speech is more consistent than noise)
      let volumeVariance = 0;
      if (speechBinValues.length > 0) {
        const mean = speechBinValues.reduce((a, b) => a + b, 0) / speechBinValues.length;
        volumeVariance = Math.sqrt(
          speechBinValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / speechBinValues.length
        );
      }
      
      // Track audio history for adaptive baseline (only quiet sounds)
      if (avgVolume < config.maxVolumeForBaseline) {
        audioHistoryRef.current.push(avgVolume);
        if (audioHistoryRef.current.length > 30) {
          audioHistoryRef.current.shift();
        }
      }
      
      // Calculate adaptive baseline from recent history (excluding outliers)
      if (audioHistoryRef.current.length >= 15) {
        const sorted = [...audioHistoryRef.current].sort((a, b) => a - b);
        // Use 30th percentile as baseline (ignores spikes better)
        const baselineIndex = Math.floor(sorted.length * 0.3);
        const newBaseline = sorted[baselineIndex];
        // Very slowly adapt baseline
        audioBaselineRef.current = audioBaselineRef.current * (1 - config.adaptiveBaselineWeight) + 
                                   newBaseline * config.adaptiveBaselineWeight;
      }
      
      // Detect sudden spikes (likely environmental noise, not speech)
      const volumeChange = Math.abs(avgVolume - lastAudioLevelRef.current);
      const isSuddenSpike = volumeChange > config.maxSuddenSpike;
      lastAudioLevelRef.current = avgVolume;
      
      if (isSuddenSpike) {
        // Ignore sudden spikes - likely door slam, object drop, keyboard, etc.
        consecutiveSpeechRef.current = Math.max(0, consecutiveSpeechRef.current - 3);
        return;
      }
      
      // Voice detection criteria (all must be true for speech detection):
      // 1. Overall volume significantly above adaptive baseline
      // 2. Speech frequency range is clearly active
      // 3. Multiple speech-range frequency bins are active (characteristic of voice)
      // 4. Volume variance is in speech range (not erratic like noise)
      // 5. Not a very loud sudden noise
      const volumeAboveBaseline = avgVolume > audioBaselineRef.current + 20;
      const speechFrequencyActive = speechAvg > config.speechThreshold;
      const hasVoiceCharacteristics = speechBinsAboveThreshold >= config.minConsistentBins;
      const consistentVolume = volumeVariance < config.volumeVarianceThreshold || volumeVariance > 5; // Some variance expected in speech
      const isLoudSustainedNoise = avgVolume > config.loudNoiseThreshold && speechAvg > config.loudNoiseThreshold;
      
      // Speech is detected when: multiple criteria met
      const speechCriteriaCount = [
        volumeAboveBaseline,
        speechFrequencyActive,
        hasVoiceCharacteristics,
        consistentVolume
      ].filter(Boolean).length;
      
      const isSpeechDetected = speechCriteriaCount >= 3 || isLoudSustainedNoise;

      if (isSpeechDetected) {
        consecutiveSpeechRef.current++;
        
        // Only trigger violation after sustained speech detection (4+ seconds)
        if (consecutiveSpeechRef.current >= config.minSpeechDuration) {
          addViolation("audio_alert", `Sustained voice activity detected`);
          consecutiveSpeechRef.current = 0;
          audioCooldownRef.current = config.cooldownChecks; // Apply 15s cooldown
        }
      } else {
        // Gradually decay the counter (allows for natural speech pauses)
        consecutiveSpeechRef.current = Math.max(0, consecutiveSpeechRef.current - 1);
      }
    };

    const interval = setInterval(checkAudio, 500);
    return () => clearInterval(interval);
  }, [state.micActive, addViolation]);

  // Request fullscreen
  const requestFullscreen = useCallback(async () => {
    // Skip fullscreen requirement if both proctoring and fullscreen are disabled
    if (!isProctoringEnabled && !FEATURES.FULLSCREEN_REQUIRED) {
      console.log("Proctoring and fullscreen disabled - skipping fullscreen request");
      return;
    }
    
    try {
      await document.documentElement.requestFullscreen();
      setState(prev => ({ ...prev, isFullscreen: true }));
    } catch (error) {
      console.error("Failed to enter fullscreen:", error);
    }
  }, [isProctoringEnabled]);

  // Fullscreen change handler
  useEffect(() => {
    // Skip fullscreen monitoring if proctoring is disabled
    if (!isProctoringEnabled) return;
    
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
  }, [addViolation, isProctoringEnabled]);

  // Tab switch detection
  useEffect(() => {
    // Skip tab switch detection if proctoring is disabled
    if (!isProctoringEnabled) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addViolation("tab_switch", "Switched tabs or minimized window");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [addViolation, isProctoringEnabled]);

  // Window blur handler
  useEffect(() => {
    // Skip window blur detection if proctoring is disabled
    if (!isProctoringEnabled) return;
    
    const handleBlur = () => {
      if (state.isFullscreen) {
        addViolation("tab_switch", "Switched to another application");
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [addViolation, state.isFullscreen, isProctoringEnabled]);

  // Prevent copy/paste
  useEffect(() => {
    // Skip copy/paste prevention if proctoring is disabled
    if (!isProctoringEnabled) return;
    
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
  }, [addViolation, isProctoringEnabled]);

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
    currentViolationStatus,
    videoRef,
    initializeMedia,
    requestFullscreen,
    addViolation,
    clearViolationStatus,
    isProctoringEnabled,
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

// Check if a pixel color matches common phone colors
function isPhoneColor(r: number, g: number, b: number): boolean {
  for (const range of PHONE_DETECTION_CONFIG.phoneColors) {
    if (r >= range.rMin && r <= range.rMax &&
        g >= range.gMin && g <= range.gMax &&
        b >= range.bMin && b <= range.bMax) {
      return true;
    }
  }
  return false;
}

// Detect mobile phone from pixel data - Improved algorithm
function detectMobilePhone(
  phonePixels: { x: number; y: number }[],
  skinPixels: { x: number; y: number }[],
  width: number,
  height: number,
  imageData?: Uint8ClampedArray
): boolean {
  if (phonePixels.length < 30) return false;
  
  const config = PHONE_DETECTION_CONFIG;
  const zone = config.detectionZone;
  
  // Filter pixels to detection zone only
  const zonePixels = phonePixels.filter(p => 
    p.x >= width * zone.xMin && p.x <= width * zone.xMax &&
    p.y >= height * zone.yMin && p.y <= height * zone.yMax
  );
  
  if (zonePixels.length < 20) return false;
  
  // Create a skin pixel set for quick lookup
  const skinSet = new Set(skinPixels.map(p => `${p.x},${p.y}`));
  
  // Cluster phone pixels using grid-based approach
  const gridSize = 15; // Smaller grid for better precision
  const grid: Map<string, { x: number; y: number }[]> = new Map();
  
  for (const p of zonePixels) {
    const cellX = Math.floor(p.x / gridSize);
    const cellY = Math.floor(p.y / gridSize);
    const key = `${cellX},${cellY}`;
    
    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key)!.push(p);
  }
  
  // Find rectangular clusters that could be phones
  const visited = new Set<string>();
  
  for (const [key, cellPixels] of grid) {
    if (visited.has(key) || cellPixels.length < 2) continue;
    
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
      
      // Check neighbors (8-connected)
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
    
    // Evaluate cluster as potential phone
    if (cluster.length >= config.minPhoneSize && cluster.length <= config.maxPhoneSize * 3) {
      const confidence = evaluatePhoneCluster(cluster, skinSet, width, height, config);
      if (confidence >= config.minConfidenceScore) {
        return true;
      }
    }
  }
  
  return false;
}

// Evaluate confidence that a cluster is a phone
function evaluatePhoneCluster(
  cluster: { x: number; y: number }[],
  skinSet: Set<string>,
  width: number,
  height: number,
  config: typeof PHONE_DETECTION_CONFIG
): number {
  // Calculate bounding box
  const minX = Math.min(...cluster.map(p => p.x));
  const maxX = Math.max(...cluster.map(p => p.x));
  const minY = Math.min(...cluster.map(p => p.y));
  const maxY = Math.max(...cluster.map(p => p.y));
  
  const clusterWidth = maxX - minX;
  const clusterHeight = maxY - minY;
  
  // Minimum size check
  if (clusterWidth < config.minPhoneSize || clusterHeight < config.minPhoneSize) {
    return 0;
  }
  
  let confidence = 0;
  
  // 1. Aspect ratio check (phones are rectangular)
  const aspectRatio = Math.max(clusterWidth, clusterHeight) / Math.max(1, Math.min(clusterWidth, clusterHeight));
  if (aspectRatio >= config.minAspectRatio && aspectRatio <= config.maxAspectRatio) {
    confidence += 0.25;
  } else if (aspectRatio > 1.1 && aspectRatio < 4.0) {
    // Partial credit for close aspect ratios
    confidence += 0.1;
  }
  
  // 2. Density check (phone should have uniform color fill)
  const boundingArea = clusterWidth * clusterHeight;
  const fillRatio = cluster.length / (boundingArea / 9); // Accounting for sampling
  if (fillRatio > 0.3) {
    confidence += 0.2;
  } else if (fillRatio > 0.15) {
    confidence += 0.1;
  }
  
  // 3. Position check - phones typically appear in certain areas
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const normalizedY = centerY / height;
  
  // More likely in lower-middle area (where hands would be)
  if (normalizedY > 0.3 && normalizedY < 0.8) {
    confidence += 0.15;
  }
  
  // 4. Proximity to skin (hand holding phone)
  let nearSkinCount = 0;
  let overlapSkinCount = 0;
  const checkRadius = 15;
  
  // Sample cluster edges for skin proximity
  const edgePoints = cluster.filter(p => 
    p.x === minX || p.x === maxX || p.y === minY || p.y === maxY ||
    Math.abs(p.x - minX) < 5 || Math.abs(p.x - maxX) < 5 ||
    Math.abs(p.y - minY) < 5 || Math.abs(p.y - maxY) < 5
  );
  
  for (const p of edgePoints) {
    // Check for skin overlap
    if (skinSet.has(`${p.x},${p.y}`)) {
      overlapSkinCount++;
    }
    
    // Check for nearby skin (hand)
    for (let dx = -checkRadius; dx <= checkRadius; dx += 5) {
      for (let dy = -checkRadius; dy <= checkRadius; dy += 5) {
        if (skinSet.has(`${p.x + dx},${p.y + dy}`)) {
          nearSkinCount++;
        }
      }
    }
  }
  
  // Phone should have low skin overlap but some skin nearby (hand)
  const skinOverlapRatio = overlapSkinCount / Math.max(1, edgePoints.length);
  const skinNearbyRatio = nearSkinCount / Math.max(1, edgePoints.length * 20);
  
  if (skinOverlapRatio < 0.3 && skinNearbyRatio > 0.05) {
    confidence += 0.25;
  } else if (skinOverlapRatio < 0.5 && skinNearbyRatio > 0.02) {
    confidence += 0.15;
  }
  
  // 5. Size appropriateness
  const pixelArea = clusterWidth * clusterHeight;
  const frameArea = width * height;
  const sizeRatio = pixelArea / frameArea;
  
  // Phone should be reasonable size (not too small, not too large)
  if (sizeRatio > 0.005 && sizeRatio < 0.15) {
    confidence += 0.15;
  } else if (sizeRatio > 0.002 && sizeRatio < 0.25) {
    confidence += 0.08;
  }
  
  return confidence;
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
