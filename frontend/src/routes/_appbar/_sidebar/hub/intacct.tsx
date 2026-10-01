import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { can, getExternalToken } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'
import { SitePicker } from '@/components/custom/SitePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_appbar/_sidebar/hub/intacct')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.intacct', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const HUB = 'https://app.gen7fuel.com'

interface SageCustomer {
  id: string
  name: string
}

async function getSageToken(): Promise<string> {
  const tokenRes = await apiFetch('/api/sage/connect', { method: 'POST' })
  if (!tokenRes.ok) throw new Error('Failed to get Sage token')
  const { access_token: sageToken } = (await tokenRes.json()) as {
    access_token: string
  }
  return sageToken
}

// ---------------------------------------------------------------------------
// Date range + charges label
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Computes yesterday first, then takes the Monday on/before it — so opening
// the page on a Monday falls back to the prior week's Mon-Sun range instead
// of producing an inverted/empty one.
function computeLastWeekRange(): { startDate: string; endDate: string } {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const diffToMonday = (yesterday.getDay() + 6) % 7
  const monday = new Date(yesterday)
  monday.setDate(yesterday.getDate() - diffToMonday)
  return { startDate: toDateStr(monday), endDate: toDateStr(yesterday) }
}

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// e.g. "Sep 22nd, 2026" (single day), "Sep 14th-20th, 2026" (same month), or
// "Aug 31st, 2026-Sep 2nd, 2026" when the range crosses a month/year boundary.
function formatDateRangeLabel(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return format(parseDateStr(startDate), 'MMM do, yyyy')
  }

  const start = parseDateStr(startDate)
  const end = parseDateStr(endDate)
  const sameMonthYear =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()

  return sameMonthYear
    ? `${format(start, 'MMM do')}-${format(end, 'do')}, ${format(end, 'yyyy')}`
    : `${format(start, 'MMM do, yyyy')}-${format(end, 'MMM do, yyyy')}`
}

function buildChargesLabel(startDate: string, endDate: string): string {
  return `${formatDateRangeLabel(startDate, endDate)} charges on account`
}

interface WeekOption {
  label: string
  startDate: string
  endDate: string
}

// Four selectable weeks: the latest (Monday on/before yesterday, through
// yesterday — matches computeLastWeekRange's self-correcting behavior), then
// three full Monday-Sunday weeks stepping back from there.
function computeWeekOptions(): Array<WeekOption> {
  const latest = computeLastWeekRange()
  const options: Array<WeekOption> = []
  let start = parseDateStr(latest.startDate)
  let end = parseDateStr(latest.endDate)

  for (let i = 0; i < 4; i++) {
    const startDate = toDateStr(start)
    const endDate = toDateStr(end)
    options.push({
      label: formatDateRangeLabel(startDate, endDate),
      startDate,
      endDate,
    })

    const prevEnd = new Date(start)
    prevEnd.setDate(start.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevEnd.getDate() - 6)
    start = prevStart
    end = prevEnd
  }

  return options
}

function formatAmount(amount: number): string {
  return `$${(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

interface PurchaseOrderRow {
  _id: string
  date: string
  dateStr?: string
  stationName: string
  customerName: string
  poNumber: string
  quantity: number
  amount: number
}

async function fetchArPurchaseOrders(
  startDate: string,
  endDate: string,
  site: string,
): Promise<Array<PurchaseOrderRow>> {
  const params = new URLSearchParams({ startDate, endDate })
  if (site !== 'all') {
    params.set('site', site)
    params.set('stationName', site)
  }
  const res = await fetch(`${HUB}/api/purchase-orders?${params}`, {
    headers: {
      Authorization: `Bearer ${getExternalToken()}`,
      'X-Required-Permission': 'po',
    },
  })
  if (!res.ok) throw new Error('Failed to fetch purchase orders')
  const data: unknown = await res.json()
  return Array.isArray(data) ? (data as Array<PurchaseOrderRow>) : []
}

// ---------------------------------------------------------------------------
// Kardpoll (cardlock) AR transactions
// ---------------------------------------------------------------------------

interface KardpollArRow {
  customer: string
  card: string
  amount: number
  quantity: number
  price_per_litre: number
}

interface KardpollReportDoc {
  _id: string
  site: string
  date: string
  ar_rows: Array<KardpollArRow>
}

async function fetchKardpollReports(
  startDate: string,
  endDate: string,
  site?: string,
): Promise<Array<KardpollReportDoc>> {
  const params = new URLSearchParams({ startDate, endDate })
  if (site) params.set('site', site)
  const res = await fetch(`${HUB}/api/cash-rec/kardpoll-entries?${params}`, {
    headers: { Authorization: `Bearer ${getExternalToken()}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Kardpoll reports')
  const data: unknown = await res.json()
  return Array.isArray(data) ? (data as Array<KardpollReportDoc>) : []
}

// Kardpoll ar_rows store the customer as a leading numeric code plus the
// name, e.g. "000325 GMR Construct" — strip the code before comparing.
function kardpollCustomerName(raw: string): string {
  return raw.replace(/^\d+\s*/, '').trim()
}

function matchesKardpollCustomer(
  rawCustomer: string,
  sageCustomerName: string,
): boolean {
  const stripped = kardpollCustomerName(rawCustomer).toLowerCase()
  const sageName = sageCustomerName.trim().toLowerCase()
  if (!stripped || !sageName) return false
  return (
    stripped === sageName ||
    stripped.includes(sageName) ||
    sageName.includes(stripped)
  )
}

async function searchCustomers(
  sageToken: string,
  q: string,
): Promise<Array<SageCustomer>> {
  const res = await apiFetch(
    `/api/sage/customers?q=${encodeURIComponent(q)}`,
    { headers: { 'X-Sage-Token': sageToken } },
  )
  if (!res.ok) throw new Error('Failed to search Sage customers')
  const data = (await res.json()) as {
    'ia::result'?: Array<SageCustomer>
  }
  return data['ia::result'] ?? []
}

// ---------------------------------------------------------------------------
// AR Invoice creation
// ---------------------------------------------------------------------------

const INVOICE_GL_ACCOUNT = '40010'
const INVOICE_LOCATION_ID = 'A210'
const INVOICE_TERM_ID = 'Due on Receipt'
const INVOICE_CUSTOMER_MESSAGE_ID = 'Payment'
// "Exempt Services Sale - CA" (key 74) per GET /objects/tax/tax-detail — same
// GL account (40010) already uses this in the fuel-invoicing AR flow. GL
// 40010 has no default tax mapping, so relying on a bare invoice-level
// taxSolution (previous attempt) still hit SL-0749; the detail has to be
// sent explicitly per line via the taxEntries.orderEntryTaxDetail field.
const INVOICE_TAX_DETAIL_KEY = '74'

interface InvoiceLine {
  txnAmount: string
  glAccount: { id: string }
  memo: string
  dimensions: { location: { id: string } }
  taxEntries: Array<{
    baseTaxAmount: string
    txnTaxAmount: string
    taxRate: number
    orderEntryTaxDetail: { key: string }
  }>
}

// Sage error responses put the useful detail in ia::error.details[] (one
// entry per invalid field/line) — fall back to the top-level message, or the
// raw body, when details aren't present.
function parseSageErrorDetail(body: unknown): string {
  const err = (
    body as
      | {
          'ia::error'?: {
            message?: string
            details?: Array<{ message?: string; target?: string }>
          }
          message?: string
        }
      | null
  )?.['ia::error']
  const detailMessages = err?.details
    ?.map((d) => (d.target ? `${d.target}: ${d.message}` : d.message))
    .filter(Boolean)
  return (
    (detailMessages && detailMessages.length > 0
      ? detailMessages.join('; ')
      : undefined) ??
    err?.message ??
    (body as { message?: string } | null)?.message ??
    JSON.stringify(body)
  )
}

// A matched AR entry ready to become one invoice line, regardless of
// whether it came from the PO module or a Kardpoll (cardlock) report.
interface InvoiceLineSource {
  key: string
  source: 'PO' | 'Kardpoll'
  station: string
  memo: string
  amount: number
}

function buildInvoiceLines(
  sources: Array<InvoiceLineSource>,
): Array<InvoiceLine> {
  return sources.map((source) => ({
    txnAmount: (Number(source.amount) || 0).toFixed(2),
    glAccount: { id: INVOICE_GL_ACCOUNT },
    memo: source.memo,
    dimensions: { location: { id: INVOICE_LOCATION_ID } },
    taxEntries: [
      {
        baseTaxAmount: '0',
        txnTaxAmount: '0',
        taxRate: 0,
        orderEntryTaxDetail: { key: INVOICE_TAX_DETAIL_KEY },
      },
    ],
  }))
}

async function createInvoice(
  sageToken: string,
  customer: SageCustomer,
  range: { startDate: string; endDate: string },
  referenceNumber: string,
  description: string,
  sources: Array<InvoiceLineSource>,
): Promise<{ id: string; key: string }> {
  const payload = {
    invoiceDate: range.endDate,
    dueDate: range.endDate,
    customer: { id: customer.id },
    customerMessage: { id: INVOICE_CUSTOMER_MESSAGE_ID },
    referenceNumber,
    description,
    term: { id: INVOICE_TERM_ID },
    currency: { txnCurrency: 'CAD' },
    state: 'draft',
    lines: buildInvoiceLines(sources),
  }

  const res = await apiFetch('/api/sage/invoice', {
    method: 'POST',
    headers: { 'X-Sage-Token': sageToken },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(`Sage ${res.status}: ${parseSageErrorDetail(body)}`)
  }

  const result = body?.['ia::result'] as
    | { id: string; key: string }
    | undefined
  if (!result?.id) throw new Error('Sage did not return an invoice id.')
  return result
}

// ---------------------------------------------------------------------------
// AP Bill creation — mirrors the AR invoice, split one bill per station the
// matched AR lines originated from (each station has its own "Gen7 LP
// {Station}" AP vendor record representing the inter-company payable).
// ---------------------------------------------------------------------------

const AP_BILL_GL_ACCOUNT = '50350'
// "ON HST Exempt" (key 73) per GET /objects/tax/purchasing-tax-detail —
// the AP-side equivalent of the AR invoice's tax-detail lookup.
const AP_BILL_TAX_DETAIL_KEY = '73'

interface SageVendor {
  id: string
  name: string
}

async function findVendorForStation(
  sageToken: string,
  station: string,
): Promise<SageVendor> {
  const q = `Gen7 LP ${station}`
  const res = await apiFetch(`/api/sage/vendors?q=${encodeURIComponent(q)}`, {
    headers: { 'X-Sage-Token': sageToken },
  })
  if (!res.ok)
    throw new Error(`Failed to search Sage vendors for "${station}"`)
  const data = (await res.json()) as { 'ia::result'?: Array<SageVendor> }
  const results = data['ia::result'] ?? []
  const exact = results.find(
    (v) => v.name.trim().toLowerCase() === q.trim().toLowerCase(),
  )
  const vendor = exact ?? (results.length === 1 ? results[0] : undefined)
  if (!vendor) {
    throw new Error(
      `Could not resolve a unique Sage vendor for "${station}" (searched "${q}")`,
    )
  }
  return vendor
}

function buildApBillLabel(
  station: string,
  startDate: string,
  endDate: string,
): string {
  return `${station} station AR due from Gen7 LP - ${formatDateRangeLabel(startDate, endDate)}`
}

async function createApBill(
  sageToken: string,
  vendor: SageVendor,
  range: { startDate: string; endDate: string },
  label: string,
  amount: number,
): Promise<{ id: string; key: string }> {
  const payload = {
    createdDate: range.endDate,
    postingDate: range.endDate,
    dueDate: range.endDate,
    vendor: { id: vendor.id },
    referenceNumber: label,
    description: label,
    term: { id: INVOICE_TERM_ID },
    currency: { txnCurrency: 'CAD' },
    state: 'draft',
    lines: [
      {
        txnAmount: (Number(amount) || 0).toFixed(2),
        glAccount: { id: AP_BILL_GL_ACCOUNT },
        memo: label,
        dimensions: { location: { id: INVOICE_LOCATION_ID } },
        taxEntries: [
          {
            baseTaxAmount: '0',
            txnTaxAmount: '0',
            taxRate: 0,
            orderEntryTaxDetail: { key: AP_BILL_TAX_DETAIL_KEY },
          },
        ],
      },
    ],
  }

  const res = await apiFetch('/api/sage/bill', {
    method: 'POST',
    headers: { 'X-Sage-Token': sageToken },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(`Sage ${res.status}: ${parseSageErrorDetail(body)}`)
  }

  const result = body?.['ia::result'] as
    | { id: string; key: string }
    | undefined
  if (!result?.id) throw new Error('Sage did not return a bill id.')
  return result
}

interface ApBillResult {
  station: string
  amount: number
  status: 'pending' | 'success' | 'error'
  id?: string
  key?: string
  errorMessage?: string
}

async function createApBillsForStations(
  sageToken: string,
  range: { startDate: string; endDate: string },
  stationTotals: Array<{ station: string; amount: number }>,
  onSettled: (result: ApBillResult) => void,
): Promise<void> {
  await Promise.all(
    stationTotals.map(async ({ station, amount }) => {
      try {
        const vendor = await findVendorForStation(sageToken, station)
        const label = buildApBillLabel(
          station,
          range.startDate,
          range.endDate,
        )
        const result = await createApBill(sageToken, vendor, range, label, amount)
        onSettled({
          station,
          amount,
          status: 'success',
          id: result.id,
          key: result.key,
        })
      } catch (err) {
        onSettled({
          station,
          amount,
          status: 'error',
          errorMessage:
            err instanceof Error ? err.message : 'Failed to create AP bill',
        })
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// Site AR Invoice — one invoice per site, created under that site's own
// Sage entity, billed to the "Gen7 LP" customer, one aggregate line per
// real-world AR customer active at that site (across PO + Kardpoll).
// ---------------------------------------------------------------------------

const SITE_INVOICE_GL_ACCOUNT = '10440'

async function resolveSiteEntity(
  sageToken: string,
  site: string,
): Promise<string> {
  const locRes = await fetch(`${HUB}/api/locations`, {
    headers: { Authorization: `Bearer ${getExternalToken()}` },
  })
  if (!locRes.ok) throw new Error('Failed to fetch Hub locations')
  const locations = (await locRes.json()) as Array<{
    stationName: string
    site?: string
    sageEntityKey?: string
  }>
  const loc = locations.find((l) => (l.site ?? l.stationName) === site)
  if (!loc?.sageEntityKey)
    throw new Error(`No Sage entity key configured for "${site}"`)

  const entityRes = await apiFetch(`/api/sage/entity/${loc.sageEntityKey}`, {
    headers: { 'X-Sage-Token': sageToken },
  })
  if (!entityRes.ok) throw new Error('Failed to fetch Sage entity')
  const entityData = (await entityRes.json()) as {
    'ia::result': { id: string }
  }
  const locationId = entityData['ia::result'].id
  if (!locationId) throw new Error('Could not resolve Sage location ID')
  return locationId
}

async function findGen7LpCustomer(
  sageToken: string,
  entityId: string,
): Promise<SageCustomer> {
  const res = await apiFetch('/api/sage/customers?q=Gen7 LP', {
    headers: { 'X-Sage-Token': sageToken, 'X-Sage-Entity': entityId },
  })
  if (!res.ok) throw new Error('Failed to search Sage customers')
  const data = (await res.json()) as { 'ia::result'?: Array<SageCustomer> }
  const results = data['ia::result'] ?? []
  const exact = results.find((c) => c.name.trim().toLowerCase() === 'gen7 lp')
  const customer = exact ?? (results.length === 1 ? results[0] : undefined)
  if (!customer) {
    throw new Error(
      'Could not resolve a unique "Gen7 LP" customer for this site',
    )
  }
  return customer
}

interface SiteInvoiceLine {
  key: string
  customerLabel: string
  amount: number
}

function groupBySiteCustomer(
  orders: Array<PurchaseOrderRow>,
  kardpollDocs: Array<KardpollReportDoc>,
): Array<SiteInvoiceLine> {
  const totals = new Map<string, number>()

  orders.forEach((order) => {
    const name = order.customerName.trim()
    if (!name) return
    totals.set(name, (totals.get(name) ?? 0) + (Number(order.amount) || 0))
  })

  kardpollDocs.forEach((doc) => {
    doc.ar_rows.forEach((row) => {
      const name = kardpollCustomerName(row.customer)
      if (!name) return
      totals.set(name, (totals.get(name) ?? 0) + (Number(row.amount) || 0))
    })
  })

  return Array.from(totals, ([customerLabel, amount]) => ({
    key: customerLabel,
    customerLabel,
    amount,
  }))
}

function buildSiteInvoiceLines(
  lines: Array<SiteInvoiceLine>,
  entityLocationId: string,
  dateLabel: string,
): Array<InvoiceLine> {
  return lines.map((line) => ({
    txnAmount: (Number(line.amount) || 0).toFixed(2),
    glAccount: { id: SITE_INVOICE_GL_ACCOUNT },
    memo: `${line.customerLabel} - ${dateLabel} AR Invoice`,
    dimensions: { location: { id: entityLocationId } },
    taxEntries: [
      {
        baseTaxAmount: '0',
        txnTaxAmount: '0',
        taxRate: 0,
        orderEntryTaxDetail: { key: INVOICE_TAX_DETAIL_KEY },
      },
    ],
  }))
}

async function createSiteInvoice(
  sageToken: string,
  entityLocationId: string,
  customer: SageCustomer,
  range: { startDate: string; endDate: string },
  lines: Array<SiteInvoiceLine>,
): Promise<{ id: string; key: string }> {
  const dateLabel = formatDateRangeLabel(range.startDate, range.endDate)
  const referenceNumber = `${dateLabel} AR Invoice`
  const payload = {
    invoiceDate: range.endDate,
    dueDate: range.endDate,
    customer: { id: customer.id },
    customerMessage: { id: INVOICE_CUSTOMER_MESSAGE_ID },
    referenceNumber,
    description: referenceNumber,
    term: { id: INVOICE_TERM_ID },
    currency: { txnCurrency: 'CAD' },
    state: 'draft',
    lines: buildSiteInvoiceLines(lines, entityLocationId, dateLabel),
  }

  const res = await apiFetch('/api/sage/invoice', {
    method: 'POST',
    headers: {
      'X-Sage-Token': sageToken,
      'X-Sage-Entity': entityLocationId,
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(`Sage ${res.status}: ${parseSageErrorDetail(body)}`)
  }

  const result = body?.['ia::result'] as
    | { id: string; key: string }
    | undefined
  if (!result?.id) throw new Error('Sage did not return an invoice id.')
  return result
}

function SiteInvoicePanel({
  range,
  sageToken,
  site,
}: {
  range: { startDate: string; endDate: string }
  sageToken: string
  site: string | undefined
}) {
  const [entityLocationId, setEntityLocationId] = useState<string | null>(
    null,
  )
  const [entityLoading, setEntityLoading] = useState(false)
  const [entityError, setEntityError] = useState('')

  useEffect(() => {
    setEntityLocationId(null)
    setEntityError('')
    if (!site) return

    let cancelled = false
    setEntityLoading(true)
    resolveSiteEntity(sageToken, site)
      .then((locationId) => {
        if (!cancelled) setEntityLocationId(locationId)
      })
      .catch((err) => {
        if (!cancelled)
          setEntityError(
            err instanceof Error ? err.message : 'Failed to resolve site entity',
          )
      })
      .finally(() => {
        if (!cancelled) setEntityLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [site, sageToken])

  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
  } = useQuery({
    queryKey: ['ar-purchase-orders', range.startDate, range.endDate, site],
    queryFn: () => fetchArPurchaseOrders(range.startDate, range.endDate, site ?? 'all'),
    enabled: !!site,
  })

  const {
    data: kardpollDocs = [],
    isLoading: kardpollLoading,
    error: kardpollError,
  } = useQuery({
    queryKey: ['kardpoll-reports', range.startDate, range.endDate, site],
    queryFn: () => fetchKardpollReports(range.startDate, range.endDate, site),
    enabled: !!site,
  })

  const dataLoading = ordersLoading || kardpollLoading
  const dataError = ordersError || kardpollError

  const lines = groupBySiteCustomer(orders, kardpollDocs)
  const total = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0)

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [created, setCreated] = useState<{ id: string; key: string } | null>(
    null,
  )

  async function handleCreate() {
    if (!site || !entityLocationId) return
    setCreating(true)
    setCreateError('')
    try {
      const customer = await findGen7LpCustomer(sageToken, entityLocationId)
      const result = await createSiteInvoice(
        sageToken,
        entityLocationId,
        customer,
        range,
        lines,
      )
      setCreated(result)
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create invoice',
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mb-8 space-y-3">
      <h2 className="text-base font-semibold">Site AR Invoice</h2>

      {!site && (
        <p className="text-sm text-muted-foreground">
          Select a site to preview its AR invoice.
        </p>
      )}
      {site && entityLoading && (
        <p className="text-sm text-muted-foreground">
          Resolving Sage entity…
        </p>
      )}
      {site && entityError && (
        <p className="text-sm text-destructive">{entityError}</p>
      )}

      {site && !entityLoading && !entityError && (
        <>
          {dataLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {dataError && (
            <p className="text-sm text-destructive">
              Failed to load purchase orders or Kardpoll reports.
            </p>
          )}

          {!dataLoading && !dataError && (
            <>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No AR transactions found for {site} in this date range.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.key}>
                        <TableCell className="text-sm">
                          {line.customerLabel}
                        </TableCell>
                        <TableCell className="text-sm">
                          {SITE_INVOICE_GL_ACCOUNT}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatAmount(line.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell>{formatAmount(total)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}

              <Button
                size="sm"
                disabled={lines.length === 0 || creating || !!created}
                onClick={() => void handleCreate()}
              >
                {creating ? 'Creating…' : 'Create Invoice (Draft)'}
              </Button>

              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              {created && (
                <p className="text-sm text-emerald-600">
                  Draft invoice created — id {created.id}, key {created.key}.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function CustomerInvoicePanel({
  range,
  referenceNumber,
  description,
  sageToken,
  customer,
}: {
  range: { startDate: string; endDate: string }
  referenceNumber: string
  description: string
  sageToken: string
  customer: SageCustomer
}) {
  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
  } = useQuery({
    queryKey: ['ar-purchase-orders', range.startDate, range.endDate, 'all'],
    queryFn: () => fetchArPurchaseOrders(range.startDate, range.endDate, 'all'),
  })

  const {
    data: kardpollDocs = [],
    isLoading: kardpollLoading,
    error: kardpollError,
  } = useQuery({
    queryKey: ['kardpoll-reports', range.startDate, range.endDate],
    queryFn: () => fetchKardpollReports(range.startDate, range.endDate),
  })

  const isLoading = ordersLoading || kardpollLoading
  const error = ordersError || kardpollError

  const matchedPoLines: Array<InvoiceLineSource> = orders
    .filter(
      (order) =>
        order.customerName.trim().toLowerCase() ===
        customer.name.trim().toLowerCase(),
    )
    .map((order) => ({
      key: order._id,
      source: 'PO',
      station: order.stationName,
      memo: order.poNumber,
      amount: order.amount,
    }))

  const matchedKardpollLines: Array<InvoiceLineSource> = kardpollDocs.flatMap(
    (doc) =>
      doc.ar_rows
        .map((row, i) => ({ row, i }))
        .filter(({ row }) => matchesKardpollCustomer(row.customer, customer.name))
        .map(({ row, i }) => ({
          key: `${doc._id}-${i}`,
          source: 'Kardpoll' as const,
          station: doc.site,
          memo: row.card,
          amount: row.amount,
        })),
  )

  const matchedLines = [...matchedPoLines, ...matchedKardpollLines]
  const poSubtotal = matchedPoLines.reduce(
    (sum, line) => sum + (Number(line.amount) || 0),
    0,
  )
  const kardpollSubtotal = matchedKardpollLines.reduce(
    (sum, line) => sum + (Number(line.amount) || 0),
    0,
  )
  const total = poSubtotal + kardpollSubtotal

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [created, setCreated] = useState<{ id: string; key: string } | null>(
    null,
  )
  const [apBillResults, setApBillResults] = useState<Array<ApBillResult>>([])

  async function handleCreateInvoice() {
    setCreating(true)
    setCreateError('')
    try {
      const result = await createInvoice(
        sageToken,
        customer,
        range,
        referenceNumber,
        description,
        matchedLines,
      )
      setCreated(result)

      const stationTotals = Array.from(
        matchedLines.reduce((map, line) => {
          map.set(line.station, (map.get(line.station) ?? 0) + (Number(line.amount) || 0))
          return map
        }, new Map<string, number>()),
      ).map(([station, amount]) => ({ station, amount }))

      setApBillResults(
        stationTotals.map(({ station, amount }) => ({
          station,
          amount,
          status: 'pending' as const,
        })),
      )
      void createApBillsForStations(sageToken, range, stationTotals, (update) => {
        setApBillResults((prev) =>
          prev.map((r) => (r.station === update.station ? update : r)),
        )
      })
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create invoice',
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mb-8 space-y-3">
      <h2 className="text-base font-semibold">
        Invoice Preview — {customer.name}
      </h2>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Failed to load purchase orders or Kardpoll reports.
        </p>
      )}

      {!isLoading && !error && (
        <>
          {matchedLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No AR transactions (purchase orders or cardlock) found for{' '}
              {customer.name} in this date range.
            </p>
          ) : (
            <div className="space-y-4">
              {matchedPoLines.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-sm font-medium">
                    Purchase Orders
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO #</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchedPoLines.map((line) => (
                        <TableRow key={line.key}>
                          <TableCell className="font-mono text-sm">
                            {line.memo}
                          </TableCell>
                          <TableCell className="text-sm">
                            {INVOICE_GL_ACCOUNT}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatAmount(line.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2}>Subtotal</TableCell>
                        <TableCell>{formatAmount(poSubtotal)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}

              {matchedKardpollLines.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-sm font-medium">Kardpoll</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Card</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchedKardpollLines.map((line) => (
                        <TableRow key={line.key}>
                          <TableCell className="font-mono text-sm">
                            {line.memo}
                          </TableCell>
                          <TableCell className="text-sm">
                            {INVOICE_GL_ACCOUNT}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatAmount(line.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2}>Subtotal</TableCell>
                        <TableCell>
                          {formatAmount(kardpollSubtotal)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}

              <p className="text-sm font-medium">
                Grand Total: {formatAmount(total)}
              </p>
            </div>
          )}

          <Button
            size="sm"
            disabled={matchedLines.length === 0 || creating || !!created}
            onClick={() => void handleCreateInvoice()}
          >
            {creating ? 'Creating…' : 'Create Invoice (Draft)'}
          </Button>

          {createError && (
            <p className="text-sm text-destructive">{createError}</p>
          )}
          {created && (
            <p className="text-sm text-emerald-600">
              Draft invoice created — id {created.id}, key {created.key}.
            </p>
          )}

          {apBillResults.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">AP Bills</p>
              {apBillResults.map((r) => (
                <p key={r.station} className="text-sm">
                  {r.station} ({formatAmount(r.amount)}):{' '}
                  {r.status === 'pending' && (
                    <span className="text-muted-foreground">Creating…</span>
                  )}
                  {r.status === 'success' && (
                    <span className="text-emerald-600">
                      Draft bill created — id {r.id}, key {r.key}.
                    </span>
                  )}
                  {r.status === 'error' && (
                    <span className="text-destructive">{r.errorMessage}</span>
                  )}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RouteComponent() {
  const [weekOptions] = useState(computeWeekOptions)
  const [selectedWeek, setSelectedWeek] = useState('0')
  const range = weekOptions[Number(selectedWeek)]
  const referenceNumber = buildChargesLabel(range.startDate, range.endDate)
  const description = referenceNumber

  const [sageToken, setSageToken] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(true)
  const [tokenError, setTokenError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [open, setOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] =
    useState<SageCustomer | null>(null)
  const [site, setSite] = useState<string | undefined>(undefined)

  // Fetch the Sage token once on mount — the customer search isn't
  // entity-scoped, so no site selection is needed to enable it.
  useEffect(() => {
    let cancelled = false
    getSageToken()
      .then((token) => {
        if (!cancelled) setSageToken(token)
      })
      .catch((err) => {
        if (!cancelled)
          setTokenError(
            err instanceof Error ? err.message : 'Failed to get Sage token',
          )
      })
      .finally(() => {
        if (!cancelled) setTokenLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  const {
    data: customers = [],
    isLoading: customersLoading,
    error: customersError,
  } = useQuery({
    queryKey: ['sage-customers', debouncedSearch],
    queryFn: () => searchCustomers(sageToken!, debouncedSearch),
    enabled: !!sageToken && open,
  })

  function handleSelect(customer: SageCustomer) {
    setSelectedCustomer(customer)
    setSearchInput(customer.name)
    setOpen(false)
  }

  const inputDisabled = tokenLoading || !!tokenError

  return (
    <div className="p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h1 className="text-lg font-semibold">Intacct</h1>
        <div className="w-72 space-y-1.5">
          <Label>Week</Label>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekOptions.map((option, index) => (
                <SelectItem key={option.startDate} value={String(index)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="w-72 space-y-1.5">
          <Label>AR Customer</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
              <div>
                <Input
                  placeholder={
                    tokenLoading
                      ? 'Connecting to Sage…'
                      : 'Click or type to search…'
                  }
                  value={searchInput}
                  disabled={inputDisabled}
                  onFocus={() => setOpen(true)}
                  onChange={(e) => {
                    setSearchInput(e.target.value)
                    setSelectedCustomer(null)
                    setOpen(true)
                  }}
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="start"
              className="w-72 p-1"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {customersLoading && (
                <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              )}
              {customersError && (
                <p className="px-2 py-2 text-sm text-destructive">
                  Failed to load customers.
                </p>
              )}
              {!customersLoading &&
                !customersError &&
                customers.length === 0 && (
                  <p className="px-2 py-2 text-sm text-muted-foreground">
                    No customers found.
                  </p>
                )}
              {!customersLoading &&
                !customersError &&
                customers.length > 0 && (
                  <div className="max-h-72 overflow-y-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => handleSelect(customer)}
                      >
                        <span className="font-medium">{customer.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {customer.id}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
            </PopoverContent>
          </Popover>
        </div>

        <div className="w-72 space-y-1.5">
          <Label>Site</Label>
          <SitePicker value={site} onValueChange={setSite} />
        </div>
      </div>

      {tokenError && (
        <p className="mb-4 text-sm text-destructive">{tokenError}</p>
      )}

      <div className="text-sm">
        {selectedCustomer ? (
          <p>
            Selected:{' '}
            <span className="font-medium">{selectedCustomer.name}</span>{' '}
            <span className="font-mono text-muted-foreground">
              ({selectedCustomer.id})
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">No customer selected.</p>
        )}
      </div>

      {selectedCustomer && sageToken && (
        <CustomerInvoicePanel
          key={`${selectedCustomer.id}-${selectedWeek}`}
          range={range}
          referenceNumber={referenceNumber}
          description={description}
          sageToken={sageToken}
          customer={selectedCustomer}
        />
      )}

      {sageToken && (
        <SiteInvoicePanel
          key={`${selectedWeek}-${site ?? 'none'}`}
          range={range}
          sageToken={sageToken}
          site={site}
        />
      )}
    </div>
  )
}
