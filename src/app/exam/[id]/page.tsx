"use client";

import { useEffect, useState, useCallback } from "react";
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
  Camera, Send, Loader2, CheckCircle
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [lastViolation, setLastViolation] = useState<ViolationLog | null>(null);

  const handleAutoSubmit = useCallback(() => {
    submitExam(true);
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
    maxViolations: 5,
  });

  const { 
    formattedTime, 
    isWarning, 
    isCritical,
    timeRemaining,
  } = useTimer({
    durationMinutes: assessment?.duration_minutes || 30,
    startTime: localStorage.getItem(`exam_start_${assessmentId}`) || undefined,
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
    initializeMedia();
    requestFullscreen();

    // Load saved answers
    const savedAnswers = localStorage.getItem(`exam_answers_${assessmentId}`);
    if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
    }
  }, [assessmentId]);

  // Save answers to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(`exam_answers_${assessmentId}`, JSON.stringify(answers));
    }
  }, [answers, assessmentId]);

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

    const timeout = setTimeout(saveViolations, 5000);
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

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  };

  const submitExam = async (isAutoSubmit: boolean = false) => {
    if (!attemptId || submitting) return;
    
    setSubmitting(true);

    try {
      const supabase = createClient();

      // Get correct answers
      const { data: questionsWithAnswers } = await supabase
        .from("questions")
        .select("id, correct_answer")
        .eq("assessment_id", assessmentId);

      // Calculate score
      let score = 0;
      const responses: { 
        attempt_id: string; 
        question_id: string; 
        selected_answer: string | null; 
        is_correct: boolean;
      }[] = [];

      questionsWithAnswers?.forEach(q => {
        const selected = answers[q.id] || null;
        const isCorrect = selected === q.correct_answer;
        if (isCorrect) score++;

        responses.push({
          attempt_id: attemptId,
          question_id: q.id,
          selected_answer: selected,
          is_correct: isCorrect,
        });
      });

      // Save responses
      await supabase.from("responses").insert(responses);

      // Update attempt
      await supabase
        .from("attempts")
        .update({
          score,
          submitted_at: new Date().toISOString(),
          status: isAutoSubmit ? "auto_submitted" : "submitted",
          violations: proctoringState.violations,
        })
        .eq("id", attemptId);

      // Clear localStorage
      localStorage.removeItem(`attempt_${assessmentId}`);
      localStorage.removeItem(`exam_start_${assessmentId}`);
      localStorage.removeItem(`exam_timer_${assessmentId}`);
      localStorage.removeItem(`exam_answers_${assessmentId}`);

      // Redirect to completion page
      router.push(`/exam/complete?score=${score}&total=${questions.length}`);
    } catch (error) {
      console.error("Submit error:", error);
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
  const answeredCount = Object.values(answers).filter(a => a !== null).length;
  const progress = (answeredCount / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-100 exam-mode">
      {/* Violation Alert */}
      {showViolationAlert && lastViolation && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-pulse-warning">
          <Alert variant="destructive" className="bg-red-600 text-white border-red-700">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> {lastViolation.details || lastViolation.type.replace(/_/g, ' ')}
              <span className="ml-2">
                ({proctoringState.violations.length}/5 violations)
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
              {/* Camera indicator */}
              <div className="flex items-center gap-1">
                <Camera className={`w-4 h-4 ${proctoringState.cameraActive ? 'text-green-500' : 'text-red-500'}`} />
                <div className="w-16 h-12 bg-gray-900 rounded overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Violations counter */}
              {proctoringState.violations.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {proctoringState.violations.length}
                </Badge>
              )}

              {/* Timer */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-lg
                ${isCritical ? 'bg-red-100 text-red-700 animate-pulse' : 
                  isWarning ? 'bg-yellow-100 text-yellow-700' : 
                  'bg-gray-100 text-gray-700'}`}
              >
                <Clock className="w-4 h-4" />
                {formattedTime}
              </div>

              {/* Submit button */}
              <Button 
                onClick={() => setShowSubmitDialog(true)}
                disabled={submitting}
              >
                <Send className="w-4 h-4 mr-2" />
                Submit
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500 mt-1">
              {answeredCount} of {questions.length} answered
            </p>
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
                {/* Question */}
                <div className="mb-6">
                  <Badge className="mb-3">Question {currentIndex + 1}</Badge>
                  <h2 className="text-xl font-medium text-gray-900">
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
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all
                          ${isSelected 
                            ? 'border-blue-500 bg-blue-50 text-blue-900' 
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                            ${isSelected 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {option}
                          </span>
                          <span>{optionText}</span>
                          {isSelected && <CheckCircle className="w-5 h-5 text-blue-500 ml-auto" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => goToQuestion(currentIndex - 1)}
                    disabled={currentIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>

                  <span className="text-sm text-gray-500">
                    {currentIndex + 1} / {questions.length}
                  </span>

                  <Button
                    onClick={() => goToQuestion(currentIndex + 1)}
                    disabled={currentIndex === questions.length - 1}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Navigator */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg sticky top-24">
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-3">Questions</h3>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, index) => {
                    const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined;
                    const isCurrent = index === currentIndex;

                    return (
                      <button
                        key={q.id}
                        onClick={() => goToQuestion(index)}
                        className={`w-full aspect-square rounded text-sm font-medium transition-colors
                          ${isCurrent 
                            ? 'bg-blue-600 text-white' 
                            : isAnswered 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-100" />
                    <span className="text-gray-600">Answered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-100" />
                    <span className="text-gray-600">Not Answered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-600" />
                    <span className="text-gray-600">Current</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Exam?</DialogTitle>
            <DialogDescription>
              You have answered {answeredCount} out of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-orange-600">
                  Warning: You have {questions.length - answeredCount} unanswered questions.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Continue Exam
            </Button>
            <Button onClick={() => submitExam(false)} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Exam"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
