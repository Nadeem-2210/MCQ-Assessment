"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminLoginDialog } from "@/components/admin-login-dialog";
import { Shield, Clock, FileSpreadsheet, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">K</span>
            </div>
            <div>
              <h1 className="font-bold text-xl text-gray-900">Kadel Labs</h1>
              <p className="text-xs text-gray-500">MCQ Assessment Platform</p>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="#features" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              How It Works
            </Link>
            <AdminLoginDialog>
              <Button>Admin Login</Button>
            </AdminLoginDialog>
          </nav>
        </div>
      </header>

      {/* Main Content - Single Screen */}
      <main className="flex-1 flex flex-col justify-center container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Hero Text */}
          <div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Secure MCQ Assessments
              <span className="text-blue-600 block">Made Simple</span>
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Create, manage, and conduct secure online assessments with advanced
              anti-cheating measures. Perfect for training programs and certifications.
            </p>
            <div className="flex gap-4">
              <AdminLoginDialog>
                <Button size="lg" className="text-lg px-8">
                  Get Started
                </Button>
              </AdminLoginDialog>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Learn More
                </Button>
              </Link>
            </div>

            {/* How It Works - Compact */}
            <div id="how-it-works" className="mt-8 pt-6 border-t">
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">How It Works</h4>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <span className="text-sm text-gray-700">Create Assessment</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <span className="text-sm text-gray-700">Share Link</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <span className="text-sm text-gray-700">Review Results</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Features Grid */}
          <div id="features" className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border-2 border-gray-100 p-5 hover:border-blue-200 hover:shadow-lg transition-all">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Anti-Cheating</h3>
              <p className="text-sm text-gray-500">
                Face detection, tab monitoring & fullscreen enforcement
              </p>
            </div>

            <div className="bg-white rounded-xl border-2 border-gray-100 p-5 hover:border-green-200 hover:shadow-lg transition-all">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Excel Upload</h3>
              <p className="text-sm text-gray-500">
                Upload questions in Excel format easily
              </p>
            </div>

            <div className="bg-white rounded-xl border-2 border-gray-100 p-5 hover:border-orange-200 hover:shadow-lg transition-all">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Timed Exams</h3>
              <p className="text-sm text-gray-500">
                Custom time limits with auto-submit
              </p>
            </div>

            <div className="bg-white rounded-xl border-2 border-gray-100 p-5 hover:border-purple-200 hover:shadow-lg transition-all">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Results Dashboard</h3>
              <p className="text-sm text-gray-500">
                Detailed scores & violation logs
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 bg-white/50">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Kadel Labs. All rights reserved.</p>
          <div className="flex gap-6">
            <AdminLoginDialog>
              <button className="hover:text-blue-600 transition-colors">
                Admin Portal
              </button>
            </AdminLoginDialog>
          </div>
        </div>
      </footer>
    </div>
  );
}
