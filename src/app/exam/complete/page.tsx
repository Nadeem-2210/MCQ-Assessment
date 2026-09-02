"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Trophy, XCircle, AlertTriangle, Mail, Award, Loader2, Download } from "lucide-react";
import { Suspense } from "react";
import { generateCertificatePDF, canGenerateCertificate } from "@/lib/certificate-generator";
import { sendResultsEmail, prepareEmailData } from "@/lib/email-service";
import { addToast } from "@/components/ui/toast";

function ExamCompleteContent() {
  const searchParams = useSearchParams();
  const score = parseInt(searchParams.get("score") || "0", 10);
  const total = parseInt(searchParams.get("total") || "0", 10);
  const violations = parseInt(searchParams.get("violations") || "0", 10);
  const traineeName = searchParams.get("name") || "Trainee";
  const traineeEmail = searchParams.get("email") || "";
  const assessmentName = searchParams.get("assessment") || "MCQ Assessment";
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percentage >= 60;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {passed ? (
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Trophy className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-orange-600 dark:text-orange-400" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl dark:text-white">
            {passed ? "Congratulations!" : "Exam Completed"}
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            {passed 
              ? "You have successfully passed the assessment" 
              : "Thank you for completing the assessment"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Display */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
            <div className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
              {percentage}%
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              {score} out of {total} correct
            </div>
          </div>

          {/* Pass/Fail Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
            ${passed 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
            }`}
          >
            {passed ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Passed (60% required)
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                Below passing score (60% required)
              </>
            )}
          </div>

          {/* Violations */}
          {violations > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
              <div className="flex items-center justify-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">{violations} violation(s) recorded</span>
              </div>
            </div>
          )}

          {/* Info */}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your results have been recorded. You may close this window.
          </p>

          {/* Branding */}
          <div className="pt-4 border-t dark:border-gray-700">
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">K</span>
              </div>
              <span className="text-sm">Kadel Labs MCQ Assessment</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ExamCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-pulse">Loading results...</div>
      </div>
    }>
      <ExamCompleteContent />
    </Suspense>
  );
}
