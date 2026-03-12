-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  faculty_id  text unique,                  -- e.g. FK-2024-01, null for HOD
  email       text not null unique,
  role        text not null check (role in ('faculty', 'hod')),
  designation text,                         -- e.g. "Senior Professor"
  department  text default 'CSE (AI & ML)',
  avatar_url  text,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- LEAVE REQUESTS
-- ─────────────────────────────────────────────
create table public.leave_requests (
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
  qr_token        text unique,              -- UUID token embedded in QR
  qr_generated_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─────────────────────────────────────────────
-- QR SCAN LOGS
-- ─────────────────────────────────────────────
create table public.qr_scan_logs (
  id              uuid primary key default uuid_generate_v4(),
  leave_request_id uuid not null references public.leave_requests(id) on delete cascade,
  faculty_id      uuid not null references public.profiles(id),
  scan_type       text not null check (scan_type in ('exit', 'reentry')),
  scanned_at      timestamptz default now(),
  scanned_by_hod  uuid references public.profiles(id),
  notes           text
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.leave_requests  enable row level security;
alter table public.qr_scan_logs    enable row level security;

-- profiles: users see their own; HOD sees all
create policy "profiles_self"   on public.profiles for select using (auth.uid() = id);
create policy "profiles_hod"    on public.profiles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'hod')
);

-- leave_requests: faculty sees own; HOD sees all
create policy "leave_faculty"   on public.leave_requests for all using (faculty_id = auth.uid());
create policy "leave_hod"       on public.leave_requests for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'hod')
);

-- qr_scan_logs: HOD only
create policy "scanlog_hod"     on public.qr_scan_logs for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'hod')
);

-- ─────────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at        before update on public.profiles        for each row execute procedure update_updated_at();
create trigger leave_requests_updated_at  before update on public.leave_requests  for each row execute procedure update_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'faculty')
  );
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();
