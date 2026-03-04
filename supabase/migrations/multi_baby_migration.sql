-- 1. Create Babies Table
create table if not exists public.babies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  birthday date not null,
  gender text check (gender in ('남자', '여자')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS for Babies
alter table public.babies enable row level security;
drop policy if exists "Users can manage own babies" on public.babies;
create policy "Users can manage own babies" on public.babies for all using ( auth.uid() = user_id );

-- 3. Migrate existing profile-level baby data to babies table
insert into public.babies (user_id, name, birthday, gender)
select id, baby_name, baby_birthday, baby_gender
from public.profiles
where baby_name is not null;

-- 4. Update Meal Logs to link to babies
alter table public.meal_logs add column if not exists baby_id uuid references public.babies(id) on delete cascade;

-- Link existing logs to the first baby of each user
update public.meal_logs
set baby_id = (select id from public.babies where babies.user_id = meal_logs.user_id limit 1)
where baby_id is null;

-- 5. Update Daily Summaries to link to babies
alter table public.daily_summaries add column if not exists baby_id uuid references public.babies(id) on delete cascade;

-- Link existing summaries to the first baby
update public.daily_summaries
set baby_id = (select id from public.babies where babies.user_id = daily_summaries.user_id limit 1)
where baby_id is null;

-- 6. Update Daily Summaries unique constraint
alter table public.daily_summaries drop constraint if exists daily_summaries_user_id_date_key;
alter table public.daily_summaries add constraint daily_summaries_baby_id_date_unique unique (baby_id, date);

-- 7. (Optional but recommended) Remove deprecated columns from profiles after verification
-- alter table public.profiles drop column baby_name;
-- alter table public.profiles drop column baby_birthday;
-- alter table public.profiles drop column baby_gender;
