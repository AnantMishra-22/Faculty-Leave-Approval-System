-- Drop policies if they already exist (makes this safe to re-run)
drop policy if exists "leave_faculty_insert" on public.leave_requests;
drop policy if exists "profiles_read_all" on public.profiles;

-- Ensure faculty can insert their own leave requests
create policy "leave_faculty_insert"
  on public.leave_requests for insert
  with check (faculty_id = auth.uid());

-- Ensure HOD can read all profiles (needed for join in PendingRequests)
create policy "profiles_read_all"
  on public.profiles for select
  using (true);
