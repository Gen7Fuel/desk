import { apiFetch } from '@/lib/api'

export type SiteAccount = {
  site: string
  tradogramLocation: string
  sageLocationId: string
  loanAccountId: string
  inventoryAccountId: string
}
export type GLAccount = {
  code: string
  name: string
  number: string
  type: 'loan' | 'inventory'
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
  poGLAccountName?: string
  poGLAccountNumber?: string
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
  lines: Array<{
    id: string
    accountType: '' | 'loan' | 'inventory'
    glAccountCode?: string
  }>
}
export type DeliveryDetail = {
  source: DeliverySource
  draft: Draft | null
  stale: boolean
  accounts: Array<GLAccount>
}

export function suggestedAccountCodes(
  source: DeliverySource,
  draft: Draft | null,
  site: SiteAccount | undefined,
  accounts: Array<GLAccount>,
): Record<string, string> {
  return Object.fromEntries(
    source.lines.map((line) => {
      const saved = draft?.lines.find((choice) => choice.id === line.id)
      if (saved?.glAccountCode) return [line.id, saved.glAccountCode]
      // Preserve an intentionally empty saved choice. Older Loan/Inventory-only
      // drafts migrate through the site's configured default, not the PO suggestion.
      const matches = saved
        ? saved.accountType
          ? accounts.filter(
              (account) =>
                account.type === saved.accountType &&
                account.number ===
                  site?.[
                    saved.accountType === 'loan'
                      ? 'loanAccountId'
                      : 'inventoryAccountId'
                  ],
            )
          : []
        : accounts.filter(
            (account) => account.number === line.poGLAccountNumber,
          )
      return [line.id, matches.length === 1 ? matches[0].code : '']
    }),
  )
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
