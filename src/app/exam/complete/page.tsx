"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Trophy, XCircle } from "lucide-react";
import { Suspense } from "react";

function ExamCompleteContent() {
  const searchParams = useSearchParams();
  const score = parseInt(searchParams.get("score") || "0", 10);
  const total = parseInt(searchParams.get("total") || "0", 10);
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percentage >= 60;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {passed ? (
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <Trophy className="w-10 h-10 text-green-600" />
              </div>
            ) : (
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-orange-600" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl">
            {passed ? "Congratulations!" : "Exam Completed"}
          </CardTitle>
          <CardDescription>
            {passed 
              ? "You have successfully passed the assessment" 
              : "Thank you for completing the assessment"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Display */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="text-5xl font-bold text-gray-900 mb-2">
              {percentage}%
            </div>
            <div className="text-gray-600">
              {score} out of {total} correct
            </div>
          </div>

          {/* Pass/Fail Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
            ${passed 
              ? 'bg-green-100 text-green-800' 
              : 'bg-orange-100 text-orange-800'
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

          {/* Info */}
          <p className="text-sm text-gray-500">
            Your results have been recorded. You may close this window.
          </p>

          {/* Branding */}
          <div className="pt-4 border-t">
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
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="animate-pulse">Loading results...</div>
      </div>
    }>
      <ExamCompleteContent />
    </Suspense>
  );
}
