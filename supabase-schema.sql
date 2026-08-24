-- Kadel Labs MCQ Assessment Platform
-- Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Assessments table
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    num_questions INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attempts table
CREATE TABLE attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    trainee_name VARCHAR(255) NOT NULL,
    trainee_email VARCHAR(255) NOT NULL,
    score INTEGER,
    total_questions INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    violations JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'auto_submitted'))
);

-- Responses table
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_answer CHAR(1) CHECK (selected_answer IS NULL OR selected_answer IN ('A', 'B', 'C', 'D')),
    is_correct BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_assessments_admin_id ON assessments(admin_id);
CREATE INDEX idx_assessments_is_active ON assessments(is_active);
CREATE INDEX idx_questions_assessment_id ON questions(assessment_id);
CREATE INDEX idx_attempts_assessment_id ON attempts(assessment_id);
CREATE INDEX idx_attempts_trainee_email ON attempts(trainee_email);
CREATE INDEX idx_responses_attempt_id ON responses(attempt_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Assessments policies
-- Admins can do everything with their own assessments
CREATE POLICY "Admins can manage their assessments"
    ON assessments FOR ALL
    USING (auth.uid() = admin_id);

-- Anyone can view active assessments (for taking exams)
CREATE POLICY "Anyone can view active assessments"
    ON assessments FOR SELECT
    USING (is_active = true);

-- Questions policies
-- Admins can manage questions for their assessments
CREATE POLICY "Admins can manage questions"
    ON questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM assessments 
            WHERE assessments.id = questions.assessment_id 
            AND assessments.admin_id = auth.uid()
        )
    );

-- Anyone can view questions for active assessments (excluding correct_answer for trainees)
CREATE POLICY "Anyone can view questions for active assessments"
    ON questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM assessments 
            WHERE assessments.id = questions.assessment_id 
            AND assessments.is_active = true
        )
    );

-- Attempts policies
-- Admins can view attempts for their assessments
CREATE POLICY "Admins can view attempts"
    ON attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM assessments 
            WHERE assessments.id = attempts.assessment_id 
            AND assessments.admin_id = auth.uid()
        )
    );

-- Admins can delete attempts for their assessments
CREATE POLICY "Admins can delete attempts"
    ON attempts FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM assessments 
            WHERE assessments.id = attempts.assessment_id 
            AND assessments.admin_id = auth.uid()
        )
    );

-- Anyone can create and update their own attempts
CREATE POLICY "Anyone can create attempts"
    ON attempts FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can update their attempts"
    ON attempts FOR UPDATE
    USING (true);

CREATE POLICY "Anyone can view their own attempts"
    ON attempts FOR SELECT
    USING (true);

-- Responses policies
-- Admins can view responses for their assessments
CREATE POLICY "Admins can view responses"
    ON responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM attempts 
            JOIN assessments ON assessments.id = attempts.assessment_id
            WHERE attempts.id = responses.attempt_id 
            AND assessments.admin_id = auth.uid()
        )
    );

-- Admins can delete responses for their assessments
CREATE POLICY "Admins can delete responses"
    ON responses FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM attempts 
            JOIN assessments ON assessments.id = attempts.assessment_id
            WHERE attempts.id = responses.attempt_id 
            AND assessments.admin_id = auth.uid()
        )
    );

-- Anyone can create responses
CREATE POLICY "Anyone can create responses"
    ON responses FOR INSERT
    WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
