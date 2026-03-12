# Faculty Leave Approval System — Implementation Fix Prompt

> **Model:** Claude Sonnet 4.6  
> **Project:** Next.js 14 + Supabase + TypeScript  
> **Scope:** 6 targeted fixes across API, UI, QR, and camera scanning

---

## Project Context

This is a Next.js 14 App Router project using Supabase (SSR) for auth and data. Key files:

- `lib/supabase/client.ts` — browser Supabase client (`createBrowserClient`)
- `lib/supabase/server.ts` — server Supabase client (`createServerClient` with cookies)
- `types/index.ts` — shared TypeScript types (`Profile`, `LeaveRequest`, `QRPayload`, etc.)
- `lib/qr.ts` — `buildQRPayload()` and `parseQRPayload()` helpers
- `supabase/migrations/001_initial_schema.sql` — full DB schema

**DB Schema (relevant tables):**
```
profiles: id, full_name, faculty_id, email, role, designation, department, is_active
leave_requests: id, faculty_id, leave_type, reason, start_datetime, end_datetime, status, hod_remarks, approved_by, approved_at, qr_token, qr_generated_at, qr_used (MISSING — add this)
qr_scan_logs: id, leave_request_id, faculty_id, scan_type('exit'|'reentry'), scanned_at, scanned_by_hod
```

**Installed packages:** `@supabase/ssr`, `@supabase/supabase-js`, `qrcode.react`, `html5-qrcode`, `uuid`

---

## Fix 1 — Leave Requests Not Appearing in HOD Dashboard

**Root cause:** `PendingRequests.tsx` fetches with `.select('*, profiles(*)')` which relies on a foreign key join `leave_requests.faculty_id → profiles.id`. The RLS policy `leave_faculty` allows faculty to only see their own rows. But there is **no INSERT policy** explicitly granting faculty the right to insert — only `for all`. Also the HOD fetch has no realtime subscription so new requests require a manual refresh.

**File:** `components/hod/PendingRequests.tsx`

**Changes required:**
1. After `useEffect` that calls `fetchRequests()`, add a Supabase **realtime channel** subscription:
```tsx
useEffect(() => {
  fetchRequests()
  const channel = supabase
    .channel('leave_requests_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
      fetchRequests()
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [fetchRequests])
```
2. Add error logging to `fetchRequests` so failures are visible:
```tsx
const fetchRequests = useCallback(async () => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*, profiles(*)')
    .order('created_at', { ascending: false })
  if (error) console.error('Fetch error:', error)
  setRequests((data as any) || [])
  setLoading(false)
}, [supabase])
```

**File:** `supabase/migrations/003_fix_rls.sql` *(create new)*

Add an explicit RLS policy so faculty can insert their own leave requests:
```sql
-- Ensure faculty can insert their own leave requests
create policy "leave_faculty_insert"
  on public.leave_requests for insert
  with check (faculty_id = auth.uid());

-- Ensure HOD can read all profiles (needed for join in PendingRequests)
create policy "profiles_read_all"
  on public.profiles for select
  using (true);
```

---

## Fix 2 — Profile Editing for Faculty and HOD

**File:** `components/faculty/FacultyDashboardClient.tsx`

In the `activeTab === 'profile'` section, replace the read-only display with an editable form. Add state:
```tsx
const [editMode, setEditMode] = useState(false)
const [editValues, setEditValues] = useState({ full_name: profile.full_name, designation: profile.designation || '', department: profile.department || '' })
const [saving, setSaving] = useState(false)
```

Replace the profile section JSX with:
```tsx
{activeTab === 'profile' && (
  <section className="p-4 space-y-4">
    <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Profile Details</h3>
        <button onClick={() => setEditMode(e => !e)} className="text-primary text-sm font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">{editMode ? 'close' : 'edit'}</span>
          {editMode ? 'Cancel' : 'Edit'}
        </button>
      </div>
      {editMode ? (
        <div className="space-y-3">
          {/* Editable: full_name, designation, department */}
          {[
            { label: 'Full Name', key: 'full_name' },
            { label: 'Designation', key: 'designation' },
            { label: 'Department', key: 'department' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
              <input
                value={editValues[key as keyof typeof editValues]}
                onChange={e => setEditValues(v => ({ ...v, [key]: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
          ))}
          {/* Read-only: email, faculty_id */}
          <div className="flex justify-between text-sm py-2 border-t border-slate-100">
            <span className="text-slate-500">Email</span>
            <span className="font-semibold text-slate-400">{profile.email}</span>
          </div>
          <button
            onClick={async () => {
              setSaving(true)
              const { error } = await supabase.from('profiles').update(editValues).eq('id', profile.id)
              setSaving(false)
              if (!error) { setEditMode(false); window.location.reload() }
            }}
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      ) : (
        /* existing read-only display */
        [
          { label: 'Full Name', value: profile.full_name },
          { label: 'Faculty ID', value: profile.faculty_id || 'N/A' },
          { label: 'Email', value: profile.email },
          { label: 'Designation', value: profile.designation || 'N/A' },
          { label: 'Department', value: profile.department || 'CSE (AI & ML)' },
          { label: 'Status', value: profile.is_active ? 'Active' : 'Inactive' },
        ].map(item => (
          <div key={item.label} className="flex justify-between text-sm border-b border-slate-50 dark:border-slate-800 pb-2">
            <span className="text-slate-500 font-medium">{item.label}</span>
            <span className="font-semibold">{item.value}</span>
          </div>
        ))
      )}
    </div>
    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-200 text-red-600 font-bold">
      <span className="material-symbols-outlined">logout</span> Logout
    </button>
  </section>
)}
```

**File:** `components/hod/HODDashboardClient.tsx`

In the `activeTab === 'settings'` section, apply the same edit pattern. The HOD can edit: `full_name`, `designation`, `department`. Use identical state + form structure as above but with `hodId = profile.id`.

---

## Fix 3 — QR Code Generation

**Problem:** `ApprovedLeaveCard.tsx` uses `QRCodeSVG` from `qrcode.react` with a `ref` prop, but `QRCodeSVG` does not forward refs in the installed version. The download therefore always fails silently.

**File:** `components/faculty/ApprovedLeaveCard.tsx`

Replace the `QRCodeSVG` + ref approach with a `<canvas>`-based QR using the `qrcode` package (or keep `qrcode.react` but use a wrapping div ref):

```tsx
// Replace ref={qrRef} on QRCodeSVG with a wrapping div
const qrWrapRef = useRef<HTMLDivElement>(null)

// In JSX:
<div ref={qrWrapRef} className="p-4 bg-white rounded-xl border-2 border-primary/20 shadow-inner">
  <QRCodeSVG
    value={qrPayload}
    size={200}
    level="H"
    includeMargin={false}
  />
</div>

// handleDownload — serialize the SVG from the wrapper div:
const handleDownload = useCallback(() => {
  const svg = qrWrapRef.current?.querySelector('svg')
  if (!svg) return
  const svgData = new XMLSerializer().serializeToString(svg)
  const canvas = document.createElement('canvas')
  canvas.width = 220; canvas.height = 220
  const ctx = canvas.getContext('2d')!
  const img = new Image()
  img.onload = () => {
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 220, 220)
    ctx.drawImage(img, 10, 10, 200, 200)
    const link = document.createElement('a')
    link.download = `leave-qr-${leave.id.slice(0, 8)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
}, [leave.id])
```

**Guard:** Only show the "View QR Code" button if `leave.qr_token` is truthy:
```tsx
{leave.qr_token && (
  <button onClick={() => setShowQR(true)} ...>View QR Code</button>
)}
{!leave.qr_token && (
  <p className="text-xs text-slate-400 text-center py-2">QR pending HOD approval</p>
)}
```

---

## Fix 4 — Camera Access & Full QR Scan Flow

**Problem:** `html5-qrcode`'s `Html5QrcodeScanner` renders its own UI inside the target div, but when placed inside a styled container with `overflow-hidden`, the camera permissions prompt and video feed are visually clipped or blocked. Also, no `HTTPS` or `localhost` check is done before asking for camera.

**File:** `components/hod/QRScanner.tsx`

**Full rewrite of the scanner component:**

```tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseQRPayload } from '@/lib/qr'
import ScanLog from './ScanLog'

interface ScanResult {
  facultyName: string
  facultyIdCode: string
  scanType: 'exit' | 'reentry'
  scannedAt: string
  leaveType: string
}

export default function QRScanner({ hodId }: { hodId: string }) {
  const supabase = createClient()
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshLog, setRefreshLog] = useState(0)
  const html5QrRef = useRef<any>(null)

  const stopScanner = useCallback(async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop() } catch {}
      try { await html5QrRef.current.clear() } catch {}
      html5QrRef.current = null
    }
    setScanning(false)
  }, [])

  const processQR = useCallback(async (decodedText: string) => {
    await stopScanner()
    const payload = parseQRPayload(decodedText)
    if (!payload) {
      setError('Invalid QR code — not a valid leave pass.')
      return
    }

    const { data: leave, error: lvErr } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', payload.leaveId)
      .eq('qr_token', payload.qrToken)
      .eq('status', 'approved')
      .eq('qr_used', false)   // one-use check
      .single()

    if (lvErr || !leave) {
      setError(leave === null ? 'QR code already used or invalid.' : 'Leave not found or not approved.')
      return
    }

    // Mark QR as used
    await supabase
      .from('leave_requests')
      .update({ qr_used: true })
      .eq('id', payload.leaveId)

    // Log re-entry scan
    await supabase.from('qr_scan_logs').insert({
      leave_request_id: payload.leaveId,
      faculty_id: payload.facultyId,
      scan_type: 'reentry',
      scanned_by_hod: hodId,
    })

    setScanResult({
      facultyName: payload.facultyName,
      facultyIdCode: payload.facultyIdCode,
      scanType: 'reentry',
      scannedAt: new Date().toLocaleString('en-IN'),
      leaveType: payload.leaveType,
    })
    setRefreshLog(p => p + 1)
  }, [supabase, hodId, stopScanner])

  const startScanner = useCallback(async () => {
    setError(null)
    setScanResult(null)

    // Check camera permission availability
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this browser. Use Chrome or Safari on a mobile device.')
      return
    }

    try {
      // Explicitly request camera permission first
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions and try again.')
      return
    }

    setScanning(true)

    // Use Html5Qrcode (not Scanner) for full control
    const { Html5Qrcode } = await import('html5-qrcode')
    const qr = new Html5Qrcode('qr-reader-element')
    html5QrRef.current = qr

    try {
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        processQR,
        undefined
      )
    } catch (err: any) {
      setError(`Could not start camera: ${err?.message || err}`)
      setScanning(false)
    }
  }, [processQR])

  useEffect(() => {
    return () => { stopScanner() }
  }, [stopScanner])

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-base font-bold">QR Code Scanner</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Scan faculty re-entry QR codes for gate verification
        </p>
      </div>

      {/* Scanner container — must NOT have overflow:hidden */}
      <div className="rounded-2xl border-2 border-slate-800 bg-slate-900 relative min-h-[300px] flex flex-col items-center justify-center">
        {/* The div html5-qrcode mounts into */}
        <div
          id="qr-reader-element"
          className={`w-full ${scanning ? 'block' : 'hidden'}`}
          style={{ minHeight: 300 }}
        />

        {!scanning && (
          <div className="text-center text-white p-8 z-10">
            <span className="material-symbols-outlined text-5xl mb-3 text-primary block">qr_code_scanner</span>
            <p className="text-sm font-medium mb-5 text-slate-300">Tap to scan faculty re-entry pass</p>
            <button
              onClick={startScanner}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 mx-auto"
            >
              <span className="material-symbols-outlined text-lg">videocam</span>
              Open Camera
            </button>
          </div>
        )}

        {scanning && (
          <button
            onClick={stopScanner}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-red-500 text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-lg"
          >
            Stop Scanner
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">error</span>
          <span>{error}</span>
        </div>
      )}

      {scanResult && (
        <div className="rounded-xl p-4 border-2 bg-green-50 border-green-200 dark:bg-green-900/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🏠</span>
            <div>
              <p className="font-bold text-sm">{scanResult.facultyName}</p>
              <p className="text-xs text-slate-500">{scanResult.facultyIdCode}</p>
            </div>
          </div>
          <p className="text-sm font-bold text-green-700">✅ Re-entry Logged Successfully</p>
          <p className="text-xs text-slate-500 mt-1">{scanResult.scannedAt} · {scanResult.leaveType}</p>
        </div>
      )}

      <ScanLog refreshKey={refreshLog} />
    </div>
  )
}
```

---

## Fix 5 — Simplify Leave Request Form (Reason Only)

**File:** `components/faculty/LeaveRequestForm.tsx`

**Complete rewrite** — keep only the `reason` textarea. The submission date is captured automatically via `new Date().toISOString()`. Remove: leave type selector, start datetime, end datetime.

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LeaveRequestFormProps {
  facultyId: string
  onSuccess?: () => void
}

export default function LeaveRequestForm({ facultyId, onSuccess }: LeaveRequestFormProps) {
  const supabase = createClient()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    setLoading(true)

    const now = new Date().toISOString()

    const { error } = await supabase.from('leave_requests').insert({
      faculty_id: facultyId,
      leave_type: 'other',          // default; no longer shown to faculty
      start_datetime: now,          // submission time = leave start
      end_datetime: now,            // HOD approval triggers actual leave start
      reason: reason.trim(),
      status: 'pending',
    })

    setLoading(false)

    if (error) {
      showToast('error', error.message)
    } else {
      showToast('success', 'Leave request submitted! Awaiting HOD approval.')
      setReason('')
      onSuccess?.()
    }
  }

  return (
    <section className="px-4 py-2">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
        </div>
      )}

      <h3 className="mb-3 text-lg font-bold">New Leave Request</h3>
      <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-100 dark:border-slate-800">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason for Leave
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly explain why you need to leave..."
              rows={4}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-primary focus:ring-primary text-sm px-3 py-2"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Submitted: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !reason.trim()}
            className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </>
            ) : 'Submit Request'}
          </button>
        </form>
      </div>
    </section>
  )
}
```

---

## Fix 6 — QR One-Use: Leave Starts on Approval, QR Valid for Re-entry Only

### DB Migration

**File:** `supabase/migrations/004_qr_one_use.sql` *(create new)*

```sql
-- Add qr_used flag to leave_requests
alter table public.leave_requests
  add column if not exists qr_used boolean not null default false;

-- Index for faster QR lookup
create index if not exists leave_requests_qr_token_idx on public.leave_requests(qr_token);
```

### HOD Approval Logic

**File:** `components/hod/PendingRequests.tsx` — `handleApprove` function

When HOD approves, `start_datetime` is set to NOW (leave officially starts). `qr_used` is explicitly set to `false`:

```tsx
const handleApprove = async (leaveId: string) => {
  const qrToken = uuidv4()
  const now = new Date().toISOString()

  const { error } = await supabase.from('leave_requests').update({
    status: 'approved',
    approved_by: hodId,
    approved_at: now,
    start_datetime: now,        // leave starts at moment of approval
    qr_token: qrToken,
    qr_generated_at: now,
    qr_used: false,             // fresh, unused QR
  }).eq('id', leaveId)

  if (error) showToast('error', error.message)
  else { showToast('success', 'Leave approved! QR code generated.'); fetchRequests() }
}
```

### QR Scan Validation (already in Fix 4 above)

The `QRScanner` in Fix 4 already:
1. Queries `.eq('qr_used', false)` — rejects already-used QR codes
2. On successful scan, sets `qr_used: true` — marks QR as consumed
3. Logs only `reentry` scan type — QR is the re-entry pass, not exit

**Flow summary:**
1. Faculty submits request (reason only, timestamp auto-set)
2. HOD sees it in dashboard in real-time (via Supabase channel)
3. HOD approves → `start_datetime` = now, `qr_token` generated, `qr_used = false`
4. Faculty sees approved leave card → taps "View QR Code" → shows QR
5. Faculty shows QR at gate on return
6. HOD scans → validates `qr_used = false` → logs `reentry` → marks `qr_used = true`
7. QR is now permanently invalid (one-use enforced)

---

## Implementation Order

Apply fixes in this order to avoid dependency issues:

1. **DB migrations first** — run `003_fix_rls.sql` and `004_qr_one_use.sql` in Supabase SQL editor
2. **Fix 5** — `LeaveRequestForm.tsx` (simplest, no dependencies)
3. **Fix 1** — `PendingRequests.tsx` (realtime + RLS fix)
4. **Fix 6** — `PendingRequests.tsx` handleApprove (depends on `qr_used` column from step 1)
5. **Fix 3** — `ApprovedLeaveCard.tsx` (QR generation display)
6. **Fix 4** — `QRScanner.tsx` (camera + one-use validation, depends on `qr_used`)
7. **Fix 2** — Profile editing in both dashboards (independent)

---

## Important Notes for Claude

- Do NOT use `Html5QrcodeScanner` — use `Html5Qrcode` directly for camera control
- The `qr-reader-element` div must **not** be inside a container with `overflow: hidden`
- `QRCodeSVG` does not forward refs — always find the `<svg>` via a wrapper div's `.querySelector('svg')`
- Supabase realtime requires the table to have `REPLICA IDENTITY FULL` or at minimum default; check Supabase dashboard → Database → Replication if channel events aren't firing
- When saving profile edits, `window.location.reload()` is acceptable since profile data comes from server props
- The `start_datetime` and `end_datetime` columns still exist in the DB; for new simplified requests set both to `new Date().toISOString()` to satisfy the NOT NULL constraint
- Always `await` the `stopScanner` before processing QR to avoid double-scan
