import { apiFetch } from '@/lib/api'

export type PosSite = {
  id: string
  name: string
  folder: string
  locationId: string
  storeLocationIds: Array<string>
  timezone: string
  issue: string
}
export type PosIssue = {
  code: string
  message: string
  transactionId?: string
  blocking?: boolean
  difference?: number
}
export type PosTotals = {
  sales: number
  voids: number
  gross: number
  tax: number
  fees: number
  rounding: number
  total: number
  quantity: number
  taxableSales: number
  untaxedSales: number
  discounts: number
  discountLines: number
  cash: number
  otherPayments: number
  safeDrops: number
}
export type PosEvent = {
  key: string
  type: string
  id: string
  register: string
  till: string
  cashier: string
  endDate: string
  endTime: string
  excluded: boolean
  gross: number
  tax: number
  total: number
  operation: string
  openingCash: number | null
  closingCash: number | null
  items: Array<{
    line: string
    code: string
    description: string
    quantity: number
    amount: number
    tax: number
    active: boolean
  }>
}
export type PosReport = {
  site: string
  siteName: string
  date: string
  timezone: string
  sourceHash: string
  revision: number
  status: 'draft' | 'accepted' | 'needs-review'
  acceptedBy: string
  acceptedAt: string | null
  totals: PosTotals
  issues: Array<PosIssue>
  payments: Record<string, number>
  departments: Record<string, number>
  eventCount: number
  pendingFiles: number
  events: Array<PosEvent>
  files: Array<{
    path: string
    hash: string
    archived: boolean
    days: Array<string>
  }>
  history: Array<{
    revision: number
    acceptedBy: string
    acceptedAt: string
    sourceHash: string
    snapshot: { totals: PosTotals; timezone: string }
  }>
}
export type PosScan = {
  imported: number
  duplicates: number
  waiting: number
  completedAt: string | null
  issues: Array<{ site: string; file: string; message: string }>
}
export type PosSettings = {
  sites: Array<PosSite>
  locations: Array<{ id: string; name: string; timezone: string }>
  locationIssue: string
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/pos-reports${path}`, init)
  const body = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(body?.message || `Request failed (${response.status})`)
  return body as T
}
const reportPath = (site: string, date: string) =>
  `/reports/${encodeURIComponent(site)}/${encodeURIComponent(date)}`
export const getPosSettings = () => request<PosSettings>('/sites')
export const getPosScan = () => request<PosScan>('/scan')
export const scanPosFiles = () => request<PosScan>('/scan', { method: 'POST' })
export const listPosReports = (site: string, from: string, to: string) =>
  request<Array<PosReport>>(
    `/reports?${new URLSearchParams({ site, from, to })}`,
  )
export const getPosReport = (site: string, date: string) =>
  request<PosReport>(reportPath(site, date))
export const acceptPosReport = (report: PosReport) =>
  request<{
    report: PosReport
    archive: {
      archived: number
      waiting: number
      errors: Array<{ file: string; message: string }>
    }
  }>(`${reportPath(report.site, report.date)}/accept`, {
    method: 'POST',
    body: JSON.stringify({
      sourceHash: report.sourceHash,
      revision: report.revision,
    }),
  })
export const savePosSite = (
  site: Pick<
    PosSite,
    'id' | 'name' | 'folder' | 'locationId' | 'storeLocationIds'
  >,
) =>
  request<Array<PosSite>>('/sites', {
    method: 'PUT',
    body: JSON.stringify(site),
  })
