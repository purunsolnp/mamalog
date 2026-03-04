-- 4. Storage Bucket 설정 (meal_images)
insert into storage.buckets (id, name, public) 
values ('meal_images', 'meal_images', true)
on conflict (id) do nothing;

-- Storage RLS 정책 설정
-- 로그인한 사용자 본인만이 자신의 폴더(user_id)에 이미지를 업로드할 수 있습니다.
drop policy if exists "Allow authenticated uploads" on storage.objects;
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'meal_images' and 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 로그인한 사용자 본인만이 자신의 이미지를 삭제/수정할 수 있습니다.
drop policy if exists "Allow authenticated update/delete" on storage.objects;
create policy "Allow authenticated update/delete"
on storage.objects for update
to authenticated
using (
  bucket_id = 'meal_images' and 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 퍼블릭 버킷이므로 누구나 읽을 수 있습니다.
drop policy if exists "Allow public read" on storage.objects;
create policy "Allow public read"
on storage.objects for select
using ( bucket_id = 'meal_images' );
