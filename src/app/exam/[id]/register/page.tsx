"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { Assessment } from "@/types";
import { Loader2, Clock, FileText, AlertCircle, Shield } from "lucide-react";

export default function ExamRegisterPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAssessment();
  }, [assessmentId]);

  const loadAssessment = async () => {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", assessmentId)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      setError("Assessment not found or is no longer active.");
    } else {
      setAssessment(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const supabase = createClient();

      // Check if trainee already has an in-progress attempt
      const { data: existingAttempt } = await supabase
        .from("attempts")
        .select("id")
        .eq("assessment_id", assessmentId)
        .eq("trainee_email", email.trim().toLowerCase())
        .eq("status", "in_progress")
        .single();

      if (existingAttempt) {
        // Resume existing attempt
        localStorage.setItem(`attempt_${assessmentId}`, existingAttempt.id);
        router.push(`/exam/${assessmentId}/start`);
        return;
      }

      // Check if trainee already completed this assessment
      const { data: completedAttempt } = await supabase
        .from("attempts")
        .select("id")
        .eq("assessment_id", assessmentId)
        .eq("trainee_email", email.trim().toLowerCase())
        .in("status", ["submitted", "auto_submitted"])
        .single();

      if (completedAttempt) {
        setError("You have already completed this assessment.");
        setSubmitting(false);
        return;
      }

      // Create new attempt
      const { data: newAttempt, error: attemptError } = await supabase
        .from("attempts")
        .insert({
          assessment_id: assessmentId,
          trainee_name: name.trim(),
          trainee_email: email.trim().toLowerCase(),
          total_questions: assessment?.num_questions || 0,
          violations: [],
          status: "in_progress",
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Store attempt ID in localStorage
      localStorage.setItem(`attempt_${assessmentId}`, newAttempt.id);
      
      router.push(`/exam/${assessmentId}/start`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Assessment Not Available</CardTitle>
            <CardDescription>
              {error || "This assessment is no longer active or does not exist."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-2xl">K</span>
            </div>
          </div>
          <CardTitle className="text-2xl">{assessment.name}</CardTitle>
          <CardDescription>
            Please register to begin the assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Assessment Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-gray-500" />
              <span>{assessment.num_questions} Questions</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>{assessment.duration_minutes} Minutes</span>
            </div>
          </div>

          {/* Proctoring Warning */}
          <Alert className="mb-6 bg-orange-50 border-orange-200">
            <Shield className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 text-sm">
              <strong>Proctored Exam:</strong> This assessment uses camera and microphone 
              monitoring. Tab switching and screen changes will be recorded.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                "Continue to Exam Setup"
              )}
            </Button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4">
            By continuing, you agree to the proctoring requirements and 
            confirm that you will complete this assessment honestly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
