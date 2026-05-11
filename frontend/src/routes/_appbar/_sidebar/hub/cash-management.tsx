import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { format, getDay, parseISO, subDays } from 'date-fns'
import { can, getTokenPayload } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'
import { SitePicker } from '@/components/custom/SitePicker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_appbar/_sidebar/hub/cash-management')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.cashManagement', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const HUB = 'https://app.gen7fuel.com'

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function getExternalToken(): string {
  const payload = getTokenPayload() as
    | (ReturnType<typeof getTokenPayload> & { externalToken?: string })
    | null
  return payload?.externalToken ?? ''
}

interface BankEntry {
  amount: number
}

interface CashRecResponse {
  kardpoll: { sales: number; ar: number } | null
  bank: {
    miscCredits?: Array<BankEntry>
    gblCredits?: Array<BankEntry>
    merchantFees?: number
    gblCreditsFiltered?: number
    ontarioIntegratedTax?: number
    transferFrom?: number
    nightDeposit?: number
  } | null
  cashSummary: {
    totals: {
      totalPos?: number
      afdGiftCard?: number
      kioskGiftCard?: number
      totalSales?: number
      item_sales?: number
      report_canadian_cash?: number
      missedCpl?: number
      canadian_cash_collected?: number
      couponsAccepted?: number
      giftCertificates?: number
    }
    handheldDebit?: number
    unsettledPrepays?: number
  } | null
  adjustedOverShort?: number | null
  bankRec?: number
}

interface ArRow {
  customerName?: string
  customer?: string
  amount?: number
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtVal(v: number): string {
  const abs = Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return v < 0 ? `(${abs})` : abs
}

// ── Aggregation helpers ───────────────────────────────────────────────────────

async function resolveAggregateDates(
  site: string,
  selectedDate: string,
): Promise<Array<string>> {
  const windowStart = format(subDays(parseISO(selectedDate), 14), 'yyyy-MM-dd')
  const tagsRes = await fetch(
    `${HUB}/api/cash-rec/tags?site=${encodeURIComponent(site)}&startDate=${windowStart}&endDate=${selectedDate}`,
    { headers: { Authorization: `Bearer ${getExternalToken()}` } },
  )
  const taggedDates = new Set<string>(
    tagsRes.ok
      ? ((await tagsRes.json()) as Array<{ date: string }>).map((t) => t.date)
      : [],
  )

  const dates: Array<string> = [selectedDate]
  let cursor = subDays(parseISO(selectedDate), 1)
  for (let i = 0; i < 14; i++) {
    const ds = format(cursor, 'yyyy-MM-dd')
    const dow = getDay(cursor) // 0=Sun 5=Fri 6=Sat
    if (dow === 5 || dow === 6 || taggedDates.has(ds)) {
      dates.unshift(ds)
      cursor = subDays(cursor, 1)
    } else {
      break
    }
  }
  return dates
}

function sumResponses(arr: Array<CashRecResponse>): CashRecResponse {
  const sumNum = (fn: (r: CashRecResponse) => number | undefined) =>
    arr.reduce((s, r) => s + (fn(r) ?? 0), 0)

  return {
    kardpoll: {
      sales: sumNum((r) => r.kardpoll?.sales),
      ar: sumNum((r) => r.kardpoll?.ar),
    },
    bank: {
      miscCredits: arr.flatMap((r) => r.bank?.miscCredits ?? []),
      gblCredits: arr.flatMap((r) => r.bank?.gblCredits ?? []),
      merchantFees: sumNum((r) => r.bank?.merchantFees),
      gblCreditsFiltered: sumNum((r) => r.bank?.gblCreditsFiltered),
      ontarioIntegratedTax: sumNum((r) => r.bank?.ontarioIntegratedTax),
      transferFrom: sumNum((r) => r.bank?.transferFrom),
      nightDeposit: sumNum((r) => r.bank?.nightDeposit),
    },
    cashSummary: {
      totals: {
        totalPos: sumNum((r) => r.cashSummary?.totals.totalPos),
        afdGiftCard: sumNum((r) => r.cashSummary?.totals.afdGiftCard),
        kioskGiftCard: sumNum((r) => r.cashSummary?.totals.kioskGiftCard),
        totalSales: sumNum((r) => r.cashSummary?.totals.totalSales),
        item_sales: sumNum((r) => r.cashSummary?.totals.item_sales),
        report_canadian_cash: sumNum(
          (r) => r.cashSummary?.totals.report_canadian_cash,
        ),
        missedCpl: sumNum((r) => r.cashSummary?.totals.missedCpl),
        canadian_cash_collected: sumNum(
          (r) => r.cashSummary?.totals.canadian_cash_collected,
        ),
        couponsAccepted: sumNum((r) => r.cashSummary?.totals.couponsAccepted),
        giftCertificates: sumNum((r) => r.cashSummary?.totals.giftCertificates),
      },
      handheldDebit: sumNum((r) => r.cashSummary?.handheldDebit),
    },
  }
}

// ── Spreadsheet primitives ────────────────────────────────────────────────────

type Row =
  | { kind: 'row'; label: string; value: number }
  | { kind: 'section'; label: string }
  | { kind: 'subtotal'; label: string; value: number }
  | { kind: 'spacer' }

function SheetRow({ row }: { row: Row }) {
  if (row.kind === 'spacer') {
    return <tr className="h-2" />
  }
  if (row.kind === 'section') {
    return (
      <tr className="bg-muted/40">
        <td
          colSpan={2}
          className="border-b px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {row.label}
        </td>
      </tr>
    )
  }
  if (row.kind === 'subtotal') {
    return (
      <tr className="bg-muted/20 font-medium">
        <td className="border-b border-t px-3 py-1.5 pl-4 text-sm">
          {row.label}
        </td>
        <td className="border-b border-t px-3 py-1.5 text-right font-mono text-sm tabular-nums">
          {fmtVal(row.value)}
        </td>
      </tr>
    )
  }
  return (
    <tr className="hover:bg-muted/10">
      <td className="border-b px-3 py-1 pl-6 text-sm text-muted-foreground">
        {row.label}
      </td>
      <td className="border-b px-3 py-1 text-right font-mono text-sm tabular-nums">
        {fmtVal(row.value)}
      </td>
    </tr>
  )
}

function CalcSheet({
  title,
  rows,
  total,
  loading,
}: {
  title: string
  rows: Array<Row>
  total: number
  loading: boolean
}) {
  return (
    <div className="min-w-[300px] flex-1 overflow-hidden rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="border-b-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
              {title}
            </th>
            <th className="border-b-2 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="border-b px-3 py-1.5" colSpan={2}>
                    <div className="h-4 animate-pulse rounded bg-muted" />
                  </td>
                </tr>
              ))
            : rows.map((row, i) => <SheetRow key={i} row={row} />)}
        </tbody>
        <tfoot>
          <tr className="bg-muted/30">
            <td className="border-t-2 px-3 py-2.5 font-bold">{title}</td>
            <td className="border-t-2 px-3 py-2.5 text-right font-mono font-bold tabular-nums">
              {loading ? (
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" />
              ) : (
                fmtVal(total)
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Route component ───────────────────────────────────────────────────────────

function RouteComponent() {
  const [site, setSite] = useState('Rankin')
  const [date, setDate] = useState(todayIso())
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState<CashRecResponse | null>(null)
  const [aggregatedDates, setAggregatedDates] = useState<Array<string>>([
    todayIso(),
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [isHoliday, setIsHoliday] = useState(false)
  const [holidayLoading, setHolidayLoading] = useState(false)

  const [sageLoading, setSageLoading] = useState(false)
  const [sageError, setSageError] = useState('')
  const [sageSuccess, setSageSuccess] = useState(false)

  useEffect(() => {
    if (!site || !date) return
    const ac = new AbortController()
    setLoading(true)
    setError('')
    setData(null)
    setSageSuccess(false)

    resolveAggregateDates(site, date)
      .then(async (dates) => {
        setAggregatedDates(dates)

        const responses = await Promise.all(
          dates.map((d) =>
            fetch(
              `${HUB}/api/cash-rec/entries?site=${encodeURIComponent(site)}&date=${encodeURIComponent(d)}`,
              {
                headers: { Authorization: `Bearer ${getExternalToken()}` },
                signal: ac.signal,
              },
            ).then((r) =>
              r.ok ? (r.json() as Promise<CashRecResponse>) : null,
            ),
          ),
        )
        const valid = responses.filter(Boolean) as Array<CashRecResponse>
        setData(valid.length ? sumResponses(valid) : null)

        const tagRes = await fetch(
          `${HUB}/api/cash-rec/tags?site=${encodeURIComponent(site)}&startDate=${date}&endDate=${date}`,
          {
            headers: { Authorization: `Bearer ${getExternalToken()}` },
            signal: ac.signal,
          },
        )
        if (tagRes.ok) {
          const tags = (await tagRes.json()) as Array<{ date: string }>
          setIsHoliday(tags.some((t) => t.date === date))
        }
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setLoading(false)
      })

    return () => {
      ac.abort()
    }
  }, [site, date, refreshKey])

  // ── Derived values ──────────────────────────────────────────────────────────

  const sumAmounts = (arr?: Array<BankEntry>) =>
    (arr ?? []).reduce((s, x) => s + (Number(x.amount) || 0), 0)

  const num = (v: number | undefined | null) => v ?? 0

  const gblCreditsFiltered = num(data?.bank?.gblCreditsFiltered)
  const kardpollSales = num(data?.kardpoll?.sales)
  const kardpollAr = num(data?.kardpoll?.ar)
  const kardpollValue = gblCreditsFiltered - (kardpollSales - kardpollAr)

  const miscCreditsTotal = sumAmounts(data?.bank?.miscCredits)
  const gblCreditsTotal = sumAmounts(data?.bank?.gblCredits)
  const merchantFees = num(data?.bank?.merchantFees)
  const ontarioIntTax = num(data?.bank?.ontarioIntegratedTax)
  const transferFrom = num(data?.bank?.transferFrom)
  const nightDeposit = num(data?.bank?.nightDeposit)
  const handheldDebit = num(data?.cashSummary?.handheldDebit)
  const totalPos = num(data?.cashSummary?.totals.totalPos)
  const afdGiftCard = num(data?.cashSummary?.totals.afdGiftCard)
  const kioskGiftCard = num(data?.cashSummary?.totals.kioskGiftCard)

  const bankCrBal =
    miscCreditsTotal +
    gblCreditsTotal +
    merchantFees -
    gblCreditsFiltered -
    handheldDebit -
    ontarioIntTax -
    transferFrom -
    nightDeposit

  const bankPosRec = totalPos - afdGiftCard - kioskGiftCard
  const gblValue = bankCrBal - bankPosRec

  const totalSales = num(data?.cashSummary?.totals.totalSales)
  const itemSales = num(data?.cashSummary?.totals.item_sales)
  const reportedCanadianCash = num(
    data?.cashSummary?.totals.report_canadian_cash,
  )
  const missedCpl = num(data?.cashSummary?.totals.missedCpl)
  const canadianCashCollected = num(
    data?.cashSummary?.totals.canadian_cash_collected,
  )
  const couponsAccepted = num(data?.cashSummary?.totals.couponsAccepted)
  const giftCertificates = num(data?.cashSummary?.totals.giftCertificates)

  const gblSales = totalSales - itemSales - reportedCanadianCash - missedCpl
  const cashSales = reportedCanadianCash
  const storeSales = itemSales
  const safeDep = canadianCashCollected
  const gcRedemption = afdGiftCard + kioskGiftCard
  const loyalty = couponsAccepted + giftCertificates

  // ── Holiday toggle ──────────────────────────────────────────────────────────

  async function handleToggleHoliday() {
    setHolidayLoading(true)
    try {
      if (isHoliday) {
        await fetch(
          `${HUB}/api/cash-rec/tags?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getExternalToken()}` },
          },
        )
      } else {
        await fetch(`${HUB}/api/cash-rec/tags`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getExternalToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ site, date }),
        })
      }
      setRefreshKey((k) => k + 1)
    } finally {
      setHolidayLoading(false)
    }
  }

  // ── Sage Other Receipt handler ──────────────────────────────────────────────

  async function handleCreateSageReceipt() {
    if (!data) return
    setSageLoading(true)
    setSageError('')
    setSageSuccess(false)

    try {
      const tokenRes = await apiFetch('/api/sage/connect', { method: 'POST' })
      if (!tokenRes.ok) throw new Error('Failed to get Sage token')
      const { access_token: sageToken } = (await tokenRes.json()) as {
        access_token: string
      }

      const locRes = await fetch(`${HUB}/api/locations`, {
        headers: { Authorization: `Bearer ${getExternalToken()}` },
      })
      if (!locRes.ok) throw new Error('Failed to fetch Hub locations')
      const locations = (await locRes.json()) as Array<{
        name: string
        sageEntityKey?: string
      }>
      const loc = locations.find((l) => l.name === site)
      if (!loc?.sageEntityKey)
        throw new Error(`No Sage entity key configured for "${site}"`)

      const entityRes = await apiFetch(
        `/api/sage/entity/${loc.sageEntityKey}`,
        {
          headers: { 'X-Sage-Token': sageToken },
        },
      )
      if (!entityRes.ok) throw new Error('Failed to fetch Sage entity')
      const entityData = (await entityRes.json()) as {
        'ia::result': { id: string }
      }
      const locationId = entityData['ia::result'].id
      if (!locationId) throw new Error('Could not resolve Sage location ID')

      const deptRes = await apiFetch('/api/sage/department/6', {
        headers: { 'X-Sage-Token': sageToken },
      })
      if (!deptRes.ok) throw new Error('Failed to fetch Sage department')
      const deptData = (await deptRes.json()) as {
        'ia::result': { id: string }
      }
      const departmentId = deptData['ia::result'].id
      if (!departmentId) throw new Error('Could not resolve Sage department ID')

      const [poResults, kardpollResults] = await Promise.all([
        Promise.all(
          aggregatedDates.map((d) =>
            fetch(
              `${HUB}/api/purchase-orders?startDate=${d}&endDate=${d}&site=${encodeURIComponent(site)}`,
              { headers: { Authorization: `Bearer ${getExternalToken()}` } },
            ).then((r) =>
              r.ok ? (r.json() as Promise<Array<ArRow>>) : ([] as Array<ArRow>),
            ),
          ),
        ),
        Promise.all(
          aggregatedDates.map((d) =>
            fetch(
              `${HUB}/api/cash-rec/kardpoll-entries?site=${encodeURIComponent(site)}&date=${encodeURIComponent(d)}`,
              { headers: { Authorization: `Bearer ${getExternalToken()}` } },
            ).then(async (r) => {
              if (!r.ok) return [] as Array<ArRow>
              const doc = (await r.json()) as { ar_rows?: Array<ArRow> }
              return Array.isArray(doc.ar_rows)
                ? doc.ar_rows
                : ([] as Array<ArRow>)
            }),
          ),
        ),
      ])

      const poRows: Array<ArRow> = poResults.flat()
      const kardpollArRows: Array<ArRow> = kardpollResults.flat()

      const isGpmc = (row: ArRow) =>
        (row.customerName ?? row.customer ?? '').toUpperCase().includes('GPMC')

      const allArRows = [...poRows, ...kardpollArRows]
      const gpmcRows = allArRows.filter(isGpmc)
      const nonGpmcTotal = allArRows
        .filter((r) => !isGpmc(r))
        .reduce((s, r) => s + (Number(r.amount) || 0), 0)

      const lines: Array<Record<string, unknown>> = []
      let ln = 1

      const addLine = (gl: string, amount: number, desc: string) => {
        if (amount === 0) return
        lines.push({
          status: 'active',
          amount: amount.toFixed(2),
          txnAmount: amount.toFixed(2),
          description: desc,
          lineNumber: ln++,
          isTax: false,
          glAccount: { id: gl },
          dimensions: {
            location: { id: locationId },
            department: { id: departmentId },
          },
        })
      }

      addLine('40010', gblSales, 'GBL Sales')
      addLine('40010', cashSales, 'Cash Sales')
      addLine('40010', kardpollSales, 'Kardpoll Sales')
      addLine('40010', ontarioIntTax, 'Ontario Integrated Tax')
      addLine('40200', storeSales, 'Store Sales')
      addLine(
        '10011',
        -safeDep,
        `Safe Deposit ${format(parseISO(date), 'dd/MM/yyyy')}`,
      )
      addLine('10011', nightDeposit, 'Night Deposit')
      addLine('52250', -gcRedemption, 'Gift Card Redemption')
      addLine('52175', -loyalty, 'Loyalty')
      if (nonGpmcTotal !== 0) addLine('10440', -nonGpmcTotal, 'Total AR POs')
      for (const row of gpmcRows) {
        addLine(
          '55100',
          -(Number(row.amount) || 0),
          row.customerName ?? row.customer ?? 'GPMC',
        )
      }
      addLine(
        '55050',
        kardpollValue,
        kardpollValue >= 0 ? 'Kardpoll Paid' : 'Kardpoll Short',
      )
      addLine('55050', gblValue, gblValue >= 0 ? 'GBL Paid' : 'GBL Short')

      const payload = {
        payer: 'Daily Sales',
        txnDate: date,
        txnPaidDate: date,
        description: `Cash Management - ${site} - ${aggregatedDates.join(', ')}`,
        baseCurrency: 'CAD',
        currency: 'CAD',
        reconciliationState: 'uncleared',
        isInclusiveTax: false,
        bankAccount: { id: '10019' },
        depositDate: date,
        exchangeRate: {
          date,
          typeId: 'Intacct Daily Rate',
          rate: 1,
        },
        lines,
      }

      const receiptRes = await apiFetch('/api/sage/other-receipt', {
        method: 'POST',
        headers: {
          'X-Sage-Token': sageToken,
          'X-Sage-Entity': locationId,
        },
        body: JSON.stringify(payload),
      })

      if (!receiptRes.ok) {
        const body = (await receiptRes.json().catch(() => ({}))) as Record<
          string,
          unknown
        >
        console.error(
          '[other-receipt] Sage error body:',
          JSON.stringify(body, null, 2),
        )
        const detail =
          (body['ia::error'] as { message?: string } | undefined)?.message ??
          (body.message as string | undefined) ??
          JSON.stringify(body)
        throw new Error(`Sage ${receiptRes.status}: ${detail}`)
      }

      setSageSuccess(true)
    } catch (err: unknown) {
      setSageError(
        err instanceof Error ? err.message : 'Failed to create Sage entry',
      )
    } finally {
      setSageLoading(false)
    }
  }

  // ── Row definitions ─────────────────────────────────────────────────────────

  const kardpollRows: Array<Row> = [
    { kind: 'row', label: 'GBL Credits Filtered', value: gblCreditsFiltered },
    { kind: 'row', label: 'Less: Kardpoll Sales', value: -kardpollSales },
    { kind: 'row', label: 'Add: Kardpoll AR', value: kardpollAr },
  ]

  const gblRows: Array<Row> = [
    { kind: 'section', label: 'Bank Credit Balance' },
    { kind: 'row', label: 'Misc Credits', value: miscCreditsTotal },
    { kind: 'row', label: 'GBL Credits', value: gblCreditsTotal },
    { kind: 'row', label: 'Merchant Fees', value: merchantFees },
    {
      kind: 'row',
      label: 'Less: GBL Credits Filtered',
      value: -gblCreditsFiltered,
    },
    { kind: 'row', label: 'Less: Handheld Debit', value: -handheldDebit },
    {
      kind: 'row',
      label: 'Less: Ontario Integrated Tax',
      value: -ontarioIntTax,
    },
    { kind: 'row', label: 'Less: Transfer From', value: -transferFrom },
    { kind: 'row', label: 'Less: Night Deposit', value: -nightDeposit },
    { kind: 'subtotal', label: 'Bank Cr. Balance', value: bankCrBal },
    { kind: 'spacer' },
    { kind: 'section', label: 'Bank POS Rec' },
    { kind: 'row', label: 'Total POS', value: totalPos },
    { kind: 'row', label: 'Less: AFD Gift Card', value: -afdGiftCard },
    { kind: 'row', label: 'Less: Kiosk Gift Card', value: -kioskGiftCard },
    { kind: 'subtotal', label: 'Bank POS Rec', value: bankPosRec },
  ]

  const selectedDow = getDay(parseISO(date))
  const isAutoTagged = selectedDow === 5 || selectedDow === 6

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <h2 className="text-2xl font-semibold">Cash Management</h2>

      <div className="flex flex-wrap items-end gap-4">
        <SitePicker value={site} onValueChange={setSite} />

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Date
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('w-[180px] justify-start text-left font-normal')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(parseISO(date), 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date ? parseISO(date) : undefined}
                onSelect={(d) => {
                  if (d) setDate(format(d, 'yyyy-MM-dd'))
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {!isAutoTagged && (
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Holiday
            </span>
            <Button
              variant={isHoliday ? 'default' : 'outline'}
              size="sm"
              onClick={() => void handleToggleHoliday()}
              disabled={holidayLoading || loading}
            >
              {holidayLoading
                ? 'Saving…'
                : isHoliday
                  ? 'Remove Holiday Tag'
                  : 'Mark as Holiday'}
            </Button>
          </div>
        )}
      </div>

      {aggregatedDates.length > 1 && (
        <p className="text-sm text-muted-foreground">
          Aggregating {aggregatedDates.length} days:{' '}
          {aggregatedDates
            .map((d) => format(parseISO(d), 'EEE MMM d'))
            .join(', ')}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-6">
        <CalcSheet
          title="KARDPOLL"
          rows={kardpollRows}
          total={kardpollValue}
          loading={loading}
        />
        <CalcSheet
          title="GBL"
          rows={gblRows}
          total={gblValue}
          loading={loading}
        />
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={() => void handleCreateSageReceipt()}
          disabled={!data || loading || sageLoading}
        >
          {sageLoading ? 'Creating…' : 'Create Other Receipt in Sage'}
        </Button>
        {sageSuccess && (
          <p className="text-sm text-green-600">
            Other Receipt created as draft in Sage.
          </p>
        )}
        {sageError && <p className="text-sm text-destructive">{sageError}</p>}
      </div>
    </div>
  )
}
