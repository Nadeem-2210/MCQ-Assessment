"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Assessment } from "@/types";
import { formatDate, generateExamLink } from "@/lib/utils";
import { 
  Plus, Copy, ExternalLink, LogOut, FileText, Users, Clock, 
  Trash2, Edit, Loader2, MoreVertical 
} from "lucide-react";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Edit dialog state
  const [editAssessment, setEditAssessment] = useState<Assessment | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  
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
  };

  const handleEdit = async () => {
    if (!editAssessment) return;
    
    setSaving(true);
    const supabase = createClient();
    
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
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Assessment</DialogTitle>
            <DialogDescription>
              Update the assessment details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Assessment Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Assessment name"
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
              />
            </div>
          </div>
          <DialogFooter>
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
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteAssessment} onOpenChange={() => setDeleteAssessment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Assessment?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>"{deleteAssessment?.name}"</strong> along with all its questions, attempts, and responses. This action cannot be undone.
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
