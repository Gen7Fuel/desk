import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { can, getExternalToken } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'
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
// AR Purchase Orders (last week) panel
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

function formatDateLabel(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// e.g. "Sep 14th-20th, 2026 charges on account", or when the range crosses a
// month/year boundary: "Aug 31st, 2026-Sep 2nd, 2026 charges on account".
function buildChargesLabel(startDate: string, endDate: string): string {
  const start = parseDateStr(startDate)
  const end = parseDateStr(endDate)
  const sameMonthYear =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()

  const range = sameMonthYear
    ? `${format(start, 'MMM do')}-${format(end, 'do')}, ${format(end, 'yyyy')}`
    : `${format(start, 'MMM do, yyyy')}-${format(end, 'MMM do, yyyy')}`

  return `${range} charges on account`
}

function formatAmount(amount: number): string {
  return `$${(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

interface HubLocation {
  stationName: string
  site?: string
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

function poRowDate(row: Pick<PurchaseOrderRow, 'date' | 'dateStr'>): string {
  return row.dateStr || new Date(row.date).toLocaleDateString('en-CA')
}

async function fetchHubLocations(): Promise<Array<HubLocation>> {
  const res = await fetch(`${HUB}/api/locations`, {
    headers: { Authorization: `Bearer ${getExternalToken()}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Hub locations')
  return (await res.json()) as Array<HubLocation>
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
): Promise<Array<KardpollReportDoc>> {
  const params = new URLSearchParams({ startDate, endDate })
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

function ArPurchaseOrdersPanel() {
  const [range] = useState(computeLastWeekRange)
  const [poSite, setPoSite] = useState('all')

  const { data: locations = [] } = useQuery({
    queryKey: ['hub-locations'],
    queryFn: fetchHubLocations,
  })

  const {
    data: orders = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ar-purchase-orders', range.startDate, range.endDate, poSite],
    queryFn: () =>
      fetchArPurchaseOrders(range.startDate, range.endDate, poSite),
  })

  const total = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0)

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">AR Purchase Orders</h2>
          <p className="text-sm text-muted-foreground">
            {formatDateLabel(range.startDate)} –{' '}
            {formatDateLabel(range.endDate)}
          </p>
        </div>
        <div className="w-56 space-y-1.5">
          <Label>Site</Label>
          <Select value={poSite} onValueChange={setPoSite}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {locations.map((loc) => {
                const name = loc.site ?? loc.stationName
                return (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Failed to load purchase orders.
        </p>
      )}

      {!isLoading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>PO #</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground"
                >
                  No AR purchase orders found.
                </TableCell>
              </TableRow>
            )}
            {orders.map((order) => (
              <TableRow key={order._id}>
                <TableCell className="text-sm">{poRowDate(order)}</TableCell>
                <TableCell className="text-sm">
                  {order.stationName}
                </TableCell>
                <TableCell className="text-sm">
                  {order.customerName}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {order.poNumber}
                </TableCell>
                <TableCell className="text-sm">{order.quantity}</TableCell>
                <TableCell className="text-sm">
                  {formatAmount(order.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {orders.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>Total</TableCell>
                <TableCell>{formatAmount(total)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      )}
    </div>
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

// A matched AR entry ready to become one invoice line, regardless of
// whether it came from the PO module or a Kardpoll (cardlock) report.
interface InvoiceLineSource {
  key: string
  source: 'PO' | 'Kardpoll'
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
    const err = body?.['ia::error'] as
      | {
          message?: string
          details?: Array<{ message?: string; target?: string }>
        }
      | undefined
    const detailMessages = err?.details
      ?.map((d) => (d.target ? `${d.target}: ${d.message}` : d.message))
      .filter(Boolean)
    const detail =
      (detailMessages && detailMessages.length > 0
        ? detailMessages.join('; ')
        : undefined) ??
      err?.message ??
      (body?.message as string | undefined) ??
      JSON.stringify(body)
    throw new Error(`Sage ${res.status}: ${detail}`)
  }

  const result = body?.['ia::result'] as
    | { id: string; key: string }
    | undefined
  if (!result?.id) throw new Error('Sage did not return an invoice id.')
  return result
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
          memo: row.card,
          amount: row.amount,
        })),
  )

  const matchedLines = [...matchedPoLines, ...matchedKardpollLines]
  const total = matchedLines.reduce(
    (sum, line) => sum + (Number(line.amount) || 0),
    0,
  )

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [created, setCreated] = useState<{ id: string; key: string } | null>(
    null,
  )

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchedLines.map((line) => (
                  <TableRow key={line.key}>
                    <TableCell className="text-sm">{line.source}</TableCell>
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
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell>{formatAmount(total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
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
        </>
      )}
    </div>
  )
}

function RouteComponent() {
  const [range] = useState(computeLastWeekRange)
  const [referenceNumber] = useState(() =>
    buildChargesLabel(range.startDate, range.endDate),
  )
  const [description] = useState(() =>
    buildChargesLabel(range.startDate, range.endDate),
  )

  const [sageToken, setSageToken] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(true)
  const [tokenError, setTokenError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [open, setOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] =
    useState<SageCustomer | null>(null)

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
      <h1 className="mb-6 text-lg font-semibold">Intacct</h1>

      <ArPurchaseOrdersPanel />

      <div className="mb-8 space-y-1 text-sm">
        <p>
          <span className="font-medium">Reference Number:</span>{' '}
          {referenceNumber}
        </p>
        <p>
          <span className="font-medium">Description:</span> {description}
        </p>
      </div>

      <div className="mb-4 w-72 space-y-1.5">
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
          key={selectedCustomer.id}
          range={range}
          referenceNumber={referenceNumber}
          description={description}
          sageToken={sageToken}
          customer={selectedCustomer}
        />
      )}
    </div>
  )
}
