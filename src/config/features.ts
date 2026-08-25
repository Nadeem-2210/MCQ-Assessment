/**
 * Feature Flags Configuration
 * 
 * This file contains feature flags to enable/disable various features
 * across the application.
 */

export const FEATURES = {
  /**
   * Proctoring Feature Flag
   * 
   * When false, disables all proctoring functionality:
   * - Camera access and preview
   * - Microphone access
   * - Face detection (single, multiple, no face)
   * - Mobile phone detection
   * - Voice/audio detection
   * - Violation tracking and logging
   * - Violation UI elements and popups
   * - Fullscreen requirement (optional - can be kept separate)
   * 
   * Assessment functionality preserved:
   * - Questions and answers
   * - Timer and auto-submit
   * - Manual submit
   * - Navigation
   * - Results
   */
  PROCTORING_ENABLED: false,

  /**
   * Fullscreen Requirement
   * 
   * When false, the exam does not require fullscreen mode.
   * This is separate from proctoring so it can be independently controlled.
   */
  FULLSCREEN_REQUIRED: false,
} as const;

export type Features = typeof FEATURES;
