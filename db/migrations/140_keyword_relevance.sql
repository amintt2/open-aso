ALTER TABLE keywords ADD COLUMN IF NOT EXISTS relevance real;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS relevance_category text;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS relevance_source text;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS relevance_at timestamptz;
