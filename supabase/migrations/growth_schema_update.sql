-- Profiles 테이블 확장 (아이 정보)
alter table public.profiles 
add column if not exists baby_name text,
add column if not exists baby_birthday date,
add column if not exists baby_gender text check (baby_gender in ('남자', '여자'));

-- Daily Summaries 테이블 확장 (몸무게 및 신장 기록)
alter table public.daily_summaries
add column if not exists weight_kg numeric(4,2),
add column if not exists height_cm numeric(4,1);

