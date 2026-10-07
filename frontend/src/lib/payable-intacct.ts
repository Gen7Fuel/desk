import { apiFetch } from '@/lib/api'
import { getExternalToken } from '@/lib/permissions'
import { getSageToken, resolveSiteEntity } from '@/lib/sage-site'

const HUB = 'https://app.gen7fuel.com'

/** Supplier used when a payable's vendor name has no Intacct tag. */
export const CASH_VENDOR_ID = 'V00236'
/** GL account for the credit that records money leaving the store safe. */
export const STORE_SAFE_GL_ACCOUNT = '10011'

// Canadian Sales Tax - SYS, with the zero-rate detail the UI applies to these
// lines. Intacct rejects a bill without a tax solution and per-line tax detail.
const TAX_SOLUTION_KEY = '3'
const TAX_DETAIL_KEY = '69'
const ATTACHMENT_FOLDER_KEY = '184'

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
]

/** "Sept 29/2026" from a YYYY-MM-DD date. */
export function formatBillDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) throw new Error(`Invalid date: ${ymd}`)
  return `${MONTHS[Number(m[2]) - 1]} ${m[3]}/${m[1]}`
}

/** "Wholesale Club Sept 29/2026", optionally with the amount appended. */
export function buildPayableBillNumber(
  vendorName: string,
  ymd: string,
  amount?: number,
): string {
  const base = `${vendorName.trim()} ${formatBillDate(ymd)}`
  return amount === undefined ? base : `${base} - ${amount.toFixed(2)}`
}

export interface PayableBillInput {
  billNumber: string
  vendorName: string
  date: string
  amount: number
  notes: string
  /** Intacct supplier ID: the vendor's tag, or the Cash Vendor. */
  supplierId: string
  entityId: string
  attachmentKey?: string
}

/**
 * A draft AP bill holding only the Store Safe line, as a negative amount. The
 * offsetting expense line (e.g. COGS) is added by hand in Intacct afterwards.
 */
export function buildPayableBillPayload(input: PayableBillInput) {
  const memo = input.notes.trim() || input.vendorName.trim()
  return {
    billNumber: input.billNumber,
    vendor: { id: input.supplierId },
    description: input.billNumber,
    createdDate: input.date,
    postingDate: input.date,
    dueDate: input.date,
    state: 'draft',
    isTaxInclusive: false,
    taxSolution: { key: TAX_SOLUTION_KEY },
    ...(input.attachmentKey
      ? { attachment: { key: input.attachmentKey } }
      : {}),
    lines: [
      {
        glAccount: { id: STORE_SAFE_GL_ACCOUNT },
        txnAmount: (-input.amount).toFixed(2),
        memo,
        hasForm1099: 'false',
        dimensions: {
          location: { id: input.entityId },
          vendor: { id: input.supplierId },
        },
        taxEntries: [
          {
            baseTaxAmount: '0',
            txnTaxAmount: '0',
            taxRate: 0,
            purchasingTaxDetail: { key: TAX_DETAIL_KEY },
          },
        ],
      },
    ],
  }
}

function extensionOf(dataUri: string): string {
  const mime = /^data:([^;,]+)/.exec(dataUri)?.[1] ?? ''
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

/** One Intacct attachment holding every payable photo (data URIs). Returns its key. */
async function createPhotosAttachment(
  dataUris: Array<string>,
  name: string,
  sageToken: string,
): Promise<string> {
  const safeName = name.replace(/[\\/:*?"<>|]/g, '-')
  const body = {
    id: `PAY-${Date.now()}`,
    name: safeName,
    folder: { key: ATTACHMENT_FOLDER_KEY },
    files: dataUris.map((uri, i) => ({
      name: `${safeName} ${i + 1}.${extensionOf(uri)}`,
      data: uri.slice(uri.indexOf(',') + 1),
    })),
  }
  const res = await apiFetch('/api/sage/attachment', {
    method: 'POST',
    body: JSON.stringify({ ...body, sageToken }),
  })
  const data = (await res.json().catch(() => null)) as {
    message?: string
    'ia::result'?: { key?: string }
  } | null
  const key = data?.['ia::result']?.key
  if (!res.ok || !key) {
    throw new Error(data?.message ?? `Sage attachment failed (${res.status})`)
  }
  return key
}

function sageErrorText(body: unknown, status: number): string {
  const b = body as {
    message?: string
    'ia::result'?: {
      'ia::error'?: {
        message?: string
        details?: Array<{ message?: string }>
      }
    }
  } | null
  const err = b?.['ia::result']?.['ia::error']
  const parts = [err?.message, ...(err?.details ?? []).map((d) => d.message)]
    .filter(Boolean)
    .join(' — ')
  return `Sage ${status}: ${parts || b?.message || 'request failed'}`
}

export interface CreatePayableEntryArgs {
  site: string
  vendorName: string
  date: string
  amount: number
  notes: string
  /** Intacct vendor ID from the vendor's tag; the Cash Vendor is used when absent. */
  taggedVendorId?: string
  /** Payable photos as data URIs (empty strings already removed). */
  photoDataUris: Array<string>
}

/**
 * Creates the draft AP bill in Intacct and returns its key. Retries once with
 * the amount appended to the invoice number if Intacct says it already exists.
 */
export async function createPayableIntacctEntry(
  args: CreatePayableEntryArgs,
): Promise<string> {
  const sageToken = await getSageToken()
  const entityId = await resolveSiteEntity(sageToken, args.site)
  const supplierId = args.taggedVendorId ?? CASH_VENDOR_ID
  const firstNumber = buildPayableBillNumber(args.vendorName, args.date)

  const attachmentKey = args.photoDataUris.length
    ? await createPhotosAttachment(args.photoDataUris, firstNumber, sageToken)
    : undefined

  const post = async (billNumber: string) => {
    const res = await apiFetch('/api/sage/bill', {
      method: 'POST',
      headers: { 'X-Sage-Token': sageToken, 'X-Sage-Entity': entityId },
      body: JSON.stringify(
        buildPayableBillPayload({
          billNumber,
          vendorName: args.vendorName,
          date: args.date,
          amount: args.amount,
          notes: args.notes,
          supplierId,
          entityId,
          attachmentKey,
        }),
      ),
    })
    const body = (await res.json().catch(() => null)) as unknown
    if (!res.ok) throw new Error(sageErrorText(body, res.status))
    const key = (body as { 'ia::result'?: { key?: string } } | null)?.[
      'ia::result'
    ]?.key
    if (!key) throw new Error('Sage did not return a bill key.')
    return key
  }

  try {
    return await post(firstNumber)
  } catch (err) {
    if (
      err instanceof Error &&
      /already exists|duplicate|not unique|must be unique/i.test(err.message)
    ) {
      return await post(
        buildPayableBillNumber(args.vendorName, args.date, args.amount),
      )
    }
    throw err
  }
}

/** Remembers the Intacct bill on the Hub payable so it can't be created twice. */
export async function storePayableSageBill(
  payableId: string,
  billKey: string,
): Promise<void> {
  const res = await fetch(`${HUB}/api/payables/${payableId}/sage-bill`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getExternalToken()}`,
    },
    body: JSON.stringify({ key: billKey }),
  })
  if (!res.ok) throw new Error(`Failed to save the Intacct key (${res.status})`)
}
