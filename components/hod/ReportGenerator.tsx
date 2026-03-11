'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportRow } from '@/types'
import { generatePDF } from '@/lib/pdf'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ReportGenerator() {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(currentYear)
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportRow[] | null>(null)

  const generateReport = useCallback(async () => {
    setLoading(true)
    setReportData(null)

    const startDate = new Date(year, month, 1).toISOString()
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    // Fetch approved leaves in selected month
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('*, profiles(*)')
      .eq('status', 'approved')
      .gte('start_datetime', startDate)
      .lte('start_datetime', endDate)

    if (!leaves) { setLoading(false); return }

    // For each leave, check scan logs for >1hr duration
    const facultyMap: Record<string, ReportRow> = {}

    for (const leave of leaves) {
      const fid = leave.faculty_id
      const profile = (leave as any).profiles

      if (!facultyMap[fid]) {
        facultyMap[fid] = {
          facultyId: profile?.faculty_id || 'N/A',
          fullName: profile?.full_name || 'Unknown',
          email: profile?.email || '',
          leaveCount: 0,
          exceededCount: 0,
        }
      }
      facultyMap[fid].leaveCount++

      // Get scan logs for this leave: find exit→reentry pairs
      const { data: scanLogs } = await supabase
        .from('qr_scan_logs')
        .select('*')
        .eq('leave_request_id', leave.id)
        .order('scanned_at', { ascending: true })

      if (scanLogs) {
        let i = 0
        while (i < scanLogs.length) {
          if (scanLogs[i].scan_type === 'exit' && scanLogs[i + 1]?.scan_type === 'reentry') {
            const exit = new Date(scanLogs[i].scanned_at).getTime()
            const reentry = new Date(scanLogs[i + 1].scanned_at).getTime()
            const durationMinutes = (reentry - exit) / 60000
            if (durationMinutes > 60) facultyMap[fid].exceededCount++
            i += 2
          } else {
            i++
          }
        }
      }
    }

    setReportData(Object.values(facultyMap))
    setLoading(false)
  }, [month, year, supabase])

  const monthLabel = `${MONTHS[month]} ${year}`

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">analytics</span>
          Department Reports
        </h3>

        {/* Month & Year Picker */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:ring-primary focus:border-primary"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:ring-primary focus:border-primary"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          onClick={generateReport}
          disabled={loading}
          className="w-full bg-primary/10 text-primary py-2.5 rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : 'Generate Report'}
        </button>
      </div>

      {/* Report Preview Table */}
      {reportData && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">
              Report: {monthLabel}
              <span className="ml-2 text-slate-400 font-normal">({reportData.length} faculty)</span>
            </h3>
          </div>

          <div className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2 text-center">Leaves</th>
                    <th className="px-3 py-2 text-center">Exceeded 1hr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">No data for {monthLabel}</td>
                    </tr>
                  )}
                  {reportData.map(row => (
                    <tr key={row.facultyId}>
                      <td className="px-3 py-2.5 font-medium">{row.fullName}</td>
                      <td className="px-3 py-2.5 text-slate-500">{row.facultyId}</td>
                      <td className="px-3 py-2.5 text-center text-primary font-bold">{row.leaveCount}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={row.exceededCount > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}>
                          {row.exceededCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Download PDF */}
          <button
            onClick={() => generatePDF(reportData, monthLabel)}
            className="w-full border-2 border-dashed border-primary/30 py-3 rounded-xl text-xs font-semibold text-primary flex items-center justify-center gap-2 hover:border-primary/60 hover:bg-primary/5 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Download PDF Report
          </button>
        </div>
      )}
    </div>
  )
}
