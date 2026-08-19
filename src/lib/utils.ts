import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateExamLink(assessmentId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/exam/${assessmentId}/register`;
  }
  return `/exam/${assessmentId}/register`;
}

export function calculateScore(
  answers: Record<string, 'A' | 'B' | 'C' | 'D' | null>,
  questions: { id: string; correct_answer: 'A' | 'B' | 'C' | 'D' }[]
): number {
  let correct = 0;
  questions.forEach((q) => {
    if (answers[q.id] === q.correct_answer) {
      correct++;
    }
  });
  return correct;
}
