/**
 * Feature Flags Configuration
 * 
 * This file contains feature flags to enable/disable various features
 * across the application.
 */

export const FEATURES = {
  /**
   * Camera Proctoring Feature Flag
   * 
   * When false, disables camera-based proctoring functionality:
   * - Camera access and preview
   * - Microphone access
   * - Face detection (single, multiple, no face)
   * - Mobile phone detection
   * - Voice/audio detection
   * - Camera-related violation UI elements and popups
   * 
   * Assessment functionality preserved:
   * - Questions and answers
   * - Timer and auto-submit
   * - Manual submit
   * - Navigation
   * - Results
   * - Fullscreen enforcement (controlled separately)
   * - Tab monitoring (controlled separately)
   */
  PROCTORING_ENABLED: false,

  /**
   * Fullscreen Enforcement
   * 
   * When true, requires fullscreen mode during exam.
   * Exiting fullscreen will be logged as a violation.
   * Works independently of camera proctoring.
   */
  FULLSCREEN_REQUIRED: true,

  /**
   * Tab Switch Monitoring
   * 
   * When true, monitors for tab switches and window blur events.
   * Switching tabs or windows will be logged as a violation.
   * Works independently of camera proctoring.
   */
  TAB_MONITORING_ENABLED: true,

  /**
   * Copy/Paste Prevention
   * 
   * When true, prevents copy/paste/right-click during exam.
   * Attempts will be logged as violations.
   * Works independently of camera proctoring.
   */
  COPY_PASTE_PREVENTION: true,
} as const;

export type Features = typeof FEATURES;
