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
import { useProctoring } from "@/hooks/useProctoring";
import { useTimer } from "@/hooks/useTimer";
import { Assessment, Question, ViolationLog } from "@/types";
import { 
  Clock, ChevronLeft, ChevronRight, AlertTriangle, 
  Camera, Send, Loader2, CheckCircle, Flag, Mic
} from "lucide-react";

export default function ExamPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D' | null>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [lastViolation, setLastViolation] = useState<ViolationLog | null>(null);
  const isSubmittingRef = useRef(false);

  const handleAutoSubmit = useCallback(() => {
    if (!isSubmittingRef.current) {
      submitExam(true);
    }
  }, []);

  const handleViolation = useCallback((violation: ViolationLog) => {
    setLastViolation(violation);
    setShowViolationAlert(true);
    setTimeout(() => setShowViolationAlert(false), 5000);
  }, []);

  const { 
    state: proctoringState, 
    videoRef, 
    initializeMedia, 
    requestFullscreen,
  } = useProctoring({
    onViolation: handleViolation,
    onAutoSubmit: handleAutoSubmit,
    maxViolations: 10,
  });

  const { 
    formattedTime, 
    isWarning, 
    isCritical,
  } = useTimer({
    durationMinutes: assessment?.duration_minutes || 30,
    startTime: typeof window !== 'undefined' ? localStorage.getItem(`exam_start_${assessmentId}`) || undefined : undefined,
    onTimeUp: handleAutoSubmit,
    storageKey: `exam_timer_${assessmentId}`,
  });

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
    }
  }, [answers, assessmentId]);

  // Save flagged questions
  useEffect(() => {
    if (flaggedQuestions.size > 0) {
      localStorage.setItem(`exam_flagged_${assessmentId}`, JSON.stringify([...flaggedQuestions]));
    }
  }, [flaggedQuestions, assessmentId]);

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
    setLoading(false);
  };

  const selectAnswer = (answer: 'A' | 'B' | 'C' | 'D') => {
    const questionId = questions[currentIndex]?.id;
    if (questionId) {
      setAnswers(prev => ({ ...prev, [questionId]: answer }));
    }
  };

  const toggleFlag = () => {
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
    if (!attemptId || isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setSubmitting(true);
    setShowSubmitDialog(false);

    try {
      const supabase = createClient();

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

      // Calculate score
      let score = 0;
      const responses: { 
        attempt_id: string; 
        question_id: string; 
        selected_answer: string | null; 
        is_correct: boolean;
      }[] = [];

      questionsWithAnswers.forEach(q => {
        const selected = answers[q.id] || null;
        const isCorrect = selected !== null && selected === q.correct_answer;
        if (isCorrect) score++;

        responses.push({
          attempt_id: attemptId,
          question_id: q.id,
          selected_answer: selected,
          is_correct: isCorrect,
        });
      });

      console.log("Score calculation:", { 
        totalQuestions: questionsWithAnswers.length, 
        answeredQuestions: Object.keys(answers).length,
        score,
        answers,
        correctAnswers: questionsWithAnswers.map(q => ({ id: q.id, correct: q.correct_answer }))
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

      // Redirect to completion page
      router.push(`/exam/complete?score=${score}&total=${questionsWithAnswers.length}&violations=${proctoringState.violations.length}`);
    } catch (error) {
      console.error("Submit error:", error);
      isSubmittingRef.current = false;
      setSubmitting(false);
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

  return (
    <div className="min-h-screen bg-gray-100 exam-mode">
      {/* Violation Alert */}
      {showViolationAlert && lastViolation && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-pulse-warning">
          <Alert variant="destructive" className="bg-red-600 text-white border-red-700 shadow-2xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>⚠️ Warning:</strong> {lastViolation.details || lastViolation.type.replace(/_/g, ' ')}
              <span className="ml-2 bg-red-800 px-2 py-0.5 rounded text-xs">
                {proctoringState.violations.length}/10 violations
              </span>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Header */}
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

            <div className="flex items-center gap-4">
              {/* Camera indicator with preview */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Camera className={`w-4 h-4 ${proctoringState.cameraActive ? 'text-green-500' : 'text-red-500'}`} />
                  <Mic className={`w-4 h-4 ${proctoringState.micActive ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div className="w-20 h-14 bg-gray-900 rounded overflow-hidden border-2 border-gray-300">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                </div>
              </div>

              {/* Violations counter */}
              {proctoringState.violations.length > 0 && (
                <Badge variant="destructive" className="gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  {proctoringState.violations.length} violations
                </Badge>
              )}

              {/* Timer */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold
                ${isCritical ? 'bg-red-100 text-red-700 animate-pulse border-2 border-red-500' : 
                  isWarning ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-500' : 
                  'bg-gray-100 text-gray-700'}`}
              >
                <Clock className="w-5 h-5" />
                {formattedTime}
              </div>

              {/* Submit button - Improved UI */}
              <Button 
                onClick={() => setShowSubmitDialog(true)}
                disabled={submitting}
                size="lg"
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Submit Exam
                  </>
                )}
              </Button>
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

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Question Card */}
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
                    className={isCurrentFlagged ? "bg-orange-500 hover:bg-orange-600" : ""}
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
                  {(['A', 'B', 'C', 'D'] as const).map((option) => {
                    const optionKey = `option_${option.toLowerCase()}` as keyof Question;
                    const optionText = currentQuestion?.[optionKey];
                    const isSelected = currentAnswer === option;

                    return (
                      <button
                        key={option}
                        onClick={() => selectAnswer(option)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                          ${isSelected 
                            ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-md' 
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
                            {option}
                          </span>
                          <span className="flex-1 text-base">{optionText}</span>
                          {isSelected && <CheckCircle className="w-6 h-6 text-blue-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

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

          {/* Question Navigator */}
          <div className="lg:col-span-1">
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
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Violations</span>
                      <span className={`font-medium ${proctoringState.violations.length > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                        {proctoringState.violations.length}/10
                      </span>
                    </div>
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

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Submit Exam?</DialogTitle>
            <DialogDescription className="pt-2">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span>Questions Answered</span>
                  <span className="font-semibold">{answeredCount} / {questions.length}</span>
                </div>
                {answeredCount < questions.length && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-orange-800">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    You have {questions.length - answeredCount} unanswered questions.
                  </div>
                )}
                {flaggedQuestions.size > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800">
                    <Flag className="w-4 h-4 inline mr-2" />
                    You have {flaggedQuestions.size} flagged questions to review.
                  </div>
                )}
                {proctoringState.violations.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    {proctoringState.violations.length} violations recorded.
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Continue Exam
            </Button>
            <Button 
              onClick={() => submitExam(false)} 
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm Submit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
