"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { parseExcelFile, validateExcelStructure } from "@/lib/excel-parser";
import { ParsedQuestion } from "@/types";
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function NewAssessmentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [file, setFile] = useState<File | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [parseError, setParseError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError("");
    setValidationErrors([]);
    setParsedQuestions([]);
    setLoading(true);

    try {
      const questions = await parseExcelFile(selectedFile);
      const validation = validateExcelStructure(questions);
      
      if (!validation.valid) {
        setValidationErrors(validation.errors);
      }
      
      setParsedQuestions(questions);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse Excel file");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    
    // Validation
    if (!trimmedName) {
      setError("Please enter an assessment name");
      return;
    }

    if (trimmedName.length < 3) {
      setError("Assessment name must be at least 3 characters long");
      return;
    }

    if (trimmedName.length > 200) {
      setError("Assessment name must be less than 200 characters");
      return;
    }

    if (durationMinutes < 1 || durationMinutes > 180) {
      setError("Duration must be between 1 and 180 minutes");
      return;
    }
    
    if (parsedQuestions.length === 0) {
      setError("Please upload an Excel file with questions");
      return;
    }

    if (parsedQuestions.length > 500) {
      setError("Maximum 500 questions allowed per assessment");
      return;
    }

    if (validationErrors.length > 0) {
      setError("Please fix the validation errors in your Excel file");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const supabase = createClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/admin/login");
        return;
      }

      // Create assessment
      const { data: assessment, error: assessmentError } = await supabase
        .from("assessments")
        .insert({
          admin_id: user.id,
          name: trimmedName,
          duration_minutes: durationMinutes,
          num_questions: parsedQuestions.length,
          is_active: true,
        })
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      // Insert questions (sanitize text content)
      const questionsToInsert = parsedQuestions.map((q, index) => ({
        assessment_id: assessment.id,
        question_text: q.question_text.substring(0, 2000), // Limit question length
        option_a: q.option_a.substring(0, 500),
        option_b: q.option_b.substring(0, 500),
        option_c: q.option_c.substring(0, 500),
        option_d: q.option_d.substring(0, 500),
        correct_answer: q.correct_answer,
        order_index: index + 1,
      }));

      const { error: questionsError } = await supabase
        .from("questions")
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      router.push(`/admin/assessments/${assessment.id}`);
    } catch (err) {
      console.error("Create assessment error:", err);
      setError(err instanceof Error ? err.message : "Failed to create assessment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-xl text-gray-900">Create Assessment</h1>
            <p className="text-sm text-gray-500">Set up a new MCQ assessment</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Assessment Details</CardTitle>
              <CardDescription>
                Basic information about the assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Assessment Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., JavaScript Fundamentals Quiz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={180}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 30)}
                  required
                />
                <p className="text-sm text-gray-500">
                  Time limit for completing the assessment
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Excel Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Questions</CardTitle>
              <CardDescription>
                Upload an Excel file (.xlsx) with your questions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Excel Format Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Excel Format</h4>
                <p className="text-sm text-blue-800 mb-2">
                  Your Excel file should have the following columns:
                </p>
                <div className="overflow-x-auto">
                  <table className="text-xs text-blue-900 border-collapse">
                    <thead>
                      <tr className="border-b border-blue-200">
                        <th className="px-2 py-1 text-left">Question</th>
                        <th className="px-2 py-1 text-left">Option A</th>
                        <th className="px-2 py-1 text-left">Option B</th>
                        <th className="px-2 py-1 text-left">Option C</th>
                        <th className="px-2 py-1 text-left">Option D</th>
                        <th className="px-2 py-1 text-left">Correct Answer</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-2 py-1">What is 2+2?</td>
                        <td className="px-2 py-1">3</td>
                        <td className="px-2 py-1">4</td>
                        <td className="px-2 py-1">5</td>
                        <td className="px-2 py-1">6</td>
                        <td className="px-2 py-1">B</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* File Input */}
              <div className="space-y-2">
                <Label htmlFor="file">Excel File</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    id="file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="file" className="cursor-pointer">
                    {loading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <span className="text-sm text-gray-600">Parsing file...</span>
                      </div>
                    ) : file ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 text-green-500" />
                        <span className="text-sm font-medium text-gray-900">{file.name}</span>
                        <span className="text-xs text-gray-500">Click to change file</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Click to upload or drag and drop
                        </span>
                        <span className="text-xs text-gray-500">.xlsx or .xls files</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Parse Error */}
              {parseError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error parsing file</AlertTitle>
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              )}

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Validation Issues</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Success */}
              {parsedQuestions.length > 0 && validationErrors.length === 0 && (
                <Alert variant="success" className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">File parsed successfully</AlertTitle>
                  <AlertDescription className="text-green-700">
                    Found {parsedQuestions.length} questions ready to import
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Link href="/admin/dashboard" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={submitting || parsedQuestions.length === 0 || validationErrors.length > 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Assessment"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
