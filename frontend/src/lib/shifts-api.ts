import { getTokenPayload } from '@/lib/permissions'

const HUB = 'https://app.gen7fuel.com'

function getExternalToken(): string {
  const payload = getTokenPayload() as { externalToken?: string } | null
  return payload?.externalToken ?? ''
}

async function hubFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getExternalToken()}`,
    ...(init.headers as Record<string, string> | undefined),
  }
  return fetch(HUB + path, { ...init, headers })
}

// Cash summary ("shift") records in Hub's cashsummaries collection. These
// fields (a subset of the ~60 on the schema) are shown read-only in the
// Shifts table — editing happens only through custom attributes, below.
export interface Shift {
  _id: string
  site: string
  shift_number: string
  date: string
  canadian_cash_collected?: number
  cash_back?: number
  loyalty?: number
  exempted_tax?: number
  chequesCashedOut?: number
  pinpadTotal?: number
  // Hub's cron may flag a shift as Chicken Delight, which repurposes
  // exempted_tax/chequesCashedOut/pinpadTotal on Hub's side — shown
  // distinctly in the table rather than as those (not-applicable) fields.
  isChickenDelight?: boolean
  createdAt?: string
  updatedAt?: string
}

export async function listShifts(site: string): Promise<Array<Shift>> {
  const res = await hubFetch(
    `/api/cash-summary?site=${encodeURIComponent(site)}`,
  )
  if (!res.ok) throw new Error('Failed to fetch shifts')
  return res.json()
}

// ---------------------------------------------------------------------------
// Custom attributes — ad-hoc, typed fields a user can attach to a shift
// document beyond the fixed schema (e.g. posTotal = 123.45 as a Double).
// Written directly onto the Hub document (not nested), via
// PUT/DELETE /api/cash-summary/:id/attributes/:name. Hub rejects any name
// that collides with a real schema field — see thehub's
// backend/utils/shiftAttributes.js for the authoritative check; the
// KNOWN_SHIFT_FIELDS list below is only a display-side mirror of Hub's
// schema, used to tell custom attributes apart from known fields in the UI.
export type AttributeType = 'String' | 'Int32' | 'Double' | 'Boolean'

export async function setShiftAttribute(
  id: string,
  name: string,
  value: string | number | boolean,
  type: AttributeType,
): Promise<Shift> {
  const res = await hubFetch(
    `/api/cash-summary/${id}/attributes/${encodeURIComponent(name)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ value, type }),
    },
  )
  const body = await res.json()
  if (!res.ok)
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to save attribute',
    )
  return body
}

export async function removeShiftAttribute(
  id: string,
  name: string,
): Promise<Shift> {
  const res = await hubFetch(
    `/api/cash-summary/${id}/attributes/${encodeURIComponent(name)}`,
    { method: 'DELETE' },
  )
  const body = await res.json()
  if (!res.ok)
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to remove attribute',
    )
  return body
}

// Every field Hub's CashSummary schema currently defines (kept in sync with
// thehub/backend/models/CashSummaryNew.js) plus Mongo/Mongoose bookkeeping
// fields. Anything on a shift document that ISN'T in this set is treated as
// a custom attribute for display purposes. This list drifting out of date
// only affects display categorization here — it has no bearing on the
// actual collision protection, which is enforced server-side regardless.
const KNOWN_SHIFT_FIELDS = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'site',
  'shift_number',
  'date',
  'stationStart',
  'stationEnd',
  'canadian_cash_collected',
  'item_sales',
  'cash_back',
  'loyalty',
  'cpl_bulloch',
  'exempted_tax',
  'report_canadian_cash',
  'payouts',
  'tenders',
  'fuelGrades',
  'arCustomers',
  'tobaccoCig',
  'tobaccoOthers',
  'propaneSales',
  'bingoSales',
  'fuelSales',
  'companyCoupon',
  'dealGroupCplDiscounts',
  'fuelPriceOverrides',
  'parsedItemSales',
  'depositTotal',
  'gst',
  'pst',
  'pennyRounding',
  'totalSales',
  'afdCredit',
  'afdDebit',
  'kioskCredit',
  'kioskDebit',
  'afdGiftCard',
  'kioskGiftCard',
  'totalPos',
  'arIncurred',
  'grandTotal',
  'missedCpl',
  'couponsAccepted',
  'giftCertificates',
  'cashOffCoupons',
  'gasolineCoupons',
  'otherCoupons',
  'canadianCash',
  'cashOnHand',
  'parsedCashBack',
  'parsedPayouts',
  'safedropsCount',
  'safedropsAmount',
  'voidedTransactionsAmount',
  'voidedTransactionsCount',
  'lottoPayout',
  'onlineLottoTotal',
  'instantLottTotal',
  'dataWave',
  'feeDataWave',
  'unsettledPrepays',
  'chequesCashedOut',
  'pinpadTotal',
  'pinpadPhoto',
  'isChickenDelight',
  'chickenDelightTips',
  'reviewed',
  'createdBy',
])

export function getCustomAttributes(
  shift: Shift,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {}
  for (const [key, val] of Object.entries(shift)) {
    if (KNOWN_SHIFT_FIELDS.has(key)) continue
    if (
      typeof val === 'string' ||
      typeof val === 'number' ||
      typeof val === 'boolean'
    ) {
      result[key] = val
    }
  }
  return result
}
