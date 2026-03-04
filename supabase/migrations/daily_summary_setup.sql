-- 4. DAILY_SUMMARIES Table (일간 요약: 수분, 수면 등)
-- 이 테이블은 날짜별로 아이의 총 수분 섭취량과 수면 시간을 기록합니다.
create table if not exists public.daily_summaries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  water_ml integer default 0,
  sleep_hours numeric(3,1) default 0,
  growth_status text default '양호함', -- '양호함', '주의', '정체' 등
  note_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, date)
);

-- RLS (Row Level Security) 설정
alter table public.daily_summaries enable row level security;

-- 정책: 자신의 기록만 관리 가능
drop policy if exists "Users can manage own daily summaries" on public.daily_summaries;
create policy "Users can manage own daily summaries" on public.daily_summaries for all using ( auth.uid() = user_id );
