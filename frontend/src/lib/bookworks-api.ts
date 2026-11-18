import { apiFetch } from '@/lib/api'

export type BookworksDistribution = {
  glAccountCode: string | null
  costCenterCode: string | null
  debitOrCredit: string | null
  description: string | null
  amount: number | null
}

export type BookworksInvoice = {
  id: number
  invoiceNumber: string
  vendorCode: string | null
  vendorName: string | null
  invoiceDate: string | null
  dueDate: string | null
  discountDate: string | null
  description: string | null
  totalAmount: number | null
  posted: boolean | null
  distributions: Array<BookworksDistribution>
}

export type BookworksSearch = {
  invoiceNumber: string
  offset: number
  pageSize: number
  hasMore: boolean
  invoices: Array<BookworksInvoice>
  warnings: Array<string>
}

export async function searchBookworksInvoices(
  invoiceNumber: string,
  offset = 0,
  signal?: AbortSignal,
): Promise<BookworksSearch> {
  const query = new URLSearchParams({ invoiceNumber, offset: String(offset) })
  const response = await apiFetch(`/api/bookworks/invoices?${query}`, {
    signal,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.message || 'Could not search Bookworks invoices. Please retry.',
    )
  }
  return response.json()
}

export type IntacctVendor = { id: string; key: string; name: string }
export type BookworksMapping = { vendorId: string; vendorName: string }
export type BookworksContext = {
  entityId: string
  company: string
  mapping: BookworksMapping | null
  entry: {
    status: 'creating' | 'created' | 'failed' | 'uncertain'
    billKey: string | null
    entityId: string
  } | null
}
export type BookworksPreview = {
  invoiceId: number
  invoiceNumber: string
  entityId: string
  company: string
  currency: 'CAD'
  vendor: IntacctVendor
  cogsType: 'fuel' | 'freight'
  cogsAccount: string
  invoiceDate: string
  postingDate: string
  dueDate: string
  costCents: number
  hstCents: number
  totalCents: number
  hash: string
}
async function intacctRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await apiFetch('/api/bookworks' + path, init)
  const body = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(
      body?.message || 'Bookworks Intacct request failed. Please retry.',
    )
  return body as T
}
export const bookworksIntacct = {
  context: (id: number, signal?: AbortSignal) =>
    intacctRequest<BookworksContext>('/invoices/' + id + '/intacct-context', {
      signal,
    }),
  vendors: (q: string) =>
    intacctRequest<{ vendors: Array<IntacctVendor>; hasMore: boolean }>(
      '/intacct/vendors?' + new URLSearchParams({ q }),
    ),
  saveMapping: (id: number, vendorId: string) =>
    intacctRequest<BookworksMapping>('/invoices/' + id + '/vendor-mapping', {
      method: 'PUT',
      body: JSON.stringify({ vendorId }),
    }),
  preview: (id: number, cogsType: 'fuel' | 'freight') =>
    intacctRequest<BookworksPreview>('/invoices/' + id + '/draft-preview', {
      method: 'POST',
      body: JSON.stringify({ cogsType }),
    }),
  createDraft: (
    id: number,
    cogsType: 'fuel' | 'freight',
    previewHash: string,
  ) =>
    intacctRequest<{
      billKey: string
      alreadyCreated: boolean
      entityId: string
      state: 'draft'
    }>('/invoices/' + id + '/intacct-draft', {
      method: 'POST',
      body: JSON.stringify({ cogsType, previewHash }),
    }),
}
