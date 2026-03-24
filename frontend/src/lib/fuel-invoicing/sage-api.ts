import type { ExtractedFields } from './types'
import { apiFetch } from '@/lib/api'

// ─── Shared types ─────────────────────────────────────────────────────────────

interface SageResult {
  'ia::result': {
    key: string
    id: string
    href: string
  }
  'ia::meta': {
    totalCount: number
    totalSuccess?: number
    totalError?: number
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Strips currency symbols / commas and parses to a number. Returns 0 on failure. */
function parseCurrency(val: string | null | undefined): number {
  if (!val) return 0
  return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0
}

/** Converts "MM/DD/YYYY" (or already-ISO) to "YYYY-MM-DD". */
function toISODate(val: string | null | undefined): string {
  if (!val) return ''
  const m = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return val.trim()
}

/** Parses the numeric day count out of a Terms string like "Net 5 Days". */
function parseDueDays(terms: string | null | undefined): number {
  if (!terms) return 0
  const m = terms.match(/\d+/)
  return m ? parseInt(m[0], 10) : 0
}

/** Adds n days to an ISO date string "YYYY-MM-DD". */
function addDays(isoDate: string, days: number): string {
  if (!isoDate) return ''
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Extracts the portion of shipTo up to and including "LP", e.g. "Freddies Gen7 LP". */
function parseShipToLP(shipTo: string | null | undefined): string {
  if (!shipTo) return ''
  const m = shipTo.match(/^(.*?LP)\b/)
  return m ? m[1].trim() : shipTo
}

/**
 * Creates an attachment in Sage Intacct under the company-config folder.
 * Returns the attachment key to be used in subsequent API calls.
 *
 * @param base64     - Raw base64 string of the file (no data-URI prefix).
 * @param filename   - Base name WITHOUT extension (e.g. "NSP Invoice - AP - 12345 - 2026-03-09 14-30").
 * @param extension  - File extension WITHOUT leading dot (e.g. "pdf").
 * @returns          - The attachment key (e.g. "17").
 */
export async function createAttachment(
  base64: string,
  filename: string,
  extension: string,
  sageToken: string,
): Promise<string> {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const shortId = `NSP-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

  const body = {
    id: shortId,
    name: filename,
    folder: { key: '184' },
    files: [
      {
        name: `${filename}.${extension}`,
        data: base64,
      },
    ],
  }

  const res = await apiFetch('/api/sage/attachment', {
    method: 'POST',
    headers: { 'X-Sage-Token': sageToken },
    body: JSON.stringify(body),
  })

  const data: SageResult = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(
      (data as unknown as { message?: string } | null)?.message ??
        `Sage attachment failed (${res.status})`,
    )
  }

  return data['ia::result'].key
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

/**
 * Creates an accounts-payable bill in Sage Intacct.
 * Returns the bill key to be used in subsequent API calls.
 *
 * @param fields        - Extracted PDF fields.
 * @param attachmentKey - Key returned by createAttachment (step 1).
 * @returns             - The bill key (e.g. "299").
 */
export async function createBill(
  fields: ExtractedFields,
  attachmentKey: string,
  sageToken: string,
): Promise<string> {
  const manifest = fields.manifest ?? 'Unknown'
  const shipToLP = parseShipToLP(fields.shipTo)
  const referenceNumber = `BOL # ${manifest} - ${shipToLP}`
  const billDate = toISODate(fields.billDate)
  const dueDate = addDays(billDate, parseDueDays(fields.terms))

  const productLineAmount =
    parseCurrency(fields.productTotal) + parseCurrency(fields.taxFeeTotal)
  const freightLineAmount =
    parseCurrency(fields.freightTotal) + parseCurrency(fields.surcharges)

  const sharedTaxEntry = [
    {
      baseTaxAmount: '0',
      txnTaxAmount: '0',
      taxRate: 0,
      purchasingTaxDetail: { key: '73' },
    },
  ]

  const sharedLineDimensions = {
    dimensions: {
      location: { id: LOCATION_ID },
      vendor: { id: 'V00674' },
    },
    memo: referenceNumber,
    hasForm1099: 'false',
    project: { isBillable: false },
    taxEntries: sharedTaxEntry,
  }

  const body = {
    billNumber: fields.invoiceNumber || `Bill - ${manifest}`,
    vendor: { id: 'V00674' },
    referenceNumber,
    description: referenceNumber,
    createdDate: billDate,
    postingDate: billDate,
    dueDate,
    paymentPriority: 'normal',
    isOnHold: false,
    currency: {
      baseCurrency: 'CAD',
      txnCurrency: 'CAD',
      exchangeRate: {
        date: billDate,
        typeId: 'Intacct Daily Rate',
        rate: 1.0,
      },
    },
    attachment: { key: attachmentKey },
    isTaxInclusive: false,
    taxSolution: { key: '3' },
    state: 'draft',
    lines: [
      {
        ...sharedLineDimensions,
        glAccount: { id: '50100' },
        txnAmount: productLineAmount.toFixed(2),
        totalTxnAmount: productLineAmount.toFixed(2),
      },
      {
        ...sharedLineDimensions,
        glAccount: { id: '51050' },
        txnAmount: freightLineAmount.toFixed(2),
        totalTxnAmount: freightLineAmount.toFixed(2),
      },
    ],
  }

  console.log('[sage] AP bill request body:', body)
  const res = await apiFetch('/api/sage/bill', {
    method: 'POST',
    headers: { 'X-Sage-Token': sageToken },
    body: JSON.stringify(body),
  })

  const data: SageResult = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(
      (data as unknown as { message?: string } | null)?.message ??
        `Sage bill creation failed (${res.status})`,
    )
  }

  console.log('[sage] Bill created successfully:', data)
  return data['ia::result'].key
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────

const LOCATION_ID = 'A210'

const CUSTOMER_ID_MAP: Record<string, string> = {
  'Nipissing Gen7 LP': 'C00139',
  'Smokeys Gen7 LP': 'C00141',
  'Bkejwanong Gen7 LP': 'C00143',
  'Freddies Gen7 LP': 'C00140',
  'Penticton Gen7 LP': 'C00142',
  'FT Frances Gen7 LP': 'C00137',
  'Oliver Gen7 LP': 'C00312',
  'Osoyoos Gen7 LP': 'C00308',
}

function resolveCustomerId(shipToLP: string): string {
  const id = CUSTOMER_ID_MAP[shipToLP]
  if (!id) throw new Error(`Unknown customer for Ship To: "${shipToLP}"`)
  return id
}

/**
 * Creates an accounts-receivable invoice in Sage Intacct.
 * One product line per table entry (glAccount 40010) plus one freight line (40700).
 *
 * @param fields        - Extracted PDF fields.
 * @param attachmentKey - Key returned by createAttachment (step 1).
 * @param sageToken     - Sage OAuth access token.
 * @returns             - The invoice key.
 */
export async function createInvoice(
  fields: ExtractedFields,
  attachmentKey: string,
  sageToken: string,
): Promise<string> {
  const manifest = fields.manifest ?? 'Unknown'
  const shipToLP = parseShipToLP(fields.shipTo)
  const customerId = resolveCustomerId(shipToLP)
  const referenceNumber = `BOL # ${manifest} - ${shipToLP}`
  const invoiceDate = toISODate(fields.billDate)
  const termDays = parseDueDays(fields.terms)
  const dueDate = addDays(invoiceDate, termDays)

  // Product lines — one per table entry
  const invoiceTaxEntry = [
    {
      baseTaxAmount: '0',
      txnTaxAmount: '0',
      taxRate: 0,
      orderEntryTaxDetail: { key: '74' },
    },
  ]

  const taxFeeTotal = parseCurrency(fields.taxFeeTotal)

  const productLines = fields.tableEntries.map((entry, i) => {
    const amount =
      parseCurrency(entry.productTotal) + (i === 0 ? taxFeeTotal : 0)
    return {
      txnAmount: amount.toFixed(2),
      glAccount: { id: '40010' },
      memo: entry.product,
      dimensions: {
        location: { id: LOCATION_ID },
        customer: { id: customerId },
      },
      taxEntries: invoiceTaxEntry,
    }
  })

  // Freight line
  const freightAmount =
    parseCurrency(fields.freightTotal) + parseCurrency(fields.surcharges)
  const freightLine = {
    txnAmount: freightAmount.toFixed(2),
    glAccount: { id: '40700' },
    memo: `Total Freight Charges on BOL # ${manifest} - ${shipToLP}`,
    dimensions: {
      location: { id: LOCATION_ID },
      customer: { id: customerId },
    },
    taxEntries: invoiceTaxEntry,
  }

  const body = {
    customer: { id: customerId },
    referenceNumber,
    description: referenceNumber,
    term: { id: '5 Days' },
    invoiceDate,
    dueDate,
    currency: {
      txnCurrency: 'CAD',
      exchangeRate: {
        date: dueDate,
        typeId: 'Intacct Daily Rate',
        rate: 0.05112,
      },
    },
    attachment: { key: attachmentKey },
    state: 'draft',
    lines: [...productLines, freightLine],
  }

  console.log('[sage] AR invoice request body:', body)
  const res = await apiFetch('/api/sage/invoice', {
    method: 'POST',
    headers: { 'X-Sage-Token': sageToken },
    body: JSON.stringify(body),
  })

  const data: SageResult = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(
      (data as unknown as { message?: string } | null)?.message ??
        `Sage invoice creation failed (${res.status})`,
    )
  }

  console.log('[sage] Invoice created successfully:', data)
  return data['ia::result'].key
}
