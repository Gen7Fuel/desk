import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { eachDayOfInterval, format, parseISO, startOfMonth } from 'date-fns'
import { can, getTokenPayload } from '@/lib/permissions'
import { SitePicker } from '@/components/custom/SitePicker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_appbar/_sidebar/hub/cash-rec')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.cashRec', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const HUB = 'https://app.gen7fuel.com'

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function monthStartIso(): string {
  return format(startOfMonth(new Date()), 'yyyy-MM-dd')
}

function getExternalToken(): string {
  const payload = getTokenPayload() as { externalToken?: string } | null
  return payload?.externalToken ?? ''
}

interface ArRowEntry {
  customer: string
  card: string
  amount: number
  quantity: number
  price_per_litre: number
}

interface KardpollData {
  _id?: string
  litresSold?: number
  sales: number
  ar: number
  ar_rows?: Array<ArRowEntry>
}

interface EntriesResponse {
  kardpoll: KardpollData | null
}

type EditField = 'sales' | 'litresSold' | 'ar'
type EditCell = { date: string; field: EditField; value: string }

function fmtCurrency(v: number): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtLitres(v: number): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

function DatePicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('w-36 justify-start text-left font-normal')}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? format(parseISO(value), 'MMM d, yyyy') : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? parseISO(value) : undefined}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, 'yyyy-MM-dd'))
              setOpen(false)
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function RouteComponent() {
  const [site, setSite] = useState('')
  const [startDate, setStartDate] = useState(monthStartIso)
  const [endDate, setEndDate] = useState(todayIso)
  const [rows, setRows] = useState<Map<string, KardpollData | null>>(new Map())
  const [loading, setLoading] = useState(false)
  const [dates, setDates] = useState<Array<string>>([])
  const [editing, setEditing] = useState<EditCell | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErrorDate, setSaveErrorDate] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  useEffect(() => {
    if (!site || !startDate || !endDate) return
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    if (end < start) return

    const dayList = eachDayOfInterval({ start, end }).map((d) =>
      format(d, 'yyyy-MM-dd'),
    )
    setDates(dayList)
    setRows(new Map())
    setEditing(null)
    setSaveErrorDate(null)
    setLoading(true)

    const token = getExternalToken()
    Promise.all(
      dayList.map(async (d) => {
        try {
          const res = await fetch(
            `${HUB}/api/cash-rec/entries?site=${encodeURIComponent(site)}&date=${d}`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          if (!res.ok) return [d, null] as const
          const body = (await res.json()) as EntriesResponse
          return [d, body.kardpoll] as const
        } catch {
          return [d, null] as const
        }
      }),
    )
      .then((entries) => setRows(new Map(entries)))
      .finally(() => setLoading(false))
  }, [site, startDate, endDate])

  function startEdit(date: string, field: EditField) {
    if (!can('hub.cashRec', 'update')) return
    const existing = rows.get(date)
    const current =
      field === 'litresSold'
        ? (existing?.litresSold ?? 0)
        : field === 'sales'
          ? (existing?.sales ?? 0)
          : (existing?.ar ?? 0)
    setEditing({ date, field, value: String(current) })
    setSaveErrorDate(null)
  }

  async function commitEdit() {
    if (!editing || saving) return
    const num = parseFloat(editing.value)
    if (isNaN(num)) {
      setEditing(null)
      return
    }
    const existing = rows.get(editing.date)
    const payload = {
      site,
      date: editing.date,
      litresSold: existing?.litresSold ?? 0,
      sales: existing?.sales ?? 0,
      ar: existing?.ar ?? 0,
      ar_rows: existing?.ar_rows ?? [],
      [editing.field]: num,
    }
    setSaving(true)
    try {
      const res = await fetch(`${HUB}/api/cash-rec/kardpoll`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getExternalToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = (await res.json()) as { report: KardpollData }
      setRows((prev) => {
        const next = new Map(prev)
        next.set(editing.date, updated.report)
        return next
      })
      setEditing(null)
    } catch {
      setSaveErrorDate(editing.date)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setEditing(null)
  }

  const dayCount =
    startDate && endDate
      ? eachDayOfInterval({
          start: parseISO(startDate),
          end: parseISO(endDate),
        }).length
      : 0

  const canEdit = can('hub.cashRec', 'update')

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Cash Rec</h1>
        <p className="text-sm text-muted-foreground">
          Kardpoll entries by date for a site
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SitePicker
          value={site}
          onValueChange={setSite}
          className="w-48"
        />
        <DatePicker value={startDate} onChange={setStartDate} label="Start date" />
        <span className="text-sm text-muted-foreground">to</span>
        <DatePicker value={endDate} onChange={setEndDate} label="End date" />
        {dayCount > 31 && (
          <span className="text-xs text-amber-600">
            Large range ({dayCount} days) — may be slow
          </span>
        )}
      </div>

      {!site && (
        <p className="text-sm text-muted-foreground">Select a site to load data.</p>
      )}

      {site && (
        <div className="relative">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading {dates.length} day{dates.length !== 1 ? 's' : ''}…
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Date</TableHead>
                <TableHead className="text-right">Kardpoll Sale ($)</TableHead>
                <TableHead className="text-right">Kardpoll Qty (L)</TableHead>
                <TableHead className="text-right">AR ($)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dates.length === 0 && !loading && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No dates in range.
                  </TableCell>
                </TableRow>
              )}
              {dates.map((d) => {
                const kp = rows.get(d)
                const hasData = kp !== undefined
                const isRowError = saveErrorDate === d

                return (
                  <TableRow
                    key={d}
                    className={cn(isRowError && 'bg-destructive/5')}
                  >
                    <TableCell className="font-mono text-sm">{d}</TableCell>

                    {(['sales', 'litresSold', 'ar'] as Array<EditField>).map(
                      (field) => {
                        const isEditing =
                          editing?.date === d && editing.field === field
                        const raw =
                          field === 'litresSold'
                            ? kp?.litresSold
                            : field === 'sales'
                              ? kp?.sales
                              : kp?.ar
                        const display =
                          !hasData || raw === undefined
                            ? '—'
                            : field === 'litresSold'
                              ? fmtLitres(raw)
                              : fmtCurrency(raw)

                        return (
                          <TableCell
                            key={field}
                            className={cn(
                              'text-right tabular-nums',
                              canEdit && 'cursor-pointer select-none',
                              !hasData && 'text-muted-foreground',
                            )}
                            onDoubleClick={() => canEdit && startEdit(d, field)}
                          >
                            {isEditing ? (
                              <Input
                                ref={inputRef}
                                type="number"
                                step="any"
                                value={editing.value}
                                disabled={saving}
                                className="h-7 w-32 ml-auto text-right"
                                onChange={(e) =>
                                  setEditing((prev) =>
                                    prev ? { ...prev, value: e.target.value } : null,
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEdit()
                                  if (e.key === 'Escape') cancelEdit()
                                }}
                                onBlur={commitEdit}
                              />
                            ) : (
                              <span
                                className={cn(
                                  canEdit &&
                                    'rounded px-1 hover:bg-muted transition-colors',
                                )}
                                title={canEdit ? 'Double-click to edit' : undefined}
                              >
                                {!hasData ? (
                                  <span className="text-muted-foreground/50">—</span>
                                ) : (
                                  display
                                )}
                              </span>
                            )}
                          </TableCell>
                        )
                      },
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {saveErrorDate && (
            <p className="text-xs text-destructive mt-2">
              Failed to save changes for {saveErrorDate}. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
