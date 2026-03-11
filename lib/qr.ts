import { QRPayload } from '@/types'

/**
 * Build the JSON string to embed in a QR code for an approved leave.
 */
export function buildQRPayload(payload: QRPayload): string {
  return JSON.stringify(payload)
}

/**
 * Parse a scanned QR code string back into a QRPayload.
 * Returns null if the string is not valid JSON or missing required fields.
 */
export function parseQRPayload(raw: string): QRPayload | null {
  try {
    const data = JSON.parse(raw) as QRPayload
    if (!data.leaveId || !data.facultyId || !data.qrToken) return null
    return data
  } catch {
    return null
  }
}
