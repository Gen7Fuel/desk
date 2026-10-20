import { apiFetch } from '@/lib/api'

export type SiteAccount = {
  site: string
  tradogramLocation: string
  sageLocationId: string
  loanAccountId: string
  inventoryAccountId: string
}
export type DeliverySummary = {
  deliveryCode: string
  poNumber: string
  supplier: string
  location?: string
  receivedDate: string
  invoiceNumber?: string
  poStatus?: string
  site?: string
  status?: string
  receivedLines?: number
  subtotal?: number
  currency?: string
}
export type DeliveryLine = {
  id: string
  name: string
  description: string
  quantity: number
  ordered: number
  unit: string
  unitPrice: number | null
  amount: number | null
  department: string
}
export type DeliverySource = DeliverySummary & {
  sourceHash: string
  currency: string
  subtotal: number
  lines: Array<DeliveryLine>
  issues: Array<string>
  poTax: string
  poDiscount: string
  poFees: string
}
export type Draft = {
  revision: number
  site: string
  vendorId: string
  invoiceNumber: string
  notes: string
  status: 'draft' | 'ready'
  intacctBillKey: string
  lines: Array<{ id: string; accountType: '' | 'loan' | 'inventory' }>
}
export type DeliveryDetail = {
  source: DeliverySource
  draft: Draft | null
  stale: boolean
}

export async function tradogramRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(`/api/tradogram${path}`, init)
  const body = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(body?.message || `Request failed (${response.status})`)
  return body as T
}
