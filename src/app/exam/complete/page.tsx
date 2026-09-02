"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { Suspense } from "react";

function ExamCompleteContent() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-2xl dark:text-white">
            Exam Submitted
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            Thank you for completing the assessment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Simple confirmation message */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
            <p className="text-gray-700 dark:text-gray-300">
              Your responses have been recorded successfully.
            </p>
          </div>

          {/* Info */}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your results will be shared with you by the administrator. You may close this window.
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
        <div className="animate-pulse">Loading...</div>
      </div>
    }>
      <ExamCompleteContent />
    </Suspense>
  );
}
