'use client'

import { useEffect, useRef, useState } from 'react'
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
  const scannerRef = useRef<HTMLDivElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshLog, setRefreshLog] = useState(0)
  const scannerInstance = useRef<{ clear: () => Promise<void> } | null>(null)

  const stopScanner = () => {
    if (scannerInstance.current) {
      scannerInstance.current.clear().catch(() => {})
      scannerInstance.current = null
    }
    setScanning(false)
  }

  const startScanner = async () => {
    setError(null)
    setScanResult(null)
    setScanning(true)

    // Dynamic import to avoid SSR issues
    const { Html5QrcodeScanner } = await import('html5-qrcode')

    if (!scannerRef.current) return

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
      false
    )

    scannerInstance.current = scanner

    scanner.render(
      async (decodedText: string) => {
        stopScanner()
        const payload = parseQRPayload(decodedText)
        if (!payload) {
          setError('Invalid QR code. Not a valid leave pass.')
          return
        }

        // Verify leave in DB
        const { data: leave, error: lvErr } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('id', payload.leaveId)
          .eq('qr_token', payload.qrToken)
          .eq('status', 'approved')
          .single()

        if (lvErr || !leave) {
          setError('QR code is invalid or leave is not approved.')
          return
        }

        // Determine exit vs re-entry
        const { data: lastScan } = await supabase
          .from('qr_scan_logs')
          .select('scan_type')
          .eq('leave_request_id', payload.leaveId)
          .order('scanned_at', { ascending: false })
          .limit(1)
          .single()

        const scanType: 'exit' | 'reentry' =
          !lastScan || lastScan.scan_type === 'reentry' ? 'exit' : 'reentry'

        await supabase.from('qr_scan_logs').insert({
          leave_request_id: payload.leaveId,
          faculty_id: payload.facultyId,
          scan_type: scanType,
          scanned_by_hod: hodId,
        })

        setScanResult({
          facultyName: payload.facultyName,
          facultyIdCode: payload.facultyIdCode,
          scanType,
          scannedAt: new Date().toLocaleString('en-IN'),
          leaveType: payload.leaveType,
        })
        setRefreshLog(p => p + 1)
      },
      (err: string) => {
        // Ignore routine "not found" errors
        if (!err.includes('NotFoundException')) {
          console.warn('QR error:', err)
        }
      }
    )
  }

  useEffect(() => {
    return () => { stopScanner() }
  }, [])

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-base font-bold">QR Code Scanner</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Scan faculty leave QR codes for gate verification</p>
      </div>

      {/* Scanner Area */}
      <div className="bg-slate-900 rounded-2xl aspect-[4/3] relative overflow-hidden flex flex-col items-center justify-center border-4 border-slate-800">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent" />

        {/* Corner accents */}
        <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-primary rounded-tl-xl z-10" />
        <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-primary rounded-tr-xl z-10" />
        <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-primary rounded-bl-xl z-10" />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-primary rounded-br-xl z-10" />

        {scanning ? (
          <div id="qr-reader" ref={scannerRef} className="w-full h-full z-20" />
        ) : (
          <div className="z-10 text-center text-white p-6">
            <span className="material-symbols-outlined text-5xl mb-2 text-primary">qr_code_scanner</span>
            <p className="text-sm font-medium mb-4">Gate Pass Verification</p>
            <button
              onClick={startScanner}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-full font-bold text-sm flex items-center gap-2 mx-auto"
            >
              <span className="material-symbols-outlined text-lg">videocam</span>
              Scan Now
            </button>
          </div>
        )}

        {scanning && (
          <button
            onClick={stopScanner}
            className="absolute bottom-4 z-30 bg-red-500 text-white px-4 py-1.5 rounded-full text-xs font-bold"
          >
            Stop
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* Scan Result */}
      {scanResult && (
        <div className={`rounded-xl p-4 border-2 ${
          scanResult.scanType === 'exit'
            ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20'
            : 'bg-green-50 border-green-200 dark:bg-green-900/20'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{scanResult.scanType === 'exit' ? '✅' : '🏠'}</span>
            <div>
              <p className="font-bold text-sm">{scanResult.facultyName}</p>
              <p className="text-xs text-slate-500">{scanResult.facultyIdCode}</p>
            </div>
          </div>
          <p className={`text-sm font-bold ${scanResult.scanType === 'exit' ? 'text-orange-700' : 'text-green-700'}`}>
            {scanResult.scanType === 'exit' ? '✅ Exit Logged' : '🏠 Re-entry Logged'}
          </p>
          <p className="text-xs text-slate-500 mt-1">{scanResult.scannedAt} · {scanResult.leaveType}</p>
        </div>
      )}

      {/* Scan Log */}
      <ScanLog refreshKey={refreshLog} />
    </div>
  )
}
