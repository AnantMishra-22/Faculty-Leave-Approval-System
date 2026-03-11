# Faculty Leave Approval System — Full Implementation Prompt
> Paste this entire file as your prompt into **Bolt / Lovable / Cursor / Windsurf** or any AI coding agent (Claude Sonnet 4.5+ recommended).

---

## 🎯 MISSION

You are implementing a **production-ready Faculty Leave Approval System** for the **CSE (AI & ML) Department** at CMR Technical Campus. A pixel-perfect HTML design prototype already exists (login page, faculty dashboard, HOD dashboard). Your job is to:

1. Faithfully convert all three screens into a working **React + TypeScript** application — **the UI/UX must not deviate from the provided HTML designs at all**.
2. Build a complete **Supabase backend** (auth + database + row-level security).
3. Implement all dynamic features: QR code generation, QR scanning, PDF report export.
4. Deploy-ready for **Vercel** (frontend) + **Supabase** (DB + auth).

---

## 🎨 DESIGN TOKENS (must be preserved exactly)

```
Primary color:        #ec5b13  (orange)
Background light:     #f8f6f6
Background dark:      #221610
Font family:          'Public Sans', sans-serif
Icons:                Material Symbols Outlined
Border radius:        0.25rem (default), 0.5rem (lg), 0.75rem (xl)
Card style:           bg-white dark:bg-slate-900, shadow-sm, border border-slate-100
Focus ring:           ring-2 ring-primary
```

---

## 🗂️ PROJECT STRUCTURE

```
/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx                # → redirects to /login
│   │   ├── login/page.tsx
│   │   ├── faculty/
│   │   │   └── page.tsx            # Faculty Dashboard (protected)
│   │   └── hod/
│   │       └── page.tsx            # HOD Dashboard (protected)
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginForm.tsx
│   │   ├── faculty/
│   │   │   ├── LeaveRequestForm.tsx
│   │   │   ├── LeaveHistory.tsx
│   │   │   └── ApprovedLeaveCard.tsx
│   │   ├── hod/
│   │   │   ├── PendingRequests.tsx
│   │   │   ├── FacultyManagement.tsx
│   │   │   ├── QRScanner.tsx
│   │   │   ├── ScanLog.tsx
│   │   │   └── ReportGenerator.tsx
│   │   └── ui/
│   │       ├── Header.tsx
│   │       ├── BottomNav.tsx
│   │       └── Modal.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── qr.ts                   # QR generation helpers
│   │   └── pdf.ts                  # PDF report generation
│   ├── types/
│   │   └── index.ts
│   └── middleware.ts               # Auth route protection
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
├── .env.local.example
├── next.config.ts
└── package.json
```

---

## 🛠️ TECH STACK

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS (exact config from design) |
| Auth + DB | Supabase (auth + postgres + RLS) |
| QR Generation | `qrcode.react` + `qrcode` (node) |
| QR Scanning | `html5-qrcode` |
| PDF Export | `jsPDF` + `jspdf-autotable` |
| Icons | Material Symbols Outlined (Google Fonts CDN) |
| Deployment | Vercel (frontend) + Supabase (backend) |

---

## 🗄️ SUPABASE SCHEMA

Create this migration in `supabase/migrations/001_initial_schema.sql`:

```sql
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
```

Also create `supabase/seed.sql` with realistic seed data:

```sql
-- Run this AFTER creating users in Supabase Auth dashboard
-- Replace UUIDs with actual auth user IDs after creating them

-- HOD user (create in Auth dashboard: hod@cseaiml.edu / HOD@12345)
-- Faculty users (create in Auth dashboard: faculty1@cseaiml.edu / Faculty@1 etc.)

-- Update HOD profile
update public.profiles set
  full_name = 'Dr. Priya Sharma',
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
```

---

## 🔐 AUTHENTICATION FLOW

### `src/middleware.ts`
```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  if (!session && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && pathname === '/login') {
    // Fetch role and redirect accordingly
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const redirect = profile?.role === 'hod' ? '/hod' : '/faculty'
    return NextResponse.redirect(new URL(redirect, req.url))
  }

  // Protect role-specific routes
  if (session && pathname.startsWith('/hod')) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'hod') return NextResponse.redirect(new URL('/faculty', req.url))
  }

  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
```

---

## 📄 PAGE IMPLEMENTATIONS

### Login Page (`/login`)

Pixel-perfect match to `login_page/code.html`. Key implementation details:

- **Logo**: CMR Technical Campus logo (place in `/public/logo.png`)
- **Title**: "Faculty Leave Approval System" + "CSE (AI & ML) Department" in primary orange
- **Email + password fields** with Material icons inside inputs
- **Remember me checkbox** + **Forgot password link**
- **"Login to Dashboard" button** in primary orange with login arrow icon
- **Mock credentials hint card** at bottom (collapsible, shows: hod@cseaiml.edu / HOD@12345 and faculty1@cseaiml.edu / Faculty@1)
- On submit: call `supabase.auth.signInWithPassword()`, fetch profile role, redirect to `/faculty` or `/hod`
- Show inline error on wrong credentials
- Show loading spinner on the button while authenticating

---

### Faculty Dashboard (`/faculty`)

Pixel-perfect match to `faculty_dashboard/code.html`. Implement these sections:

#### Header
- CMR logo (left) + "Faculty Dashboard" title + department subtitle
- Notification bell icon (right) + profile avatar with logout option on click

#### Profile Card
- Faculty avatar (circular, with `ring-2 ring-primary/20`)
- Name, designation, faculty ID
- Two badges: `Active` (green) and `X Leaves Left` (primary orange)
- Leaves remaining = 12 minus count of approved leaves this month

#### New Leave Request Form (card section)
Fields:
- **Leave Type** (select): Personal / Medical / Emergency / Official / Other
- **Start Date + Time** (datetime-local input)
- **Expected Return Date + Time** (datetime-local input)
- **Reason** (textarea, 3 rows)
- **Submit** button (full width, primary orange)

On submit:
1. Insert into `leave_requests` table with `status = 'pending'`
2. Show success toast notification
3. Refresh leave history

#### Approved Leaves — Horizontal scroll cards
- One card per approved leave request
- Card has left border in `border-l-4 border-l-green-500`
- Shows: date range, leave type, duration, verified icon
- **"View QR Code" button** — opens a modal showing:
  - QR code image generated from JSON: `{ leaveId, facultyId, facultyName, facultyIdCode, approvedAt, leaveType }`
  - QR code generated using `qrcode.react` `<QRCodeSVG>` component, size 200px
  - "Download QR" button saves the QR as PNG
  - Instructions: "Show this QR to HOD when leaving and returning"

#### Leave History Table (bottom section)
Columns: Date | Type | Duration | Status | Action
- Status badges: `Pending` (yellow), `Approved` (green), `Rejected` (red)
- Paginated (5 per page)
- Pull from `leave_requests` table filtered by `faculty_id = auth.uid()`

#### Bottom Navigation (fixed)
4 tabs: Home | My Leaves | New Request | Profile
Active tab highlighted in primary orange

---

### HOD Dashboard (`/hod`)

Pixel-perfect match to `hod_dashboard/code.html`. Implement these tabs in bottom nav:

**Bottom Nav tabs**: Requests | Faculty | Scanner | Reports

---

#### TAB 1: Pending Requests

- Top stat cards: Total Pending | Approved Today | Total Faculty
- List of leave requests (all faculty) with status filter (All / Pending / Approved / Rejected)
- Each request card shows:
  - Faculty avatar + name + faculty ID
  - Leave type badge, date range, duration
  - Reason text (truncated, expandable)
  - **Approve** button (green) + **Reject** button (red) — only visible for `pending` status
  - For pending: shows timestamp of submission

On **Approve**:
1. Generate a UUID `qr_token`
2. Update `leave_requests` set `status = 'approved'`, `approved_by`, `approved_at`, `qr_token`, `qr_generated_at`
3. Show success toast
4. Refresh list

On **Reject**:
1. Show a small modal asking for rejection reason (textarea)
2. Update `leave_requests` set `status = 'rejected'`, `hod_remarks`

---

#### TAB 2: Faculty Management

- Search bar to filter faculty by name or ID
- Table: Name | Faculty ID | Email | Designation | Status | Actions
- **Add Faculty** button (top right, primary orange) — opens modal:
  - Full Name, Email, Password (for Supabase Auth), Faculty ID, Designation
  - On submit: call `supabase.auth.admin.createUser()` (use Supabase service role key in a Next.js API route `/api/admin/create-faculty`)
  - Then update the auto-created profile with the extra fields
- **Edit** icon per row — opens pre-filled modal to edit: Full Name, Faculty ID, Designation, Active status
- **Deactivate/Activate** toggle per row (updates `is_active`)

> ⚠️ The Add Faculty API route must use `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never expose to client).

---

#### TAB 3: QR Scanner

UI layout:
- Title: "QR Code Scanner" with subtitle "Scan faculty leave QR codes"
- **Camera viewfinder** — square, rounded corners, with animated scanning line
- **Mode indicator**: current scan will be logged as `exit` or `reentry` (auto-determined by last scan for that leave)
- Below scanner: real-time scan log table

Implementation:
```typescript
// Use html5-qrcode library
import { Html5QrcodeScanner } from 'html5-qrcode'

// QR payload structure (what gets encoded in the QR):
interface QRPayload {
  leaveId: string       // leave_requests.id
  facultyId: string     // profiles.id
  facultyName: string
  facultyIdCode: string // e.g. FK-2024-01
  approvedAt: string
  leaveType: string
}
```

On successful scan:
1. Parse the JSON from QR
2. Verify `leaveId` exists in `leave_requests` with `status = 'approved'` and matching `qr_token`
3. Check last scan log for this `leave_request_id`:
   - If no previous scan or last was `reentry` → log as `exit`
   - If last was `exit` → log as `reentry`
4. Insert into `qr_scan_logs`
5. Show animated success card:
   - Faculty name + ID
   - Scan type: "✅ Exit Logged" (orange) or "🏠 Re-entry Logged" (green)
   - Timestamp

**Scan History Table** (below scanner, last 20 entries):
Columns: Faculty Name | Faculty ID | Event (Exit/Re-entry) | Date & Time | Leave Type

---

#### TAB 4: Report Generator

UI:
- Month picker (month + year dropdowns)
- "Generate Report" button (primary orange)
- Report preview table (rendered in page before download)
- "Download PDF" button

Table columns:
| Faculty Name | Faculty ID | Email | Leaves Taken | Times Exceeded 1-Hour Limit |

**"Times Exceeded 1-Hour Limit" calculation**:
- For each approved leave in the selected month, calculate actual duration using scan logs:
  - Find exit scan → find next reentry scan for same leave
  - `actual_duration = reentry.scanned_at - exit.scanned_at`
  - If `actual_duration > 1 hour` → count as exceeded
- Count per faculty how many times `actual_duration > 60 minutes`

**PDF Generation** (use `jsPDF` + `jspdf-autotable`):
```typescript
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const generatePDF = (data: ReportRow[], month: string) => {
  const doc = new jsPDF()
  
  // Header
  doc.setFontSize(16)
  doc.setTextColor('#ec5b13')
  doc.text('CMR Technical Campus', 105, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor('#000000')
  doc.text('CSE (AI & ML) Department — Faculty Leave Report', 105, 30, { align: 'center' })
  doc.setFontSize(10)
  doc.setTextColor('#666666')
  doc.text(`Report for: ${month}`, 105, 38, { align: 'center' })
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 105, 44, { align: 'center' })

  // Table
  autoTable(doc, {
    startY: 52,
    head: [['Faculty Name', 'Faculty ID', 'Email', 'Leaves Taken', 'Exceeded 1hr Limit']],
    body: data.map(r => [r.fullName, r.facultyId, r.email, r.leaveCount, r.exceededCount]),
    headStyles: { fillColor: [236, 91, 19], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 248, 245] },
    styles: { fontSize: 9, cellPadding: 4 },
  })

  doc.save(`Leave_Report_${month.replace(' ', '_')}.pdf`)
}
```

---

## 📦 PACKAGE.JSON DEPENDENCIES

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "qrcode.react": "^3.1.0",
    "qrcode": "^1.5.3",
    "html5-qrcode": "^2.3.8",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.2",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## ⚙️ TAILWIND CONFIG

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#ec5b13',
        'background-light': '#f8f6f6',
        'background-dark': '#221610',
      },
      fontFamily: {
        display: ['Public Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
export default config
```

---

## 🌐 ENVIRONMENT VARIABLES

Create `.env.local` (and `.env.local.example` for the repo):

```bash
# Supabase (public — safe for client)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase service role — SERVER SIDE ONLY, never expose to client
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🚀 VERCEL DEPLOYMENT SETUP

Add a `vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@next_public_supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@next_public_supabase_anon_key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_role_key"
  }
}
```

Add a `next.config.ts`:
```typescript
const nextConfig = {
  images: {
    domains: ['your-project-id.supabase.co', 'lh3.googleusercontent.com'],
  },
}
export default nextConfig
```

---

## 🔑 ADMIN API ROUTE (Add Faculty)

Create `src/app/api/admin/create-faculty/route.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { email, password, fullName, facultyId, designation } = await req.json()

  // Verify requester is HOD (validate session from cookie)
  // ... session check here ...

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'faculty' }
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Update the auto-created profile
  await supabaseAdmin.from('profiles').update({
    faculty_id: facultyId,
    designation,
    full_name: fullName
  }).eq('id', data.user.id)

  return NextResponse.json({ success: true, userId: data.user.id })
}
```

---

## ✅ IMPLEMENTATION CHECKLIST

Work through these in order:

- [ ] Initialize Next.js 14 project with TypeScript + Tailwind
- [ ] Configure Tailwind with exact design tokens above
- [ ] Add Google Fonts (Public Sans + Material Symbols) to `layout.tsx`
- [ ] Set up Supabase client (`src/lib/supabase/client.ts` and `server.ts`)
- [ ] Run SQL migration in Supabase dashboard
- [ ] Implement middleware for auth + role-based routing
- [ ] Build Login page (pixel-perfect to design)
- [ ] Build Faculty Dashboard (pixel-perfect):
  - [ ] Profile card (live data from Supabase)
  - [ ] Leave request form (inserts to DB)
  - [ ] Approved leaves with QR code modal
  - [ ] Leave history table
  - [ ] Bottom nav
- [ ] Build HOD Dashboard (pixel-perfect):
  - [ ] Tab 1: Pending requests with approve/reject
  - [ ] Tab 2: Faculty management (add/edit)
  - [ ] Tab 3: QR scanner with scan log
  - [ ] Tab 4: Report generator with PDF export
- [ ] Admin API route for creating faculty
- [ ] Add `.env.local.example` and `vercel.json`
- [ ] Test all flows end-to-end with seed data

---

## 🧪 TEST CREDENTIALS (after seeding)

| Role | Email | Password |
|------|-------|----------|
| HOD | hod@cseaiml.edu | HOD@12345 |
| Faculty 1 | faculty1@cseaiml.edu | Faculty@1 |
| Faculty 2 | faculty2@cseaiml.edu | Faculty@2 |
| Faculty 3 | faculty3@cseaiml.edu | Faculty@3 |

---

## ⚠️ CRITICAL RULES

1. **Never deviate from the HTML design** — colors, fonts, spacing, card styles, border radii must match exactly.
2. **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client** — only use in API routes.
3. **QR payload must be JSON**, not a plain string — parse it on scan.
4. **QR scanner must handle camera permissions gracefully** — show a clear error if camera is denied.
5. **All Supabase queries must use RLS** — never bypass it from the client.
6. **PDF download must work in browser** — use `jsPDF`'s `doc.save()`, not server-side rendering.
7. **The login page must show a collapsible mock credentials card** for demo purposes.
8. **Dark mode** must be supported everywhere (use `dark:` Tailwind classes as in the original design).
