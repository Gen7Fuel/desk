import type { ExtractedFields } from './types'

export function buildFilename(fields: ExtractedFields | null): string {
  const shipTo = fields?.shipTo ?? ''
  const match = shipTo.match(/^(.*?LP)\b/)
  const location = match ? match[1].trim() : 'Unknown'
  const now = new Date()
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const ts =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `NSP - ${location} - ${ts}.pdf`
}
