-- Migration: Add scheduling and option randomization to assessments
-- Run this in your Supabase SQL Editor if you already have the database set up

-- Add scheduling columns
ALTER TABLE assessments 
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE assessments 
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add option randomization column
ALTER TABLE assessments 
ADD COLUMN IF NOT EXISTS randomize_options BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for scheduling queries
CREATE INDEX IF NOT EXISTS idx_assessments_starts_at ON assessments(starts_at);
CREATE INDEX IF NOT EXISTS idx_assessments_ends_at ON assessments(ends_at);
