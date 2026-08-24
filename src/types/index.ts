// Database types
export interface Admin {
  id: string;
  email: string;
  created_at: string;
}

export interface Assessment {
  id: string;
  admin_id: string;
  name: string;
  duration_minutes: number;
  num_questions: number;
  is_active: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  assessment_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  order_index: number;
}

export interface Attempt {
  id: string;
  assessment_id: string;
  trainee_name: string;
  trainee_email: string;
  score: number | null;
  total_questions: number;
  started_at: string;
  submitted_at: string | null;
  violations: ViolationLog[];
  status: 'in_progress' | 'submitted' | 'auto_submitted';
}

export interface Response {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_answer: 'A' | 'B' | 'C' | 'D' | null;
  is_correct: boolean | null;
}

// Proctoring types
export type ViolationType = 
  | 'tab_switch' 
  | 'fullscreen_exit' 
  | 'multiple_faces' 
  | 'no_face' 
  | 'audio_alert'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'right_click'
  | 'phone_detected';

export interface ViolationLog {
  type: ViolationType;
  timestamp: string;
  details?: string;
}

export interface ProctoringState {
  cameraActive: boolean;
  micActive: boolean;
  facesDetected: number;
  isFullscreen: boolean;
  tabSwitchCount: number;
  audioAlerts: number;
  violations: ViolationLog[];
}

// Excel parsing types
export interface ParsedQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
}

// Form types
export interface AssessmentFormData {
  name: string;
  duration_minutes: number;
  num_questions: number;
}

export interface TraineeRegistration {
  name: string;
  email: string;
}

// Exam state
export interface ExamState {
  currentQuestionIndex: number;
  answers: Record<string, 'A' | 'B' | 'C' | 'D' | null>;
  timeRemaining: number;
  isSubmitted: boolean;
}
