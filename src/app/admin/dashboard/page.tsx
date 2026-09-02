"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { Assessment, ParsedQuestion } from "@/types";
import { formatDate, generateExamLink } from "@/lib/utils";
import { parseExcelFile, validateExcelStructure } from "@/lib/excel-parser";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Plus, Copy, ExternalLink, LogOut, FileText, Users, Clock, 
  Trash2, Edit, Loader2, MoreVertical, Upload, FileSpreadsheet,
  CheckCircle, AlertTriangle, RefreshCw, BarChart2, Eye
} from "lucide-react";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit dialog state
  const [editAssessment, setEditAssessment] = useState<Assessment | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  
  // Update Questions state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [parseError, setParseError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [uploadingQuestions, setUploadingQuestions] = useState(false);
  
  // Delete dialog state
  const [deleteAssessment, setDeleteAssessment] = useState<Assessment | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    const supabase = createClient();
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/admin/login");
      return;
    }

    const { data, error } = await supabase
      .from("assessments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading assessments:", error);
    } else {
      setAssessments(data || []);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const copyLink = async (assessmentId: string) => {
    const link = generateExamLink(assessmentId);
    await navigator.clipboard.writeText(link);
    setCopiedId(assessmentId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleActive = async (assessment: Assessment) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("assessments")
      .update({ is_active: !assessment.is_active })
      .eq("id", assessment.id);

    if (!error) {
      setAssessments(assessments.map(a => 
        a.id === assessment.id ? { ...a, is_active: !a.is_active } : a
      ));
    }
  };

  const openEditDialog = (assessment: Assessment) => {
    setEditAssessment(assessment);
    setEditName(assessment.name);
    setEditDuration(assessment.duration_minutes);
    // Reset question upload state
    setUploadFile(null);
    setParsedQuestions([]);
    setParseError("");
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setParseError("");
    setValidationErrors([]);
    setParsedQuestions([]);
    setParsing(true);

    try {
      const questions = await parseExcelFile(file);
      const validation = validateExcelStructure(questions);
      
      if (!validation.valid) {
        setValidationErrors(validation.errors);
      }
      
      setParsedQuestions(questions);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse Excel file");
    } finally {
      setParsing(false);
    }
  };

  const handleEdit = async () => {
    if (!editAssessment) return;
    
    setSaving(true);
    const supabase = createClient();
    
    // Update assessment details
    const { error } = await supabase
      .from("assessments")
      .update({ 
        name: editName.trim(),
        duration_minutes: editDuration 
      })
      .eq("id", editAssessment.id);

    if (!error) {
      setAssessments(assessments.map(a => 
        a.id === editAssessment.id 
          ? { ...a, name: editName.trim(), duration_minutes: editDuration } 
          : a
      ));
      setEditAssessment(null);
    }
    setSaving(false);
  };

  const handleUpdateQuestions = async () => {
    if (!editAssessment || parsedQuestions.length === 0 || validationErrors.length > 0) return;

    setUploadingQuestions(true);
    const supabase = createClient();

    try {
      // Delete existing questions
      await supabase
        .from("questions")
        .delete()
        .eq("assessment_id", editAssessment.id);

      // Insert new questions
      const questionsToInsert = parsedQuestions.map((q, index) => ({
        assessment_id: editAssessment.id,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        order_index: index + 1,
      }));

      const { error: insertError } = await supabase
        .from("questions")
        .insert(questionsToInsert);

      if (insertError) throw insertError;

      // Update assessment question count
      await supabase
        .from("assessments")
        .update({ num_questions: parsedQuestions.length })
        .eq("id", editAssessment.id);

      // Update local state
      setAssessments(assessments.map(a => 
        a.id === editAssessment.id 
          ? { ...a, num_questions: parsedQuestions.length } 
          : a
      ));
      
      // Close dialog and reset
      setEditAssessment(null);
      setUploadFile(null);
      setParsedQuestions([]);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to update questions");
    } finally {
      setUploadingQuestions(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteAssessment) return;
    
    setDeleting(true);
    const supabase = createClient();

    // Delete responses first
    const { data: attempts } = await supabase
      .from("attempts")
      .select("id")
      .eq("assessment_id", deleteAssessment.id);

    if (attempts) {
      for (const attempt of attempts) {
        await supabase.from("responses").delete().eq("attempt_id", attempt.id);
      }
    }

    // Delete attempts
    await supabase.from("attempts").delete().eq("assessment_id", deleteAssessment.id);
    
    // Delete questions
    await supabase.from("questions").delete().eq("assessment_id", deleteAssessment.id);
    
    // Delete assessment
    const { error } = await supabase
      .from("assessments")
      .delete()
      .eq("id", deleteAssessment.id);

    if (!error) {
      setAssessments(assessments.filter(a => a.id !== deleteAssessment.id));
    }
    
    setDeleting(false);
    setDeleteAssessment(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">K</span>
            </div>
            <div>
              <h1 className="font-bold text-xl text-gray-900">Kadel Labs</h1>
              <p className="text-xs text-gray-500">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/analytics">
              <Button variant="outline">
                <BarChart2 className="w-4 h-4 mr-2" />
                Analytics
              </Button>
            </Link>
            <ThemeToggle />
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Assessments
              </CardTitle>
              <FileText className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{assessments.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Assessments
              </CardTitle>
              <Clock className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {assessments.filter(a => a.is_active).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Questions
              </CardTitle>
              <Users className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {assessments.reduce((sum, a) => sum + a.num_questions, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assessments Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Assessments</CardTitle>
              <CardDescription>
                Manage your MCQ assessments
              </CardDescription>
            </div>
            <Link href="/admin/assessments/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Assessment
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              </div>
            ) : assessments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No assessments yet</p>
                <Link href="/admin/assessments/new">
                  <Button>Create your first assessment</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-medium">
                        {assessment.name}
                      </TableCell>
                      <TableCell>{assessment.num_questions}</TableCell>
                      <TableCell>{assessment.duration_minutes} min</TableCell>
                      <TableCell>
                        <Badge
                          variant={assessment.is_active ? "success" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => toggleActive(assessment)}
                        >
                          {assessment.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatDate(assessment.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyLink(assessment.id)}
                          >
                            {copiedId === assessment.id ? (
                              "Copied!"
                            ) : (
                              <>
                                <Copy className="w-4 h-4 mr-1" />
                                Link
                              </>
                            )}
                          </Button>
                          <Link href={`/admin/assessments/${assessment.id}`}>
                            <Button variant="outline" size="sm">
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(assessment)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteAssessment(assessment)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editAssessment} onOpenChange={() => setEditAssessment(null)}>
        <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Assessment</DialogTitle>
            <DialogDescription>
              Update assessment details and questions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Details Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Edit className="w-4 h-4" />
                Assessment Details
              </h3>
              <div className="grid gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Assessment Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Assessment name"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-duration">Duration (minutes)</Label>
                  <Input
                    id="edit-duration"
                    type="number"
                    min={1}
                    max={180}
                    value={editDuration}
                    onChange={(e) => setEditDuration(parseInt(e.target.value) || 30)}
                    className="bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="border-t" />

            {/* Update Questions Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Update Questions
                <span className="text-sm font-normal text-gray-500">
                  (Current: {editAssessment?.num_questions} questions)
                </span>
              </h3>
              
              <div className="pl-6 space-y-4">
                {/* Info Alert */}
                <Alert className="bg-blue-50 border-blue-200">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 text-sm">
                    Upload a new Excel file to replace all existing questions. Past attempt scores will remain unchanged.
                  </AlertDescription>
                </Alert>

                {/* File Upload */}
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-blue-400 transition-colors bg-gray-50">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="question-file-edit"
                  />
                  <label htmlFor="question-file-edit" className="cursor-pointer">
                    {parsing ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <span className="text-sm text-gray-600">Parsing file...</span>
                      </div>
                    ) : uploadFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 text-green-500" />
                        <span className="text-sm font-medium text-gray-900">{uploadFile.name}</span>
                        <span className="text-xs text-gray-500">Click to change file</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Click to upload Excel file
                        </span>
                        <span className="text-xs text-gray-500">.xlsx or .xls files</span>
                      </div>
                    )}
                  </label>
                </div>

                {/* Parse Error */}
                {parseError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{parseError}</AlertDescription>
                  </Alert>
                )}

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1">
                        {validationErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Success Preview */}
                {parsedQuestions.length > 0 && validationErrors.length === 0 && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      <strong>{parsedQuestions.length} questions</strong> ready to upload. 
                      This will replace the current {editAssessment?.num_questions} questions.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Update Questions Button */}
                {parsedQuestions.length > 0 && validationErrors.length === 0 && (
                  <Button 
                    onClick={handleUpdateQuestions}
                    disabled={uploadingQuestions}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {uploadingQuestions ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Questions...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Update Questions ({parsedQuestions.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setEditAssessment(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving || !editName.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Details"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteAssessment} onOpenChange={() => setDeleteAssessment(null)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Delete Assessment?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>&quot;{deleteAssessment?.name}&quot;</strong> along with all its questions, attempts, and responses. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAssessment(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Assessment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
