-- 0. USER(Profile) Table
-- Supabase의 auth.users 테이블과 연동되는 프로필 테이블입니다.
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  provider text, -- 카카오, 구글 등
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1. MEAL_LOG Table (식단 기록)
create table if not exists public.meal_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  meal_type text not null, -- '아침', '간식1', '점심', '간식2', '저녁' 등의 값 저장
  nutrition jsonb, -- { carbs: 0, protein: 0, fat: 0, vitamins: 0 } 등
  satisfaction integer check (satisfaction >= 1 and satisfaction <= 5), -- 1(거부) ~ 5(완밥)
  note_text text,
  handwritten_image_url text, -- 스토리지에 업로드된 캔버스 필기 이미지 URL
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. INVENTORY Table (냉장고 재료 관리)
create table if not exists public.inventory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  ingredient_name text not null,
  expiry_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. PHOTO_LOG Table (추가 식단/아이 사진 기록용)
create table if not exists public.photo_logs (
  id uuid default gen_random_uuid() primary key,
  meal_log_id uuid references public.meal_logs(id) on delete cascade not null,
  image_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- -----------------------------------------------------
-- RLS (Row Level Security) 설정
-- 가장 중요: 본인의 데이터만 조회/수정 가능하도록 설정합니다.
-- -----------------------------------------------------

alter table public.profiles enable row level security;
alter table public.meal_logs enable row level security;
alter table public.inventory enable row level security;
alter table public.photo_logs enable row level security;

-- Profiles 정책
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using ( auth.uid() = id );

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using ( auth.uid() = id );

-- 트리거: 새로운 유저 로그인/가입 시 자동으로 public.profiles에 레코드 추가 (선택사항이나 권장됨)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Meal Logs 정책
drop policy if exists "Users can manage own meal logs" on public.meal_logs;
create policy "Users can manage own meal logs" on public.meal_logs for all using ( auth.uid() = user_id );

-- Inventory 정책
drop policy if exists "Users can manage own inventory" on public.inventory;
create policy "Users can manage own inventory" on public.inventory for all using ( auth.uid() = user_id );

-- Photo Logs 정책 (자신의 Meal Log에 속한 사진만 관리)
drop policy if exists "Users can manage own photo logs" on public.photo_logs;
create policy "Users can manage own photo logs" on public.photo_logs for all using (
  exists (
    select 1 from public.meal_logs
    where meal_logs.id = photo_logs.meal_log_id
    and meal_logs.user_id = auth.uid()
  )
);
