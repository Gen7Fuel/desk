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

function fmt(v: number): string {
  const abs = Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return v < 0 ? `(${abs})` : abs
}

function MetricCard({
  label,
  value,
  loading,
}: {
  label: string
  value: string
  loading: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-6 min-w-[220px]">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {loading ? (
        <div className="h-9 w-32 animate-pulse rounded bg-muted" />
      ) : (
        <span className="text-3xl font-semibold">{value}</span>
      )}
    </div>
  )
}

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

  // KARDPOLL = gblCreditsFiltered - (kardpoll.sales - kardpoll.ar)
  const gblCreditsFiltered = data?.bank?.gblCreditsFiltered ?? 0
  const kardpollSales = data?.kardpoll?.sales ?? 0
  const kardpollAr = data?.kardpoll?.ar ?? 0
  const kardpollValue = gblCreditsFiltered - (kardpollSales - kardpollAr)

  // GBL = bankCrBal - bankPosRec
  const sumAmounts = (arr?: Array<BankEntry>) =>
    (arr ?? []).reduce((s, x) => s + (Number(x.amount) || 0), 0)

  const bankPosRec =
    (data?.cashSummary?.totals.totalPos ?? 0) -
    (data?.cashSummary?.totals.afdGiftCard ?? 0) -
    (data?.cashSummary?.totals.kioskGiftCard ?? 0)

  const bankCrBal =
    sumAmounts(data?.bank?.miscCredits) +
    sumAmounts(data?.bank?.gblCredits) +
    (data?.bank?.merchantFees ?? 0) -
    (data?.bank?.gblCreditsFiltered ?? 0) -
    (data?.cashSummary?.handheldDebit ?? 0) -
    (data?.bank?.ontarioIntegratedTax ?? 0) -
    (data?.bank?.transferFrom ?? 0) -
    (data?.bank?.nightDeposit ?? 0)

  const gblValue = bankCrBal - bankPosRec

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
        <MetricCard
          label="KARDPOLL"
          value={`$${fmt(kardpollValue)}`}
          loading={loading}
        />
        <MetricCard label="GBL" value={`$${fmt(gblValue)}`} loading={loading} />
      </div>
    </div>
  )
}
