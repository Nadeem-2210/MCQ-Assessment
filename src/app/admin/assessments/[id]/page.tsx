"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { Assessment, Question, Attempt, Response } from "@/types";
import { formatDate, generateExamLink } from "@/lib/utils";
import { 
  ArrowLeft, Copy, Clock, FileText, Users, CheckCircle, 
  XCircle, AlertTriangle, ExternalLink, Trash2, Eye, Loader2
} from "lucide-react";

interface AttemptWithResponses extends Attempt {
  responses?: (Response & { question?: Question })[];
}

export default function AssessmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Dialog states
  const [deleteAttemptId, setDeleteAttemptId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewAttempt, setViewAttempt] = useState<AttemptWithResponses | null>(null);
  const [loadingResponses, setLoadingResponses] = useState(false);

  useEffect(() => {
    loadData();
  }, [assessmentId]);

  const loadData = async () => {
    const supabase = createClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/admin/login");
      return;
    }

    // Load assessment
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

    // Load questions
    const { data: questionsData } = await supabase
      .from("questions")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("order_index");

    setQuestions(questionsData || []);

    // Load attempts
    const { data: attemptsData } = await supabase
      .from("attempts")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("started_at", { ascending: false });

    setAttempts(attemptsData || []);
    setLoading(false);
  };

  const copyLink = async () => {
    const link = generateExamLink(assessmentId);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleActive = async () => {
    if (!assessment) return;
    
    const supabase = createClient();
    const { error } = await supabase
      .from("assessments")
      .update({ is_active: !assessment.is_active })
      .eq("id", assessmentId);

    if (!error) {
      setAssessment({ ...assessment, is_active: !assessment.is_active });
    }
  };

  const deleteAttempt = async () => {
    if (!deleteAttemptId) return;
    
    setDeleting(true);
    const supabase = createClient();

    // Delete responses first
    await supabase
      .from("responses")
      .delete()
      .eq("attempt_id", deleteAttemptId);

    // Delete attempt
    const { error } = await supabase
      .from("attempts")
      .delete()
      .eq("id", deleteAttemptId);

    if (!error) {
      setAttempts(attempts.filter(a => a.id !== deleteAttemptId));
    }

    setDeleting(false);
    setDeleteAttemptId(null);
  };

  const viewAttemptDetails = async (attempt: Attempt) => {
    setLoadingResponses(true);
    setViewAttempt(attempt);

    const supabase = createClient();
    
    // Load responses for this attempt
    const { data: responses } = await supabase
      .from("responses")
      .select("*")
      .eq("attempt_id", attempt.id);

    // Map responses with question data
    const responsesWithQuestions = responses?.map(r => ({
      ...r,
      question: questions.find(q => q.id === r.question_id)
    })) || [];

    setViewAttempt({
      ...attempt,
      responses: responsesWithQuestions
    });
    setLoadingResponses(false);
  };

  const getStatusBadge = (attempt: Attempt) => {
    if (attempt.status === "submitted") {
      return <Badge variant="success">Submitted</Badge>;
    }
    if (attempt.status === "auto_submitted") {
      return <Badge variant="warning">Auto-submitted</Badge>;
    }
    return <Badge variant="secondary">In Progress</Badge>;
  };

  const getViolationCount = (attempt: Attempt) => {
    return attempt.violations?.length || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!assessment) return null;

  const examLink = generateExamLink(assessmentId);
  const completedAttempts = attempts.filter(a => a.score !== null);
  const avgScore = completedAttempts.length > 0
    ? Math.round(
        completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / completedAttempts.length
      )
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-xl text-gray-900">{assessment.name}</h1>
              <p className="text-sm text-gray-500">Assessment Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={assessment.is_active ? "success" : "secondary"}
              className="cursor-pointer"
              onClick={toggleActive}
            >
              {assessment.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Exam Link */}
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <ExternalLink className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-blue-800 font-mono text-sm truncate mr-4">
              {examLink}
            </span>
            <Button size="sm" onClick={copyLink}>
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy Link
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Questions
              </CardTitle>
              <FileText className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{questions.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Duration
              </CardTitle>
              <Clock className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{assessment.duration_minutes} min</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Attempts
              </CardTitle>
              <Users className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{attempts.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Score
              </CardTitle>
              <CheckCircle className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {avgScore}/{questions.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attempts Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Attempts ({attempts.length})</CardTitle>
            <CardDescription>
              All trainee attempts for this assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No attempts yet. Share the exam link with trainees to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainee</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Violations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-medium">
                        {attempt.trainee_name}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {attempt.trainee_email}
                      </TableCell>
                      <TableCell>
                        {attempt.score !== null ? (
                          <span className={
                            (attempt.score / attempt.total_questions) >= 0.6
                              ? "text-green-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }>
                            {attempt.score}/{attempt.total_questions}
                            <span className="text-gray-400 text-xs ml-1">
                              ({Math.round((attempt.score / attempt.total_questions) * 100)}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getViolationCount(attempt) > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {getViolationCount(attempt)}
                          </Badge>
                        ) : (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Clean
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(attempt)}</TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {formatDate(attempt.started_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewAttemptDetails(attempt)}
                            disabled={attempt.status === "in_progress"}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteAttemptId(attempt.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Questions Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Questions ({questions.length})</CardTitle>
            <CardDescription>
              Preview of assessment questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {questions.map((q, index) => (
                <div key={q.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                      Q{index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 mb-3">
                        {q.question_text}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className={`p-2 rounded ${q.correct_answer === 'A' ? 'bg-green-100 text-green-800' : 'bg-gray-50'}`}>
                          <span className="font-medium">A:</span> {q.option_a}
                          {q.correct_answer === 'A' && <CheckCircle className="w-4 h-4 inline ml-2" />}
                        </div>
                        <div className={`p-2 rounded ${q.correct_answer === 'B' ? 'bg-green-100 text-green-800' : 'bg-gray-50'}`}>
                          <span className="font-medium">B:</span> {q.option_b}
                          {q.correct_answer === 'B' && <CheckCircle className="w-4 h-4 inline ml-2" />}
                        </div>
                        <div className={`p-2 rounded ${q.correct_answer === 'C' ? 'bg-green-100 text-green-800' : 'bg-gray-50'}`}>
                          <span className="font-medium">C:</span> {q.option_c}
                          {q.correct_answer === 'C' && <CheckCircle className="w-4 h-4 inline ml-2" />}
                        </div>
                        <div className={`p-2 rounded ${q.correct_answer === 'D' ? 'bg-green-100 text-green-800' : 'bg-gray-50'}`}>
                          <span className="font-medium">D:</span> {q.option_d}
                          {q.correct_answer === 'D' && <CheckCircle className="w-4 h-4 inline ml-2" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteAttemptId} onOpenChange={() => setDeleteAttemptId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Attempt?</DialogTitle>
            <DialogDescription>
              This will permanently delete this attempt and all associated responses. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAttemptId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteAttempt}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Attempt Dialog */}
      <Dialog open={!!viewAttempt} onOpenChange={() => setViewAttempt(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Answer Sheet - {viewAttempt?.trainee_name}
            </DialogTitle>
            <DialogDescription>
              <div className="flex gap-4 mt-2">
                <span>Email: {viewAttempt?.trainee_email}</span>
                <span>Score: {viewAttempt?.score}/{viewAttempt?.total_questions}</span>
                <span>Violations: {viewAttempt?.violations?.length || 0}</span>
              </div>
            </DialogDescription>
          </DialogHeader>

          {loadingResponses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {/* Violations Summary */}
              {viewAttempt?.violations && viewAttempt.violations.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    Violations ({viewAttempt.violations.length})
                  </h4>
                  <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                    {viewAttempt.violations.map((v, i) => (
                      <li key={i}>
                        <span className="font-medium">{v.type.replace(/_/g, ' ')}:</span> {v.details || '-'}
                        <span className="text-red-500 text-xs ml-2">
                          ({new Date(v.timestamp).toLocaleTimeString()})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Answers */}
              <div className="space-y-3">
                {viewAttempt?.responses?.map((response, index) => {
                  const question = response.question;
                  if (!question) return null;

                  return (
                    <div 
                      key={response.id} 
                      className={`border rounded-lg p-4 ${
                        response.is_correct 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`text-sm font-medium px-2 py-1 rounded ${
                          response.is_correct 
                            ? 'bg-green-200 text-green-800' 
                            : 'bg-red-200 text-red-800'
                        }`}>
                          Q{index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-2">
                            {question.question_text}
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {(['A', 'B', 'C', 'D'] as const).map(opt => {
                              const optKey = `option_${opt.toLowerCase()}` as keyof Question;
                              const isSelected = response.selected_answer === opt;
                              const isCorrect = question.correct_answer === opt;
                              
                              let bgClass = 'bg-gray-100';
                              if (isCorrect) bgClass = 'bg-green-200 text-green-900';
                              else if (isSelected && !isCorrect) bgClass = 'bg-red-200 text-red-900';

                              return (
                                <div key={opt} className={`p-2 rounded ${bgClass}`}>
                                  <span className="font-medium">{opt}:</span> {question[optKey] as string}
                                  {isCorrect && <CheckCircle className="w-4 h-4 inline ml-2 text-green-600" />}
                                  {isSelected && !isCorrect && <XCircle className="w-4 h-4 inline ml-2 text-red-600" />}
                                  {isSelected && <span className="text-xs ml-1">(Selected)</span>}
                                </div>
                              );
                            })}
                          </div>
                          {!response.selected_answer && (
                            <p className="text-orange-600 text-sm mt-2">
                              <AlertTriangle className="w-4 h-4 inline mr-1" />
                              Not answered
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setViewAttempt(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
