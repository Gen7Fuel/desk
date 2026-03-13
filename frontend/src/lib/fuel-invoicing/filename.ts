import type { ExtractedFields } from './types'

/**
 * Returns the base filename (without extension):
 *   "NSP Invoice - AP - <Manifest> - <yyyy-MM-dd HH-mm>"
 */
export function buildFilename(fields: ExtractedFields | null): string {
  const manifest = fields?.manifest ?? 'Unknown'
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}`
  return `NSP Invoice - AP - ${manifest} - ${datePart} ${timePart}`
}
