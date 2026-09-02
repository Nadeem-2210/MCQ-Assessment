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
import { Loader2, Clock, FileText, AlertCircle, Shield, Calendar, User, Mail, ArrowRight, BookOpen, Sparkles } from "lucide-react";

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle className="text-xl">Assessment Not Available</CardTitle>
            <CardDescription>
              {error || "This assessment is no longer active or does not exist."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-0 shadow-2xl overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-8 pt-8 pb-10 text-center relative overflow-hidden">
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 shadow-lg border border-white/30">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white mb-2">{assessment.name}</CardTitle>
            <CardDescription className="text-blue-100">
              Enter your details to begin the assessment
            </CardDescription>
          </div>
        </div>

        <CardContent className="p-8">
          {/* Assessment Info Cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{assessment.num_questions}</p>
                  <p className="text-xs text-blue-600">Questions</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700">{assessment.duration_minutes}</p>
                  <p className="text-xs text-green-600">Minutes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Info */}
          {(assessment.starts_at || assessment.ends_at) && (
            <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-600">
                {assessment.starts_at && assessment.ends_at 
                  ? `${new Date(assessment.starts_at).toLocaleDateString()} - ${new Date(assessment.ends_at).toLocaleDateString()}`
                  : assessment.starts_at 
                    ? `Starts ${new Date(assessment.starts_at).toLocaleDateString()}`
                    : `Ends ${new Date(assessment.ends_at!).toLocaleDateString()}`
                }
              </span>
            </div>
          )}

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

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-200 py-3">
                <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700 font-medium text-sm">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={submitting}
                  className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-medium text-sm">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all rounded-xl"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all duration-200 rounded-xl mt-2" 
              disabled={submitting || !scheduleStatus.available}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Registering...
                </>
              ) : !scheduleStatus.available ? (
                "Assessment Not Available"
              ) : (
                <>
                  Continue to Exam
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            {isProctoringEnabled 
              ? "By continuing, you agree to the proctoring requirements and confirm that you will complete this assessment honestly."
              : "By continuing, you confirm that you will complete this assessment honestly."
            }
          </p>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Powered by Kadel Labs
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
