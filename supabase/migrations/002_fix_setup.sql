-- ════════════════════════════════════════════════
-- COMPLETE SETUP SQL — Run this in Supabase SQL Editor
-- This handles fresh install AND fixes existing issues
-- ════════════════════════════════════════════════

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create PROFILES table (skip if exists)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default 'New User',
  faculty_id  text unique,
  email       text not null unique,
  role        text not null default 'faculty' check (role in ('faculty', 'hod')),
  designation text,
  department  text default 'CSE (AI & ML)',
  avatar_url  text,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 3. Create LEAVE REQUESTS table (skip if exists)
create table if not exists public.leave_requests (
  id              uuid primary key default uuid_generate_v4(),
  faculty_id      uuid not null references public.profiles(id) on delete cascade,
  leave_type      text not null check (leave_type in ('personal','medical','emergency','official','other')),
  reason          text not null,
  start_datetime  timestamptz not null,
  end_datetime    timestamptz not null,
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  hod_remarks     text,
  approved_by     uuid references public.profiles(id),
  approved_at     timestamptz,
  qr_token        text unique,
  qr_generated_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 4. Create QR SCAN LOGS table (skip if exists)
create table if not exists public.qr_scan_logs (
  id               uuid primary key default uuid_generate_v4(),
  leave_request_id uuid not null references public.leave_requests(id) on delete cascade,
  faculty_id       uuid not null references public.profiles(id),
  scan_type        text not null check (scan_type in ('exit', 'reentry')),
  scanned_at       timestamptz default now(),
  scanned_by_hod   uuid references public.profiles(id),
  notes            text
);

-- 5. Enable RLS
alter table public.profiles       enable row level security;
alter table public.leave_requests enable row level security;
alter table public.qr_scan_logs   enable row level security;

-- 6. Drop existing policies if they exist (safe re-run)
drop policy if exists "profiles_self"    on public.profiles;
drop policy if exists "profiles_hod"     on public.profiles;
drop policy if exists "profiles_insert"  on public.profiles;
drop policy if exists "leave_faculty"    on public.leave_requests;
drop policy if exists "leave_hod"        on public.leave_requests;
drop policy if exists "scanlog_hod"      on public.qr_scan_logs;

-- 7. PROFILES policies (no recursive sub-queries — use auth.jwt() instead)
-- Anyone can read profiles (needed for HOD to see faculty names in requests)
create policy "profiles_read_all" on public.profiles
  for select using (auth.role() = 'authenticated');

-- Users can insert/update their own profile
create policy "profiles_own_write" on public.profiles
  for all using (auth.uid() = id);

-- HOD can update all profiles
create policy "profiles_hod_write" on public.profiles
  for update using (
    (select role from public.profiles where id = auth.uid()) = 'hod'
  );

-- 8. LEAVE REQUESTS policies
create policy "leave_faculty_own" on public.leave_requests
  for all using (faculty_id = auth.uid());

create policy "leave_hod_all" on public.leave_requests
  for all using (
    (select role from public.profiles where id = auth.uid()) = 'hod'
  );

-- 9. QR SCAN LOGS policies
create policy "scanlog_hod" on public.qr_scan_logs
  for all using (
    (select role from public.profiles where id = auth.uid()) = 'hod'
  );

create policy "scanlog_faculty_read" on public.qr_scan_logs
  for select using (faculty_id = auth.uid());

-- 10. Auto-update updated_at trigger
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_updated_at       on public.profiles;
drop trigger if exists leave_requests_updated_at on public.leave_requests;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure update_updated_at();

create trigger leave_requests_updated_at
  before update on public.leave_requests
  for each row execute procedure update_updated_at();

-- 11. Auto-create profile trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'faculty')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 12. BACKFILL: Create profiles for any users that exist in auth but NOT in profiles
-- This handles users created via the Auth dashboard before the migration was run
insert into public.profiles (id, full_name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email,
  coalesce(u.raw_user_meta_data->>'role', 'faculty')
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

-- 13. Set HOD role for specific users (update emails as needed)
update public.profiles
set role = 'hod', full_name = 'Dr. HOD', designation = 'Head of Department'
where email = 'hod@cseaiml.edu';

update public.profiles
set role = 'faculty', full_name = 'Dr. Faculty One', designation = 'Assistant Professor'
where email = 'faculty1@cseaiml.edu';

update public.profiles
set role = 'faculty', full_name = 'Dr. Faculty Two', designation = 'Assistant Professor'
where email = 'faculty2@cseaiml.edu';

-- Done! Check profiles:
select id, email, role, full_name, designation from public.profiles;
