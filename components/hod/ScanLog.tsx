'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QRScanLog } from '@/types'

interface ExtendedLog extends QRScanLog {
  profiles: { full_name: string; faculty_id: string | null }
  leave_requests: { leave_type: string }
}

export default function ScanLog({ refreshKey }: { refreshKey?: number }) {
  const supabase = createClient()
  const [logs, setLogs] = useState<ExtendedLog[]>([])

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('qr_scan_logs')
      .select('*, profiles(*), leave_requests(leave_type)')
      .order('scanned_at', { ascending: false })
      .limit(20)
    setLogs((data as any) || [])
  }, [supabase])

  useEffect(() => { fetchLogs() }, [fetchLogs, refreshKey])

  function leaveTypeLabel(type: string) {
    const map: Record<string, string> = { personal: 'Personal', medical: 'Medical', emergency: 'Emergency', official: 'Official', other: 'Other' }
    return map[type] || type
  }

  return (
    <div>
      <h3 className="text-sm font-bold mb-3">Scan History (last 20)</h3>
      <div className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">No scans yet</td>
                </tr>
              )}
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="px-3 py-2.5 font-medium">{log.profiles?.full_name?.split(' ').slice(-1)[0] || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500">{log.profiles?.faculty_id || '—'}</td>
                  <td className="px-3 py-2.5">
                    {log.scan_type === 'exit' ? (
                      <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-bold">EXIT</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold">ENTRY</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {new Date(log.scanned_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {leaveTypeLabel(log.leave_requests?.leave_type || '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
