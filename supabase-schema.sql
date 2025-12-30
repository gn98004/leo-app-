-- XinYou V6 schema align (gender + age_range + diaries RLS + profile_photos select)
-- Safe to run multiple times.

-- 1) profiles: add columns
alter table public.profiles
  add column if not exists gender text check (gender in ('male','female'));

alter table public.profiles
  add column if not exists age_range text;

-- 2) diaries: minimal
create table if not exists public.diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  is_public boolean default false,
  created_at timestamptz default now()
);

alter table public.diaries enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='diaries' and policyname='diaries_insert_own') then
    execute 'create policy diaries_insert_own on public.diaries for insert to authenticated with check (auth.uid() = user_id)';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='diaries' and policyname='diaries_select_own') then
    execute 'create policy diaries_select_own on public.diaries for select to authenticated using (auth.uid() = user_id)';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='diaries' and policyname='diaries_select_public') then
    execute 'create policy diaries_select_public on public.diaries for select to authenticated using (is_public = true)';
  end if;
end $$;

-- 3) profile_photos: ensure selectable by authenticated users (for encounter/public profile)
alter table public.profile_photos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profile_photos' and policyname='profile_photos_select_auth') then
    execute 'create policy profile_photos_select_auth on public.profile_photos for select to authenticated using (true)';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profile_photos' and policyname='profile_photos_insert_own') then
    -- If your owner column is profile_id (not user_id), change this policy accordingly.
    execute 'create policy profile_photos_insert_own on public.profile_photos for insert to authenticated with check (auth.uid() = user_id)';
  end if;
end $$;
-- ===========================
-- Social features: friends / blocks / reports (RLS policies)
-- 注意：若你的 blocks / reports 欄位命名不同，請依實際欄位調整 policy 內容。
-- ===========================

-- friend_requests
alter table if exists public.friend_requests enable row level security;

do $$ begin
  create policy friend_requests_insert_own
  on public.friend_requests
  for insert
  to authenticated
  with check (auth.uid() = from_user);
exception when others then null;
end $$;

do $$ begin
  create policy friend_requests_select_involving
  on public.friend_requests
  for select
  to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user);
exception when others then null;
end $$;

do $$ begin
  create policy friend_requests_update_involving
  on public.friend_requests
  for update
  to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user)
  with check (auth.uid() = from_user or auth.uid() = to_user);
exception when others then null;
end $$;

do $$ begin
  create policy friend_requests_delete_involving
  on public.friend_requests
  for delete
  to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user);
exception when others then null;
end $$;

-- friends
alter table if exists public.friends enable row level security;

do $$ begin
  create policy friends_select_involving
  on public.friends
  for select
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);
exception when others then null;
end $$;

do $$ begin
  create policy friends_insert_involving
  on public.friends
  for insert
  to authenticated
  with check (auth.uid() = user_a or auth.uid() = user_b);
exception when others then null;
end $$;

do $$ begin
  create policy friends_delete_involving
  on public.friends
  for delete
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);
exception when others then null;
end $$;

-- blocks（封鎖）
alter table if exists public.blocks enable row level security;

do $$ begin
  create policy blocks_insert_own
  on public.blocks
  for insert
  to authenticated
  with check (auth.uid() = blocker_id);
exception when others then null;
end $$;

do $$ begin
  create policy blocks_select_own
  on public.blocks
  for select
  to authenticated
  using (auth.uid() = blocker_id);
exception when others then null;
end $$;

do $$ begin
  create policy blocks_delete_own
  on public.blocks
  for delete
  to authenticated
  using (auth.uid() = blocker_id);
exception when others then null;
end $$;

-- reports（檢舉）
alter table if exists public.reports enable row level security;

do $$ begin
  create policy reports_insert_own
  on public.reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id);
exception when others then null;
end $$;

-- 建議：reports 不要開放 select 給 client（避免被濫用/外洩）
