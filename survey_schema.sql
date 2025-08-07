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
