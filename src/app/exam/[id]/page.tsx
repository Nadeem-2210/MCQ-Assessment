"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useProctoring, ViolationStatus } from "@/hooks/useProctoring";
import { useTimer } from "@/hooks/useTimer";
import { Assessment, Question, ViolationLog } from "@/types";
import { FEATURES } from "@/config/features";
import { 
  shuffleQuestionOptions, 
  ShuffledQuestion, 
  mapDisplayAnswerToOriginal,
  OptionKey 
} from "@/lib/option-randomizer";
import { addToast } from "@/components/ui/toast";
import { 
  Clock, ChevronLeft, ChevronRight, AlertTriangle, 
  Camera, Send, Loader2, CheckCircle, Flag, Mic, Timer, Lock,
  Eye, EyeOff, Users, Smartphone, Volume2, XCircle, Save, Keyboard
} from "lucide-react";

export default function ExamPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [shuffledQuestions, setShuffledQuestions] = useState<Map<string, ShuffledQuestion>>(new Map());
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D' | null>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isExamExpired, setIsExamExpired] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'saving' | 'submitting' | 'submitted'>('idle');
  
  // New: Save indicator state
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // New: Serious violation popup state
  const [showSeriousViolationDialog, setShowSeriousViolationDialog] = useState(false);
  const [seriousViolation, setSeriousViolation] = useState<ViolationLog | null>(null);
  
  // Refs to prevent duplicate submissions and race conditions
  const isSubmittingRef = useRef(false);
  const answersRef = useRef(answers);
  const questionsLoadedRef = useRef(false);
  const submitExamRef = useRef<((isAutoSubmit: boolean) => Promise<void>) | null>(null);

  // Keep answers ref updated
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Auto-submit handler - called when timer expires or max violations reached
  const handleAutoSubmit = useCallback(async () => {
    if (isSubmittingRef.current || submissionStatus === 'submitted') {
      return;
    }
    
    // Mark exam as expired to disable further input
    setIsExamExpired(true);
    
    // Wait a short moment for any pending answer saves
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Perform submission with latest answers using ref
    if (submitExamRef.current) {
      submitExamRef.current(true);
    }
  }, [submissionStatus]);

  // Handler for serious violations (shows popup)
  const handleSeriousViolation = useCallback((violation: ViolationLog) => {
    setSeriousViolation(violation);
    setShowSeriousViolationDialog(true);
  }, []);

  // Handler for regular violations (logged but no popup)
  const handleViolation = useCallback((violation: ViolationLog) => {
    // Just log - no popup for regular violations
    console.log('Violation logged:', violation.type, violation.details);
  }, []);

  const { 
    state: proctoringState,
    faceStatus,
    currentViolationStatus,
    videoRef, 
    initializeMedia, 
    requestFullscreen,
    isProctoringEnabled,
  } = useProctoring({
    onViolation: handleViolation,
    onSeriousViolation: handleSeriousViolation,
    onAutoSubmit: handleAutoSubmit,
    maxViolations: 10,
  });

  const { 
    formattedTime, 
    timeRemaining,
    isWarning, 
    isCritical,
    isExpired: timerExpired,
    hasEnded,
  } = useTimer({
    durationMinutes: assessment?.duration_minutes || 30,
    startTime: typeof window !== 'undefined' ? localStorage.getItem(`exam_start_${assessmentId}`) || undefined : undefined,
    onTimeUp: handleAutoSubmit,
    storageKey: `exam_timer_${assessmentId}`,
    enabled: !!assessment && !loading, // Only enable timer after assessment is loaded
  });

  // Effect to handle timer expiration
  useEffect(() => {
    if ((timerExpired || hasEnded) && !isExamExpired && !isSubmittingRef.current && questionsLoadedRef.current) {
      handleAutoSubmit();
    }
  }, [timerExpired, hasEnded, isExamExpired, handleAutoSubmit]);

  useEffect(() => {
    const storedAttemptId = localStorage.getItem(`attempt_${assessmentId}`);
    if (!storedAttemptId) {
      router.push(`/exam/${assessmentId}/register`);
      return;
    }
    setAttemptId(storedAttemptId);
    loadExamData();
    
    // Initialize media and fullscreen after a short delay
    const initTimeout = setTimeout(() => {
      initializeMedia();
      requestFullscreen();
    }, 500);

    // Load saved answers
    const savedAnswers = localStorage.getItem(`exam_answers_${assessmentId}`);
    if (savedAnswers) {
      try {
        setAnswers(JSON.parse(savedAnswers));
      } catch (e) {
        console.error("Failed to parse saved answers", e);
      }
    }

    // Load flagged questions
    const savedFlagged = localStorage.getItem(`exam_flagged_${assessmentId}`);
    if (savedFlagged) {
      try {
        setFlaggedQuestions(new Set(JSON.parse(savedFlagged)));
      } catch (e) {
        console.error("Failed to parse flagged questions", e);
      }
    }

    return () => clearTimeout(initTimeout);
  }, [assessmentId]);

  // Save answers to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(`exam_answers_${assessmentId}`, JSON.stringify(answers));
      
      // Show save indicator
      setShowSaveIndicator(true);
      
      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Hide after 2 seconds
      saveTimeoutRef.current = setTimeout(() => {
        setShowSaveIndicator(false);
      }, 2000);
      
      // Show toast for first save or significant saves
      if (Object.keys(answers).length === 1) {
        addToast("Progress auto-saving enabled", "info");
      }
    }
  }, [answers, assessmentId]);

  // Save flagged questions
  useEffect(() => {
    if (flaggedQuestions.size > 0) {
      localStorage.setItem(`exam_flagged_${assessmentId}`, JSON.stringify([...flaggedQuestions]));
    }
  }, [flaggedQuestions, assessmentId]);

  // Keyboard navigation - 1/2/3/4 or A/B/C/D to select answers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if exam is disabled or user is typing in an input
      if (isExamExpired || submissionStatus !== 'idle') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toUpperCase();
      
      // Map keys to answers
      const keyMap: Record<string, 'A' | 'B' | 'C' | 'D'> = {
        '1': 'A', '2': 'B', '3': 'C', '4': 'D',
        'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D',
      };
      
      if (keyMap[key]) {
        e.preventDefault();
        selectAnswer(keyMap[key]);
        addToast(`Selected option ${keyMap[key]}`, "success");
      }
      
      // Arrow keys for navigation
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        goToQuestion(currentIndex - 1);
      }
      if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
        e.preventDefault();
        goToQuestion(currentIndex + 1);
      }
      
      // F key to toggle flag
      if (key === 'F') {
        e.preventDefault();
        toggleFlag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions.length, isExamExpired, submissionStatus]);

  // Save violations to database periodically
  useEffect(() => {
    if (!attemptId || proctoringState.violations.length === 0) return;

    const saveViolations = async () => {
      const supabase = createClient();
      await supabase
        .from("attempts")
        .update({ violations: proctoringState.violations })
        .eq("id", attemptId);
    };

    const timeout = setTimeout(saveViolations, 3000);
    return () => clearTimeout(timeout);
  }, [attemptId, proctoringState.violations]);

  const loadExamData = async () => {
    const supabase = createClient();
    const storedAttemptId = localStorage.getItem(`attempt_${assessmentId}`);

    const { data: assessmentData } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", assessmentId)
      .single();

    if (!assessmentData) {
      router.push(`/exam/${assessmentId}/register`);
      return;
    }

    setAssessment(assessmentData);

    // Get questions WITHOUT correct_answer for security
    const { data: questionsData } = await supabase
      .from("questions")
      .select("id, assessment_id, question_text, option_a, option_b, option_c, option_d, order_index")
      .eq("assessment_id", assessmentId)
      .order("order_index");

    // Randomize question order for the exam
    const shuffled = [...(questionsData || [])].sort(() => Math.random() - 0.5);
    setQuestions(shuffled as Question[]);
    
    // If randomize_options is enabled, shuffle options for each question
    if (assessmentData.randomize_options && storedAttemptId) {
      const shuffledMap = new Map<string, ShuffledQuestion>();
      shuffled.forEach((q) => {
        const shuffledQ = shuffleQuestionOptions(
          q.id,
          storedAttemptId,
          {
            a: q.option_a,
            b: q.option_b,
            c: q.option_c,
            d: q.option_d,
          }
        );
        shuffledMap.set(q.id, shuffledQ);
      });
      setShuffledQuestions(shuffledMap);
    }
    
    questionsLoadedRef.current = true;
    setLoading(false);
  };

  const selectAnswer = (answer: 'A' | 'B' | 'C' | 'D') => {
    // Prevent answering if exam has expired
    if (isExamExpired || submissionStatus !== 'idle') {
      return;
    }
    
    const questionId = questions[currentIndex]?.id;
    if (questionId) {
      // If options are randomized, map the display answer back to the original
      const shuffledQ = shuffledQuestions.get(questionId);
      const originalAnswer = shuffledQ 
        ? mapDisplayAnswerToOriginal(answer, shuffledQ)
        : answer;
      
      setAnswers(prev => ({ ...prev, [questionId]: originalAnswer }));
    }
  };

  const toggleFlag = () => {
    if (isExamExpired || submissionStatus !== 'idle') return;
    
    const questionId = questions[currentIndex]?.id;
    if (questionId) {
      setFlaggedQuestions(prev => {
        const newSet = new Set(prev);
        if (newSet.has(questionId)) {
          newSet.delete(questionId);
        } else {
          newSet.add(questionId);
        }
        return newSet;
      });
    }
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  };

  const submitExam = async (isAutoSubmit: boolean = false) => {
    // Prevent duplicate submissions with multiple checks
    if (isSubmittingRef.current || submitting || submissionStatus === 'submitted') {
      return;
    }
    
    isSubmittingRef.current = true;
    setSubmitting(true);
    setShowSubmitDialog(false);
    setSubmissionStatus('saving');
    // Use the ref to get the latest answers
    const currentAnswers = answersRef.current;

    try {
      const supabase = createClient();

      // First, save answers to localStorage one final time
      if (Object.keys(currentAnswers).length > 0) {
        localStorage.setItem(`exam_answers_${assessmentId}`, JSON.stringify(currentAnswers));
      }

      setSubmissionStatus('submitting');

      // Get ALL question data including correct answers for scoring
      const { data: questionsWithAnswers, error: questionsError } = await supabase
        .from("questions")
        .select("id, correct_answer")
        .eq("assessment_id", assessmentId);

      if (questionsError) {
        console.error("Error fetching questions:", questionsError);
        throw questionsError;
      }

      if (!questionsWithAnswers || questionsWithAnswers.length === 0) {
        throw new Error("No questions found for scoring");
      }

      // Calculate score using the latest answers
      let score = 0;
      const responses: { 
        attempt_id: string; 
        question_id: string; 
        selected_answer: string | null; 
        is_correct: boolean;
      }[] = [];

      questionsWithAnswers.forEach(q => {
        const selected = currentAnswers[q.id] || null;
        const isCorrect = selected !== null && selected === q.correct_answer;
        if (isCorrect) score++;

        responses.push({
          attempt_id: attemptId!,
          question_id: q.id,
          selected_answer: selected,
          is_correct: isCorrect,
        });
      });

      console.log("Score calculation:", { 
        totalQuestions: questionsWithAnswers.length, 
        answeredQuestions: Object.keys(currentAnswers).length,
        score,
        isAutoSubmit
      });

      // Save responses
      const { error: responsesError } = await supabase
        .from("responses")
        .insert(responses);

      if (responsesError) {
        console.error("Error saving responses:", responsesError);
      }

      // Update attempt with final score and violations
      const { error: updateError } = await supabase
        .from("attempts")
        .update({
          score,
          submitted_at: new Date().toISOString(),
          status: isAutoSubmit ? "auto_submitted" : "submitted",
          violations: proctoringState.violations,
        })
        .eq("id", attemptId);

      if (updateError) {
        console.error("Error updating attempt:", updateError);
        throw updateError;
      }

      setSubmissionStatus('submitted');

      // Clear localStorage
      localStorage.removeItem(`attempt_${assessmentId}`);
      localStorage.removeItem(`exam_start_${assessmentId}`);
      localStorage.removeItem(`exam_timer_${assessmentId}`);
      localStorage.removeItem(`exam_answers_${assessmentId}`);
      localStorage.removeItem(`exam_flagged_${assessmentId}`);

      // Exit fullscreen before redirect
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }

      // Get trainee info for completion page
      const { data: attemptData } = await supabase
        .from("attempts")
        .select("trainee_name, trainee_email")
        .eq("id", attemptId)
        .single();

      // Build completion URL with all info for email/certificate features
      const completionParams = new URLSearchParams({
        score: score.toString(),
        total: questionsWithAnswers.length.toString(),
        violations: proctoringState.violations.length.toString(),
        name: attemptData?.trainee_name || "",
        email: attemptData?.trainee_email || "",
        assessment: assessment?.name || "",
      });

      // Redirect to completion page
      router.push(`/exam/complete?${completionParams.toString()}`);
    } catch (error) {
      console.error("Submit error:", error);
      isSubmittingRef.current = false;
      setSubmitting(false);
      setSubmissionStatus('idle');
    }
  };

  // Keep submitExam ref updated so auto-submit can access latest version
  useEffect(() => {
    submitExamRef.current = submitExam;
  });

  // Get camera frame border color based on status
  const getCameraFrameColor = (status: ViolationStatus, faceStatus: string) => {
    // Serious: red for multiple faces or phone detected
    if (status.severity === 'serious' || faceStatus === 'multiple') {
      return 'border-red-500 shadow-red-500/50 shadow-lg';
    }
    // Warning: orange for no face or other warnings
    if (status.severity === 'warning' || faceStatus === 'not_detected') {
      return 'border-orange-500 shadow-orange-500/30 shadow-md';
    }
    // Normal: default appearance (green outline)
    return 'border-green-500';
  };

  // Get violation icon based on type
  const getViolationIcon = (type: string | null) => {
    switch (type) {
      case 'no_face':
        return <EyeOff className="w-4 h-4" />;
      case 'multiple_faces':
        return <Users className="w-4 h-4" />;
      case 'phone_detected':
        return <Smartphone className="w-4 h-4" />;
      case 'audio_alert':
        return <Volume2 className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const isCurrentFlagged = currentQuestion ? flaggedQuestions.has(currentQuestion.id) : false;
  const answeredCount = Object.values(answers).filter(a => a !== null).length;
  const progress = (answeredCount / questions.length) * 100;
  const isDisabled = isExamExpired || submissionStatus !== 'idle';

  return (
    <div className="min-h-screen bg-gray-100 exam-mode">
      {/* Compact Header - No camera here anymore */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold">K</span>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{assessment?.name}</h1>
                <p className="text-xs text-gray-500">
                  Question {currentIndex + 1} of {questions.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Save Indicator */}
              {showSaveIndicator && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-700 animate-pulse">
                  <Save className="w-4 h-4" />
                  Saved
                </div>
              )}
              
              {/* Keyboard Shortcuts Hint */}
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                <Keyboard className="w-3 h-3" />
                1-4 / A-D to select
              </div>
              
              {/* Violations counter - subtle - Only show if proctoring is enabled */}
              {isProctoringEnabled && proctoringState.violations.length > 0 && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  proctoringState.violations.length >= 7 
                    ? 'bg-red-100 text-red-700' 
                    : proctoringState.violations.length >= 4 
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-600'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                  {proctoringState.violations.length}/10
                </div>
              )}

              {/* Timer Section */}
              <div className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold transition-all duration-300 min-w-[140px] justify-center
                ${isExamExpired || hasEnded
                  ? 'bg-gray-800 text-white border-2 border-gray-600' 
                  : isCritical 
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white animate-pulse border-2 border-red-400 shadow-lg shadow-red-500/50' 
                    : isWarning 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-2 border-amber-400 shadow-lg shadow-amber-500/30' 
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-2 border-blue-400'
                }`}
              >
                {isExamExpired || hasEnded ? (
                  <>
                    <Lock className="w-5 h-5" />
                    <span>Time Up</span>
                  </>
                ) : (
                  <>
                    <Timer className={`w-5 h-5 ${isCritical ? 'animate-bounce' : ''}`} />
                    <span>{formattedTime}</span>
                  </>
                )}
                
                {/* Time indicator bar */}
                {!isExamExpired && !hasEnded && timeRemaining > 0 && (
                  <div className="absolute -bottom-1 left-2 right-2 h-1 bg-white/30 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        isCritical ? 'bg-red-300' : isWarning ? 'bg-amber-300' : 'bg-blue-300'
                      }`}
                      style={{ 
                        width: `${Math.min(100, (timeRemaining / ((assessment?.duration_minutes || 30) * 60)) * 100)}%` 
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Submit Section */}
              <div className="flex items-center">
                {submissionStatus === 'submitted' ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl border-2 border-green-300">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Submitted</span>
                  </div>
                ) : submissionStatus === 'saving' || submissionStatus === 'submitting' ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl border-2 border-blue-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-semibold">
                      {submissionStatus === 'saving' ? 'Saving...' : 'Submitting...'}
                    </span>
                  </div>
                ) : isExamExpired || hasEnded ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl border-2 border-gray-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-semibold">Auto-submitting...</span>
                  </div>
                ) : (
                  <Button 
                    onClick={() => setShowSubmitDialog(true)}
                    disabled={isDisabled}
                    size="lg"
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl border-2 border-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    Submit Exam
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">
                {answeredCount} of {questions.length} answered
              </p>
              {flaggedQuestions.size > 0 && (
                <p className="text-xs text-orange-600">
                  <Flag className="w-3 h-3 inline mr-1" />
                  {flaggedQuestions.size} flagged for review
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content with sidebar */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Question Card - Spans 3 columns */}
          <div className="lg:col-span-3">
            <Card className="shadow-lg">
              <CardContent className="p-6">
                {/* Question Header */}
                <div className="flex items-center justify-between mb-4">
                  <Badge className="text-sm px-3 py-1">Question {currentIndex + 1}</Badge>
                  <Button
                    variant={isCurrentFlagged ? "default" : "outline"}
                    size="sm"
                    onClick={toggleFlag}
                    disabled={isDisabled}
                    className={`${isCurrentFlagged ? "bg-orange-500 hover:bg-orange-600" : ""} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Flag className={`w-4 h-4 mr-1 ${isCurrentFlagged ? 'fill-white' : ''}`} />
                    {isCurrentFlagged ? "Flagged" : "Flag for Review"}
                  </Button>
                </div>

                {/* Question */}
                <div className="mb-6">
                  <h2 className="text-xl font-medium text-gray-900 leading-relaxed">
                    {currentQuestion?.question_text}
                  </h2>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  {(() => {
                    // Get shuffled options if available, otherwise use original
                    const shuffledQ = currentQuestion ? shuffledQuestions.get(currentQuestion.id) : null;
                    const displayOptions = shuffledQ 
                      ? shuffledQ.options.map(opt => ({
                          key: opt.key,
                          text: opt.text,
                          originalKey: opt.originalKey,
                        }))
                      : (['A', 'B', 'C', 'D'] as const).map(key => ({
                          key,
                          text: currentQuestion?.[`option_${key.toLowerCase()}` as keyof Question] as string,
                          originalKey: key,
                        }));
                    
                    return displayOptions.map((option) => {
                      // Check if this option (by original key) is selected
                      const isSelected = currentAnswer === option.originalKey;

                      return (
                        <button
                          key={option.key}
                          onClick={() => selectAnswer(option.key as 'A' | 'B' | 'C' | 'D')}
                          disabled={isDisabled}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                            ${isDisabled 
                              ? 'opacity-60 cursor-not-allowed' 
                              : ''
                            }
                            ${isSelected 
                              ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-md' 
                              : isDisabled
                                ? 'border-gray-200 bg-gray-50'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                              ${isSelected 
                                ? 'bg-blue-500 text-white scale-110' 
                                : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {option.key}
                            </span>
                            <span className="flex-1 text-base">{option.text}</span>
                            {isSelected && <CheckCircle className="w-6 h-6 text-blue-500" />}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>

                {/* Expired Notice */}
                {isDisabled && (
                  <div className="mt-4 p-4 bg-gray-100 rounded-xl border-2 border-gray-300 flex items-center gap-3">
                    <Lock className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-600 font-medium">
                      {submissionStatus === 'submitted' 
                        ? 'Your exam has been submitted.' 
                        : 'Time is up. Your exam is being submitted automatically.'}
                    </span>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => goToQuestion(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    size="lg"
                  >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Previous
                  </Button>

                  <span className="text-sm text-gray-500 font-medium">
                    {currentIndex + 1} / {questions.length}
                  </span>

                  <Button
                    onClick={() => goToQuestion(currentIndex + 1)}
                    disabled={currentIndex === questions.length - 1}
                    size="lg"
                  >
                    Next
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar with Camera and Navigator */}
          <div className="lg:col-span-1 space-y-4">
            {/* Camera Preview Card - Only show if proctoring is enabled */}
            {isProctoringEnabled && (
              <Card className={`shadow-lg overflow-hidden transition-all duration-300 border-4 ${getCameraFrameColor(currentViolationStatus, faceStatus)}`}>
                <div className="relative">
                  {/* Camera Feed */}
                  <div className="aspect-[4/3] bg-gray-900 relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    
                    {/* Camera/Mic Status Icons - Top right */}
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <div className={`p-1.5 rounded-full ${proctoringState.cameraActive ? 'bg-green-500' : 'bg-red-500'}`}>
                        <Camera className="w-3 h-3 text-white" />
                      </div>
                      <div className={`p-1.5 rounded-full ${proctoringState.micActive ? 'bg-green-500' : 'bg-red-500'}`}>
                        <Mic className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    
                    {/* Face Status Badge - Top left */}
                    <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                      faceStatus === 'detected' 
                        ? 'bg-green-500/90 text-white' 
                        : faceStatus === 'multiple' 
                          ? 'bg-red-500/90 text-white' 
                          : 'bg-orange-500/90 text-white'
                    }`}>
                      {faceStatus === 'detected' ? (
                        <><Eye className="w-3 h-3" /> OK</>
                      ) : faceStatus === 'multiple' ? (
                        <><Users className="w-3 h-3" /> Multiple</>
                      ) : (
                        <><EyeOff className="w-3 h-3" /> No Face</>
                      )}
                    </div>
                  </div>
                  
                  {/* Status Message Below Camera - For warnings */}
                  {currentViolationStatus.message && (
                    <div className={`px-3 py-2 flex items-center gap-2 text-sm font-medium ${
                      currentViolationStatus.severity === 'serious' 
                        ? 'bg-red-500 text-white' 
                        : currentViolationStatus.severity === 'warning'
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {getViolationIcon(currentViolationStatus.type)}
                      <span className="truncate">{currentViolationStatus.message}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Question Navigator */}
            <Card className="shadow-lg sticky top-28">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Question Navigator</h3>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, index) => {
                    const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined;
                    const isCurrent = index === currentIndex;
                    const isFlagged = flaggedQuestions.has(q.id);

                    return (
                      <button
                        key={q.id}
                        onClick={() => goToQuestion(index)}
                        className={`relative w-full aspect-square rounded-lg text-sm font-medium transition-all duration-200
                          ${isCurrent 
                            ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-2' 
                            : isAnswered 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {index + 1}
                        {isFlagged && (
                          <Flag className="w-2.5 h-2.5 absolute top-0.5 right-0.5 text-orange-500 fill-orange-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
                    <span className="text-gray-600">Answered ({answeredCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300" />
                    <span className="text-gray-600">Not Answered ({questions.length - answeredCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-600" />
                    <span className="text-gray-600">Current</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-orange-500 fill-orange-500" />
                    <span className="text-gray-600">Flagged ({flaggedQuestions.size})</span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="mt-4 pt-4 border-t">
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {/* Only show violations if proctoring is enabled */}
                    {isProctoringEnabled && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Violations</span>
                        <span className={`font-medium ${proctoringState.violations.length > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                          {proctoringState.violations.length}/10
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium text-gray-900">{Math.round(progress)}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Serious Violation Dialog - Only for serious violations and only if proctoring enabled */}
      {isProctoringEnabled && (
        <Dialog open={showSeriousViolationDialog} onOpenChange={setShowSeriousViolationDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <DialogTitle className="text-xl font-bold text-red-700">Serious Violation Detected</DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              {seriousViolation?.details || seriousViolation?.type?.replace(/_/g, ' ')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium mb-1">This activity has been recorded.</p>
                  <p>
                    You have {proctoringState.violations.length} of 10 maximum violations. 
                    {proctoringState.violations.length >= 8 && (
                      <span className="font-semibold"> Your exam will be auto-submitted if you reach the limit.</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => setShowSeriousViolationDialog(false)}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog && !isDisabled} onOpenChange={(open) => !isDisabled && setShowSubmitDialog(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-blue-600" />
            </div>
            <DialogTitle className="text-2xl font-bold">Ready to Submit?</DialogTitle>
            <DialogDescription className="text-base">
              Please review your progress before submitting
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Time Remaining */}
            <div className={`text-center p-3 rounded-xl ${
              isCritical ? 'bg-red-50 border border-red-200' : 
              isWarning ? 'bg-amber-50 border border-amber-200' : 
              'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-center justify-center gap-2">
                <Timer className={`w-5 h-5 ${
                  isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600'
                }`} />
                <span className={`font-mono text-xl font-bold ${
                  isCritical ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-blue-700'
                }`}>
                  {formattedTime}
                </span>
                <span className={`text-sm ${
                  isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600'
                }`}>
                  remaining
                </span>
              </div>
            </div>

            {/* Progress Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{answeredCount}</div>
                <div className="text-xs text-green-600">Answered</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-gray-700">{questions.length - answeredCount}</div>
                <div className="text-xs text-gray-600">Unanswered</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-orange-700">{flaggedQuestions.size}</div>
                <div className="text-xs text-orange-600">Flagged</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-500">
              {Math.round((answeredCount / questions.length) * 100)}% Complete
            </p>

            {/* Warnings */}
            {answeredCount < questions.length && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Incomplete Assessment</p>
                  <p className="text-sm text-amber-700">
                    You have {questions.length - answeredCount} unanswered question(s). 
                    Unanswered questions will be marked as incorrect.
                  </p>
                </div>
              </div>
            )}

            {flaggedQuestions.size > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                <Flag className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800">Flagged Questions</p>
                  <p className="text-sm text-orange-700">
                    You flagged {flaggedQuestions.size} question(s) for review.
                    Make sure you've reviewed them before submitting.
                  </p>
                </div>
              </div>
            )}

            {isProctoringEnabled && proctoringState.violations.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Violations Recorded</p>
                  <p className="text-sm text-red-700">
                    {proctoringState.violations.length} violation(s) were recorded during your exam.
                    This will be reported to the administrator.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowSubmitDialog(false)}
              className="flex-1 h-12"
              disabled={submitting}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Continue Exam
            </Button>
            <Button 
              onClick={() => submitExam(false)} 
              disabled={submitting || isDisabled}
              className="flex-1 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold shadow-lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Submit Exam
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
