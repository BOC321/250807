-- Database schema for survey application

-- Survey definition tables
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  ranges_overall_version_id UUID,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published, archived
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id),
  title TEXT NOT NULL,
  description TEXT,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  ranges_version_id UUID,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id),
  type TEXT NOT NULL, -- single, multi, scale, text
  prompt TEXT NOT NULL,
  choices JSONB, -- [{id, label, value}]
  max_score NUMERIC NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  required BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  help_text TEXT,
  scorable BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE range_set_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL, -- category, overall
  bands JSONB, -- [{min, max, label, html_content}]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Response tables
CREATE TABLE respondents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id),
  survey_version INTEGER NOT NULL,
  email TEXT,
  meta JSONB, -- UTM params, source, etc.
  consent BOOLEAN NOT NULL DEFAULT false,
  consent_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  respondent_id UUID NOT NULL REFERENCES respondents(id),
  question_id UUID NOT NULL REFERENCES questions(id),
  value JSONB, -- answer value (could be text, number, array for multi-select)
  presented_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  respondent_id UUID NOT NULL REFERENCES respondents(id),
  per_category JSONB, -- [{category_id, score, max, percent, band_id}]
  overall JSONB, -- {score, max, percent, band_id}
  completed_count INTEGER NOT NULL,
  scorable_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report assets for PDF generation
CREATE TABLE report_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id),
  category_id UUID REFERENCES categories(id),
  band_id UUID,
  asset_type TEXT NOT NULL, -- image, chart, etc.
  asset_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Survey snapshots for immutability
CREATE TABLE survey_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create score_ranges table
CREATE TABLE IF NOT EXISTS public.score_ranges (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
    category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
    min_score integer NOT NULL,
    max_score integer NOT NULL,
    color varchar(7) NOT NULL, -- Hex color code (e.g., #FF0000)
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT score_ranges_min_max_check CHECK (min_score >= 0 AND max_score <= 100 AND min_score < max_score),
    CONSTRAINT score_ranges_survey_category_unique UNIQUE (survey_id, category_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_score_ranges_survey_id ON public.score_ranges(survey_id);
CREATE INDEX IF NOT EXISTS idx_score_ranges_category_id ON public.score_ranges(category_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_score_ranges_updated_at 
    BEFORE UPDATE ON public.score_ranges 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add RLS policies
ALTER TABLE public.score_ranges ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read score ranges
CREATE POLICY "Allow authenticated users to read score ranges" ON public.score_ranges
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy to allow authenticated users to insert score ranges
CREATE POLICY "Allow authenticated users to insert score_ranges" ON public.score_ranges
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy to allow authenticated users to update score ranges
CREATE POLICY "Allow authenticated users to update score ranges" ON public.score_ranges
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy to allow authenticated users to delete score ranges
CREATE POLICY "Allow authenticated users to delete score ranges" ON public.score_ranges
    FOR DELETE USING (auth.role() = 'authenticated');
