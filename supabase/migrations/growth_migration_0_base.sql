-- Growth Chart Data Migration
CREATE TABLE IF NOT EXISTS public.growth_charts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    gender text NOT NULL CHECK (gender IN ('남자', '여자')),
    height_cm numeric(4,1) NOT NULL,
    p3 numeric(5,2), p5 numeric(5,2), p10 numeric(5,2), p25 numeric(5,2), p50 numeric(5,2), p75 numeric(5,2), p90 numeric(5,2), p95 numeric(5,2), p97 numeric(5,2),
    created_at timestamptz DEFAULT now(),
    UNIQUE(gender, height_cm)
);

TRUNCATE public.growth_charts;

