import * as XLSX from 'xlsx';
import { ParsedQuestion } from '@/types';

export function parseExcelFile(file: File): Promise<ParsedQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        // Skip header row
        const questions: ParsedQuestion[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // Skip empty rows
          if (!row || row.length < 6 || !row[0]) continue;
          
          const correctAnswer = String(row[5]).toUpperCase().trim();
          
          // Validate correct answer
          if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
            throw new Error(`Invalid correct answer "${row[5]}" at row ${i + 1}. Must be A, B, C, or D.`);
          }
          
          questions.push({
            question_text: String(row[0]).trim(),
            option_a: String(row[1]).trim(),
            option_b: String(row[2]).trim(),
            option_c: String(row[3]).trim(),
            option_d: String(row[4]).trim(),
            correct_answer: correctAnswer as 'A' | 'B' | 'C' | 'D',
          });
        }
        
        if (questions.length === 0) {
          throw new Error('No valid questions found in the Excel file.');
        }
        
        resolve(questions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the file.'));
    };

    reader.readAsBinaryString(file);
  });
}

export function validateExcelStructure(questions: ParsedQuestion[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  questions.forEach((q, index) => {
    const rowNum = index + 2; // +2 because of 0-index and header row
    
    if (!q.question_text) {
      errors.push(`Row ${rowNum}: Question text is empty`);
    }
    if (!q.option_a) {
      errors.push(`Row ${rowNum}: Option A is empty`);
    }
    if (!q.option_b) {
      errors.push(`Row ${rowNum}: Option B is empty`);
    }
    if (!q.option_c) {
      errors.push(`Row ${rowNum}: Option C is empty`);
    }
    if (!q.option_d) {
      errors.push(`Row ${rowNum}: Option D is empty`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
