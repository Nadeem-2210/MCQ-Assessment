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
import { FEATURES } from "@/config/features";
import { Loader2, Clock, FileText, AlertCircle, Shield, Calendar } from "lucide-react";

// Helper function to check if assessment is within scheduled window
function checkScheduleStatus(assessment: Assessment): { available: boolean; message: string } {
  const now = new Date();
  
  if (assessment.starts_at) {
    const startDate = new Date(assessment.starts_at);
    if (now < startDate) {
      return {
        available: false,
        message: `This assessment will be available from ${startDate.toLocaleString()}`
      };
    }
  }
  
  if (assessment.ends_at) {
    const endDate = new Date(assessment.ends_at);
    if (now > endDate) {
      return {
        available: false,
        message: `This assessment ended on ${endDate.toLocaleString()}`
      };
    }
  }
  
  return { available: true, message: "" };
}

export default function ExamRegisterPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  // Check if proctoring is enabled
  const isProctoringEnabled = FEATURES.PROCTORING_ENABLED;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<{ available: boolean; message: string }>({ available: true, message: "" });
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
      // Check scheduling
      const status = checkScheduleStatus(data);
      setScheduleStatus(status);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // Validation
    if (!trimmedName || !trimmedEmail) {
      setError("Please fill in all fields");
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    // Name length validation
    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters long");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Name must be less than 100 characters");
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
        .eq("trainee_email", trimmedEmail)
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
        .eq("trainee_email", trimmedEmail)
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
          trainee_name: trimmedName,
          trainee_email: trimmedEmail,
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
      console.error("Registration error:", err);
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
            {(assessment.starts_at || assessment.ends_at) && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span>
                  {assessment.starts_at && assessment.ends_at 
                    ? `${new Date(assessment.starts_at).toLocaleDateString()} - ${new Date(assessment.ends_at).toLocaleDateString()}`
                    : assessment.starts_at 
                      ? `Starts ${new Date(assessment.starts_at).toLocaleDateString()}`
                      : `Ends ${new Date(assessment.ends_at!).toLocaleDateString()}`
                  }
                </span>
              </div>
            )}
          </div>

          {/* Schedule Not Available Warning */}
          {!scheduleStatus.available && (
            <Alert className="mb-6 bg-amber-50 border-amber-200">
              <Calendar className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                {scheduleStatus.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Proctoring Warning - Only show if proctoring is enabled */}
          {isProctoringEnabled && (
            <Alert className="mb-6 bg-orange-50 border-orange-200">
              <Shield className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 text-sm">
                <strong>Proctored Exam:</strong> This assessment uses camera and microphone 
                monitoring. Tab switching and screen changes will be recorded.
              </AlertDescription>
            </Alert>
          )}

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

            <Button type="submit" className="w-full" disabled={submitting || !scheduleStatus.available}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : !scheduleStatus.available ? (
                "Assessment Not Available"
              ) : (
                "Continue to Exam Setup"
              )}
            </Button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4">
            {isProctoringEnabled 
              ? "By continuing, you agree to the proctoring requirements and confirm that you will complete this assessment honestly."
              : "By continuing, you confirm that you will complete this assessment honestly."
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
