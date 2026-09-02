"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
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
import { Assessment, Question } from "@/types";
import { addToast } from "@/components/ui/toast";
import { 
  ChevronLeft, ChevronRight, AlertTriangle, 
  Loader2, CheckCircle, Flag, Timer, Eye, ArrowLeft,
  Keyboard, Save, Info, X
} from "lucide-react";

export default function AssessmentPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D' | null>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  useEffect(() => {
    loadExamData();
  }, [assessmentId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toUpperCase();
      
      const keyMap: Record<string, 'A' | 'B' | 'C' | 'D'> = {
        '1': 'A', '2': 'B', '3': 'C', '4': 'D',
        'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D',
      };
      
      if (keyMap[key]) {
        e.preventDefault();
        selectAnswer(keyMap[key]);
      }
      
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        goToQuestion(currentIndex - 1);
      }
      if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
        e.preventDefault();
        goToQuestion(currentIndex + 1);
      }
      
      if (key === 'F') {
        e.preventDefault();
        toggleFlag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions.length]);

  const loadExamData = async () => {
    const supabase = createClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/admin/login");
      return;
    }

    const { data: assessmentData } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", assessmentId)
      .single();

    if (!assessmentData) {
      router.push("/admin/dashboard");
      return;
    }

    setAssessment(assessmentData);

    const { data: questionsData } = await supabase
      .from("questions")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("order_index");

    setQuestions(questionsData || []);
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

  const calculateScore = () => {
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) {
        score++;
      }
    });
    return score;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const isCurrentFlagged = currentQuestion ? flaggedQuestions.has(currentQuestion.id) : false;
  const answeredCount = Object.values(answers).filter(a => a !== null).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Preview Banner */}
      <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
        <Eye className="w-4 h-4" />
        PREVIEW MODE - This is how trainees will experience the exam
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-4 bg-white/20 border-amber-700 text-amber-900 hover:bg-white/30"
          onClick={() => setShowAnswers(!showAnswers)}
        >
          {showAnswers ? "Hide Answers" : "Show Answers"}
        </Button>
      </div>

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExitDialog(true)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exit Preview
              </Button>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-white">{assessment?.name}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Question {currentIndex + 1} of {questions.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Keyboard Shortcuts Hint */}
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                <Keyboard className="w-3 h-3" />
                1-4 / A-D to select
              </div>

              {/* Timer Display (Mock) */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white border-2 border-blue-400">
                <Timer className="w-5 h-5" />
                <span>{assessment?.duration_minutes}:00</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
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
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Question Card */}
          <div className="lg:col-span-3">
            <Card className="shadow-lg dark:bg-gray-800 dark:border-gray-700">
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
                  <h2 className="text-xl font-medium text-gray-900 dark:text-white leading-relaxed">
                    {currentQuestion?.question_text}
                  </h2>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  {(['A', 'B', 'C', 'D'] as const).map((optionKey) => {
                    const optionText = currentQuestion?.[`option_${optionKey.toLowerCase()}` as keyof Question] as string;
                    const isSelected = currentAnswer === optionKey;
                    const isCorrect = currentQuestion?.correct_answer === optionKey;

                    return (
                      <button
                        key={optionKey}
                        onClick={() => selectAnswer(optionKey)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                          ${isSelected 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 shadow-md' 
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }
                          ${showAnswers && isCorrect 
                            ? 'ring-2 ring-green-500 ring-offset-2' 
                            : ''
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                            ${isSelected 
                              ? 'bg-blue-500 text-white scale-110' 
                              : showAnswers && isCorrect
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            {optionKey}
                          </span>
                          <span className="flex-1 text-base dark:text-gray-200">{optionText}</span>
                          {isSelected && <CheckCircle className="w-6 h-6 text-blue-500" />}
                          {showAnswers && isCorrect && (
                            <Badge className="bg-green-500 text-white">Correct</Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Show Answer Explanation in Preview */}
                {showAnswers && (
                  <Alert className="mt-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      Correct answer: <strong>{currentQuestion?.correct_answer}</strong>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={() => goToQuestion(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    size="lg"
                  >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Previous
                  </Button>

                  <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
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

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Preview Score Card */}
            <Card className="shadow-lg bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Preview Score</h3>
                </div>
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {calculateScore()} / {questions.length}
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  {Math.round((calculateScore() / questions.length) * 100)}% correct
                </p>
              </CardContent>
            </Card>

            {/* Question Navigator */}
            <Card className="shadow-lg dark:bg-gray-800 dark:border-gray-700 sticky top-28">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Question Navigator</h3>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, index) => {
                    const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined;
                    const isCurrent = index === currentIndex;
                    const isFlagged = flaggedQuestions.has(q.id);
                    const isCorrectlyAnswered = showAnswers && answers[q.id] === q.correct_answer;

                    return (
                      <button
                        key={q.id}
                        onClick={() => goToQuestion(index)}
                        className={`relative w-full aspect-square rounded-lg text-sm font-medium transition-all duration-200
                          ${isCurrent 
                            ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-2' 
                            : showAnswers
                              ? isCorrectlyAnswered
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : isAnswered
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                              : isAnswered 
                                ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
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

                <div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" />
                    <span className="text-gray-600 dark:text-gray-400">Answered ({answeredCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
                    <span className="text-gray-600 dark:text-gray-400">Not Answered ({questions.length - answeredCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-600" />
                    <span className="text-gray-600 dark:text-gray-400">Current</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-orange-500 fill-orange-500" />
                    <span className="text-gray-600 dark:text-gray-400">Flagged ({flaggedQuestions.size})</span>
                  </div>
                </div>

                {/* Keyboard Shortcuts */}
                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">KEYBOARD SHORTCUTS</h4>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Select option</span>
                      <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">1-4 or A-D</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Previous</span>
                      <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">←</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Next</span>
                      <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">→</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Flag question</span>
                      <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">F</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Exit Preview Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle>Exit Preview?</DialogTitle>
            <DialogDescription>
              Return to the assessment details page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Continue Preview
            </Button>
            <Link href={`/admin/assessments/${assessmentId}`}>
              <Button>Exit Preview</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
