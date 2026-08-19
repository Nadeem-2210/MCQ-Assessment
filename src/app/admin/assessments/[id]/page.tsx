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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { Assessment, Question, Attempt } from "@/types";
import { formatDate, generateExamLink } from "@/lib/utils";
import { 
  ArrowLeft, Copy, Clock, FileText, Users, CheckCircle, 
  XCircle, AlertTriangle, ExternalLink 
} from "lucide-react";

export default function AssessmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!assessment) return null;

  const examLink = generateExamLink(assessmentId);
  const avgScore = attempts.length > 0
    ? Math.round(
        attempts
          .filter(a => a.score !== null)
          .reduce((sum, a) => sum + (a.score || 0), 0) /
        attempts.filter(a => a.score !== null).length
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
            <CardTitle>Attempts</CardTitle>
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
                    <TableHead>Submitted</TableHead>
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
                              ? "text-green-600 font-medium"
                              : "text-red-600 font-medium"
                          }>
                            {attempt.score}/{attempt.total_questions}
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
                      <TableCell className="text-gray-500 text-sm">
                        {attempt.submitted_at ? formatDate(attempt.submitted_at) : "-"}
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
    </div>
  );
}
