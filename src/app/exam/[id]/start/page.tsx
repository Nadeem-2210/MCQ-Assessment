"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { Assessment } from "@/types";
import { FEATURES } from "@/config/features";
import { 
  Loader2, Camera, Mic, Monitor, CheckCircle, XCircle, 
  AlertTriangle, Play 
} from "lucide-react";

interface PermissionStatus {
  camera: "pending" | "granted" | "denied";
  microphone: "pending" | "granted" | "denied";
}

export default function ExamStartPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check if proctoring is enabled
  const isProctoringEnabled = FEATURES.PROCTORING_ENABLED;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionStatus>({
    camera: isProctoringEnabled ? "pending" : "granted",
    microphone: isProctoringEnabled ? "pending" : "granted",
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedAttemptId = localStorage.getItem(`attempt_${assessmentId}`);
    if (!storedAttemptId) {
      router.push(`/exam/${assessmentId}/register`);
      return;
    }
    setAttemptId(storedAttemptId);
    loadAssessment();

    return () => {
      // Cleanup stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
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

  const requestPermissions = async () => {
    // Skip permission requests if proctoring is disabled
    if (!isProctoringEnabled) {
      setPermissions({
        camera: "granted",
        microphone: "granted",
      });
      return;
    }
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setStream(mediaStream);
      setPermissions({
        camera: "granted",
        microphone: "granted",
      });

      // Connect to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Permission error:", err);
      
      // Try to determine which permission failed
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setPermissions(prev => ({ ...prev, camera: "granted" }));
      } catch {
        setPermissions(prev => ({ ...prev, camera: "denied" }));
      }

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setPermissions(prev => ({ ...prev, microphone: "granted" }));
      } catch {
        setPermissions(prev => ({ ...prev, microphone: "denied" }));
      }
    }
  };

  const startExam = async () => {
    if (!attemptId) return;

    // Update attempt start time
    const supabase = createClient();
    await supabase
      .from("attempts")
      .update({ started_at: new Date().toISOString() })
      .eq("id", attemptId);

    // Store exam start time in localStorage for timer
    localStorage.setItem(
      `exam_start_${assessmentId}`, 
      new Date().toISOString()
    );

    // Navigate to exam
    router.push(`/exam/${assessmentId}`);
  };

  const getPermissionIcon = (status: "pending" | "granted" | "denied") => {
    switch (status) {
      case "granted":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "denied":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const allPermissionsGranted = 
    permissions.camera === "granted" && 
    permissions.microphone === "granted";

  // If proctoring is disabled, all permissions are automatically granted
  const canStartExam = isProctoringEnabled ? allPermissionsGranted : true;

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
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {isProctoringEnabled ? "Exam Setup" : "Ready to Start"}
            </CardTitle>
            <CardDescription>
              {isProctoringEnabled 
                ? "Please allow camera and microphone access to continue"
                : "Review the exam details and click Start when ready"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Camera Preview - Only show if proctoring is enabled */}
            {isProctoringEnabled && (
              <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                {stream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <Camera className="w-12 h-12 mx-auto mb-2" />
                      <p>Camera preview will appear here</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Permission Status - Only show if proctoring is enabled */}
            {isProctoringEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Camera className="w-5 h-5 text-gray-600" />
                    <span>Camera Access</span>
                  </div>
                  {getPermissionIcon(permissions.camera)}
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mic className="w-5 h-5 text-gray-600" />
                    <span>Microphone Access</span>
                  </div>
                  {getPermissionIcon(permissions.microphone)}
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-gray-600" />
                    <span>Fullscreen Mode</span>
                  </div>
                  <span className="text-sm text-gray-500">Required during exam</span>
                </div>
              </div>
            )}

            {/* Warnings - Only show if proctoring is enabled */}
            {isProctoringEnabled && (permissions.camera === "denied" || permissions.microphone === "denied") && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Camera and microphone access are required to take this exam. 
                  Please enable them in your browser settings and refresh the page.
                </AlertDescription>
              </Alert>
            )}

            {/* Instructions */}
            <Alert className="bg-blue-50 border-blue-200">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                <strong>Important Instructions:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {isProctoringEnabled && (
                    <>
                      <li>The exam will run in fullscreen mode</li>
                      <li>Do not switch tabs or windows during the exam</li>
                      <li>Keep your face visible to the camera</li>
                      <li>Multiple people detected will be flagged</li>
                    </>
                  )}
                  <li>The exam will auto-submit when time runs out</li>
                  <li>Make sure you have a stable internet connection</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex gap-4">
              {!canStartExam ? (
                <Button 
                  onClick={requestPermissions} 
                  className="flex-1"
                  variant={permissions.camera === "denied" || permissions.microphone === "denied" ? "outline" : "default"}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Grant Permissions
                </Button>
              ) : (
                <Button onClick={startExam} className="flex-1">
                  <Play className="w-4 h-4 mr-2" />
                  Start Exam
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
