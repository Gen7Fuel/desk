import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { can, getTokenPayload } from '@/lib/permissions'
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
    }
    handheldDebit?: number
  } | null
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtVal(v: number): string {
  const abs = Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return v < 0 ? `(${abs})` : abs
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
  // kind === 'row'
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
  rows: Row[]
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
  const [data, setData] = useState<CashRecResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!site || !date) return
    let cancelled = false
    setLoading(true)
    setError('')
    setData(null)
    fetch(
      `${HUB}/api/cash-rec/entries?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
      { headers: { Authorization: `Bearer ${getExternalToken()}` } },
    )
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(
            (body as { error?: string; message?: string }).error ||
              (body as { error?: string; message?: string }).message ||
              `Request failed (${res.status})`,
          )
        }
        return res.json() as Promise<CashRecResponse>
      })
      .then((json) => {
        if (!cancelled && json) setData(json)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [site, date])

  // ── Derived values ──────────────────────────────────────────────────────────

  const sumAmounts = (arr?: Array<BankEntry>) =>
    (arr ?? []).reduce((s, x) => s + (Number(x.amount) || 0), 0)

  const gblCreditsFiltered = data?.bank?.gblCreditsFiltered ?? 0
  const kardpollSales      = data?.kardpoll?.sales ?? 0
  const kardpollAr         = data?.kardpoll?.ar ?? 0
  const kardpollValue      = gblCreditsFiltered - (kardpollSales - kardpollAr)

  const miscCreditsTotal  = sumAmounts(data?.bank?.miscCredits)
  const gblCreditsTotal   = sumAmounts(data?.bank?.gblCredits)
  const merchantFees      = data?.bank?.merchantFees ?? 0
  const ontarioIntTax     = data?.bank?.ontarioIntegratedTax ?? 0
  const transferFrom      = data?.bank?.transferFrom ?? 0
  const nightDeposit      = data?.bank?.nightDeposit ?? 0
  const handheldDebit     = data?.cashSummary?.handheldDebit ?? 0
  const totalPos          = data?.cashSummary?.totals.totalPos ?? 0
  const afdGiftCard       = data?.cashSummary?.totals.afdGiftCard ?? 0
  const kioskGiftCard     = data?.cashSummary?.totals.kioskGiftCard ?? 0

  const bankCrBal =
    miscCreditsTotal + gblCreditsTotal + merchantFees
    - gblCreditsFiltered - handheldDebit
    - ontarioIntTax - transferFrom - nightDeposit

  const bankPosRec = totalPos - afdGiftCard - kioskGiftCard
  const gblValue   = bankCrBal - bankPosRec

  // ── Row definitions ─────────────────────────────────────────────────────────

  const kardpollRows: Row[] = [
    { kind: 'row', label: 'GBL Credits Filtered', value: gblCreditsFiltered },
    { kind: 'row', label: 'Less: Kardpoll Sales',  value: -kardpollSales },
    { kind: 'row', label: 'Add: Kardpoll AR',      value: kardpollAr },
  ]

  const gblRows: Row[] = [
    { kind: 'section', label: 'Bank Credit Balance' },
    { kind: 'row', label: 'Misc Credits',                value: miscCreditsTotal },
    { kind: 'row', label: 'GBL Credits',                 value: gblCreditsTotal },
    { kind: 'row', label: 'Merchant Fees',               value: merchantFees },
    { kind: 'row', label: 'Less: GBL Credits Filtered',  value: -gblCreditsFiltered },
    { kind: 'row', label: 'Less: Handheld Debit',        value: -handheldDebit },
    { kind: 'row', label: 'Less: Ontario Integrated Tax', value: -ontarioIntTax },
    { kind: 'row', label: 'Less: Transfer From',         value: -transferFrom },
    { kind: 'row', label: 'Less: Night Deposit',         value: -nightDeposit },
    { kind: 'subtotal', label: 'Bank Cr. Balance',       value: bankCrBal },
    { kind: 'spacer' },
    { kind: 'section', label: 'Bank POS Rec' },
    { kind: 'row', label: 'Total POS',                   value: totalPos },
    { kind: 'row', label: 'Less: AFD Gift Card',         value: -afdGiftCard },
    { kind: 'row', label: 'Less: Kiosk Gift Card',       value: -kioskGiftCard },
    { kind: 'subtotal', label: 'Bank POS Rec',           value: bankPosRec },
  ]

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
      </div>

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
    </div>
  )
}
