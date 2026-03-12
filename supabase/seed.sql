-- Run this AFTER creating users in Supabase Auth dashboard
-- HOD user: hod@cseaiml.edu / HOD@12345
-- Faculty users: faculty1@cseaiml.edu / Faculty@1, faculty2@cseaiml.edu / Faculty@2, etc.

-- Update HOD profile
update public.profiles set
  full_name = 'Dr. K. Srilatha',
  role = 'hod',
  designation = 'Head of Department',
  department = 'CSE (AI & ML)'
where email = 'hod@cseaiml.edu';

-- Update faculty profiles
update public.profiles set full_name = 'Dr. Rajesh Kumar',   faculty_id = 'FK-2024-01', designation = 'Senior Professor'       where email = 'faculty1@cseaiml.edu';
update public.profiles set full_name = 'Ms. Anitha Reddy',   faculty_id = 'FK-2024-02', designation = 'Assistant Professor'     where email = 'faculty2@cseaiml.edu';
update public.profiles set full_name = 'Mr. Suresh Babu',    faculty_id = 'FK-2024-03', designation = 'Associate Professor'     where email = 'faculty3@cseaiml.edu';
update public.profiles set full_name = 'Dr. Kavitha Nair',   faculty_id = 'FK-2024-04', designation = 'Senior Professor'        where email = 'faculty4@cseaiml.edu';
update public.profiles set full_name = 'Mr. Arjun Mehta',    faculty_id = 'FK-2024-05', designation = 'Assistant Professor'     where email = 'faculty5@cseaiml.edu';
