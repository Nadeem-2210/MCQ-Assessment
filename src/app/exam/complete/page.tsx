"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Sparkles, PartyPopper } from "lucide-react";
import { Suspense } from "react";

function ExamCompleteContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center border-0 shadow-2xl overflow-hidden">
        {/* Header with celebration gradient */}
        <div className="bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 px-8 pt-10 pb-12 relative overflow-hidden">
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-4 left-8 w-2 h-2 bg-yellow-300 rounded-full animate-pulse" />
          <div className="absolute top-12 right-12 w-3 h-3 bg-yellow-200 rounded-full animate-pulse delay-100" />
          <div className="absolute bottom-8 right-8 w-2 h-2 bg-white/40 rounded-full animate-pulse delay-200" />
          
          <div className="relative">
            <div className="mx-auto w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-5 shadow-xl border border-white/30 animate-bounce-slow">
              <CheckCircle className="w-14 h-14 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-white mb-2">
              Well Done!
            </CardTitle>
            <CardDescription className="text-green-100 text-base">
              Your exam has been submitted successfully
            </CardDescription>
          </div>
        </div>

        <CardContent className="p-8 space-y-6">
          {/* Success Message Box */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-center gap-3 mb-3">
              <PartyPopper className="w-6 h-6 text-amber-500" />
              <p className="text-lg font-semibold text-gray-800">Submission Confirmed</p>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              All your responses have been recorded and saved securely. 
              You can safely close this window now.
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-blue-700">
              <span className="font-medium">What's next?</span> Your results will be reviewed and shared with you by the administrator.
            </p>
          </div>

          {/* Footer Branding */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Powered by Kadel Labs</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add custom animation */}
      <style jsx global>{`
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default function ExamCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    }>
      <ExamCompleteContent />
    </Suspense>
  );
}
