-- Migration: Add missing columns to assessments table
-- Run this in your Supabase SQL Editor if you get "Failed to create assessment" error

-- Check if columns exist and add them if missing
DO $$ 
BEGIN
    -- Add starts_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'starts_at'
    ) THEN
        ALTER TABLE assessments ADD COLUMN starts_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;

    -- Add ends_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'ends_at'
    ) THEN
        ALTER TABLE assessments ADD COLUMN ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;

    -- Add randomize_options column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'randomize_options'
    ) THEN
        ALTER TABLE assessments ADD COLUMN randomize_options BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'assessments'
ORDER BY ordinal_position;
