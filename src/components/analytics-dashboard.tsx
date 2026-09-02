"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart2, TrendingUp, Clock, Users, Award, XCircle, CheckCircle,
  Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Attempt, Assessment } from "@/types";

interface AnalyticsData {
  totalAttempts: number;
  passedAttempts: number;
  failedAttempts: number;
  averageScore: number;
  averageCompletionTime: number; // in minutes
  scoreDistribution: { range: string; count: number }[];
  completionTimeDistribution: { range: string; count: number }[];
  passRate: number;
}

interface AnalyticsDashboardProps {
  assessmentId?: string; // Optional: for single assessment analytics
}

export function AnalyticsDashboard({ assessmentId }: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<string>(assessmentId || "all");

  useEffect(() => {
    loadAnalytics();
  }, [selectedAssessment]);

  const loadAnalytics = async () => {
    setLoading(true);
    const supabase = createClient();

    // Load all assessments for dropdown
    if (!assessmentId) {
      const { data: assessmentData } = await supabase
        .from("assessments")
        .select("*")
        .order("created_at", { ascending: false });
      setAssessments(assessmentData || []);
    }

    // Load attempts based on selection
    let query = supabase
      .from("attempts")
      .select("*")
      .in("status", ["submitted", "auto_submitted"]);

    if (selectedAssessment !== "all") {
      query = query.eq("assessment_id", selectedAssessment);
    }

    const { data: attempts } = await query;
    
    if (!attempts || attempts.length === 0) {
      setData({
        totalAttempts: 0,
        passedAttempts: 0,
        failedAttempts: 0,
        averageScore: 0,
        averageCompletionTime: 0,
        scoreDistribution: [],
        completionTimeDistribution: [],
        passRate: 0,
      });
      setLoading(false);
      return;
    }

    // Calculate analytics
    const completedAttempts = attempts.filter(a => a.score !== null && a.submitted_at);
    const totalAttempts = completedAttempts.length;
    
    // Pass/fail calculation (60% threshold)
    const passedAttempts = completedAttempts.filter(
      a => (a.score / a.total_questions) >= 0.6
    ).length;
    const failedAttempts = totalAttempts - passedAttempts;
    
    // Average score (percentage)
    const averageScore = totalAttempts > 0
      ? completedAttempts.reduce((sum, a) => sum + (a.score / a.total_questions) * 100, 0) / totalAttempts
      : 0;
    
    // Average completion time
    const completionTimes = completedAttempts
      .filter(a => a.submitted_at && a.started_at)
      .map(a => {
        const start = new Date(a.started_at).getTime();
        const end = new Date(a.submitted_at).getTime();
        return (end - start) / (1000 * 60); // minutes
      });
    
    const averageCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((sum, t) => sum + t, 0) / completionTimes.length
      : 0;
    
    // Score distribution (0-20, 21-40, 41-60, 61-80, 81-100)
    const scoreRanges = [
      { range: "0-20%", min: 0, max: 20 },
      { range: "21-40%", min: 21, max: 40 },
      { range: "41-60%", min: 41, max: 60 },
      { range: "61-80%", min: 61, max: 80 },
      { range: "81-100%", min: 81, max: 100 },
    ];
    
    const scoreDistribution = scoreRanges.map(range => ({
      range: range.range,
      count: completedAttempts.filter(a => {
        const percentage = (a.score / a.total_questions) * 100;
        return percentage >= range.min && percentage <= range.max;
      }).length,
    }));
    
    // Completion time distribution
    const timeRanges = [
      { range: "0-10 min", min: 0, max: 10 },
      { range: "11-20 min", min: 11, max: 20 },
      { range: "21-30 min", min: 21, max: 30 },
      { range: "31-45 min", min: 31, max: 45 },
      { range: "45+ min", min: 46, max: Infinity },
    ];
    
    const completionTimeDistribution = timeRanges.map(range => ({
      range: range.range,
      count: completionTimes.filter(t => t >= range.min && t <= range.max).length,
    }));

    setData({
      totalAttempts,
      passedAttempts,
      failedAttempts,
      averageScore,
      averageCompletionTime,
      scoreDistribution,
      completionTimeDistribution,
      passRate: totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0,
    });
    
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const maxScoreCount = Math.max(...(data?.scoreDistribution.map(d => d.count) || [1]));
  const maxTimeCount = Math.max(...(data?.completionTimeDistribution.map(d => d.count) || [1]));

  return (
    <div className="space-y-6">
      {/* Assessment Selector */}
      {!assessmentId && assessments.length > 0 && (
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Assessment:
          </label>
          <select
            value={selectedAssessment}
            onChange={(e) => setSelectedAssessment(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            <option value="all">All Assessments</option>
            {assessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Attempts
            </CardTitle>
            <Users className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.totalAttempts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Pass Rate
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {data?.passRate.toFixed(1) || 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Avg Score
            </CardTitle>
            <Award className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {data?.averageScore.toFixed(1) || 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Avg Time
            </CardTitle>
            <Clock className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data?.averageCompletionTime.toFixed(0) || 0}
              <span className="text-lg font-normal text-gray-500 ml-1">min</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pass/Fail Distribution */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5" />
              Pass/Fail Distribution
            </CardTitle>
            <CardDescription>
              Number of trainees passed vs failed (60% threshold)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 h-40">
              {/* Passed Bar */}
              <div className="flex-1 flex flex-col items-center justify-end">
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {data?.passedAttempts || 0}
                </div>
                <div 
                  className="w-full bg-green-500 rounded-t-md transition-all duration-500"
                  style={{ 
                    height: `${(data?.totalAttempts || 0) > 0 
                      ? ((data?.passedAttempts || 0) / (data?.totalAttempts || 1)) * 100 
                      : 0}%`,
                    minHeight: data?.passedAttempts ? '20px' : '0'
                  }}
                />
                <div className="mt-2 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Passed
                </div>
              </div>
              
              {/* Failed Bar */}
              <div className="flex-1 flex flex-col items-center justify-end">
                <div className="text-2xl font-bold text-red-600 mb-2">
                  {data?.failedAttempts || 0}
                </div>
                <div 
                  className="w-full bg-red-500 rounded-t-md transition-all duration-500"
                  style={{ 
                    height: `${(data?.totalAttempts || 0) > 0 
                      ? ((data?.failedAttempts || 0) / (data?.totalAttempts || 1)) * 100 
                      : 0}%`,
                    minHeight: data?.failedAttempts ? '20px' : '0'
                  }}
                />
                <div className="mt-2 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Failed
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5" />
              Score Distribution
            </CardTitle>
            <CardDescription>
              Distribution of scores across percentage ranges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.scoreDistribution.map((item, index) => (
                <div key={item.range} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-gray-600 dark:text-gray-400">
                    {item.range}
                  </div>
                  <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        index < 2 
                          ? "bg-red-400" 
                          : index === 2 
                            ? "bg-yellow-400" 
                            : "bg-green-400"
                      }`}
                      style={{ 
                        width: `${maxScoreCount > 0 ? (item.count / maxScoreCount) * 100 : 0}%`,
                        minWidth: item.count > 0 ? '20px' : '0'
                      }}
                    />
                  </div>
                  <div className="w-8 text-sm font-medium text-right">
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Completion Time Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Completion Time Distribution
          </CardTitle>
          <CardDescription>
            How long trainees take to complete the assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {data?.completionTimeDistribution.map((item, index) => (
              <div key={item.range} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-sm font-medium mb-1">{item.count}</div>
                <div
                  className="w-full bg-blue-500 rounded-t-md transition-all duration-500"
                  style={{ 
                    height: `${maxTimeCount > 0 ? (item.count / maxTimeCount) * 100 : 0}%`,
                    minHeight: item.count > 0 ? '20px' : '4px',
                    backgroundColor: item.count === 0 ? '#e5e7eb' : undefined
                  }}
                />
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center">
                  {item.range}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
