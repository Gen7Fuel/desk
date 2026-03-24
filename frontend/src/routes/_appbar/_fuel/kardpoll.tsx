import { createFileRoute, redirect } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { FileSpreadsheet, UploadCloud } from 'lucide-react'
import type ExcelJS from 'exceljs'
import { can, getTokenPayload } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { SitePicker } from '@/components/custom/SitePicker'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_appbar/_fuel/kardpoll')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('fuel.fuelInvoicing', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

interface KardpollData {
  totalSales: string
  totalLitres: string
  date: string
  isoDate: string
}

function formatDisplayDate(d: Date): string {
  const day = d.getUTCDate()
  const suffix =
    day === 1 || day === 21 || day === 31
      ? 'st'
      : day === 2 || day === 22
        ? 'nd'
        : day === 3 || day === 23
          ? 'rd'
          : 'th'
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${month} ${String(day)}${suffix}, ${String(d.getUTCFullYear())}`
}

function toDate(raw: unknown): Date | null {
  if (raw instanceof Date) return raw
  if (typeof raw === 'number') return new Date((raw - 25569) * 86400000)
  return null
}

type Row = Array<unknown>

function extractKardpollData(rows: Array<Row>): KardpollData {
  let totalSales = ''
  let totalLitres = ''
  const rawDate = rows[2]?.[0]
  const parsed = toDate(rawDate)
  const date = parsed ? formatDisplayDate(parsed) : String(rawDate ?? '').trim()
  const isoDate = parsed
    ? `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`
    : ''

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]

    if (!totalSales) {
      const gCell = String(row[6] ?? '').trim()
      if (gCell.startsWith('Total Sales:')) {
        const afterDollar = gCell.split('$')[1]
        if (afterDollar) {
          totalSales = afterDollar.trim()
        }
      }
    }

    if (!totalLitres) {
      const hCell = String(row[7] ?? '').trim()
      if (hCell.startsWith('Total Volume:')) {
        const match = hCell.match(/:\s*([\d.]+)L/)
        if (match) {
          totalLitres = match[1]
        }
      }
    }

    if (totalSales && totalLitres) break
  }

  return { totalSales, totalLitres, date, isoDate }
}

function RouteComponent() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<KardpollData | null>(null)
  const [error, setError] = useState('')
  const [site, setSite] = useState('Charlies')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  async function processFile(f: File) {
    setError('')
    setData(null)
    setFile(f)
    try {
      const buf = await f.arrayBuffer()
      const { default: ExcelJSLib } = await import('exceljs')
      const wb = new ExcelJSLib.Workbook()
      await wb.xlsx.load(buf)
      const ws = wb.worksheets[0]

      const rows: Array<Row> = []
      ws.eachRow({ includeEmpty: false }, (row) => {
        const vals: Array<unknown> = []
        for (let c = 1; c <= ws.columnCount; c++) {
          vals.push(row.getCell(c).value ?? '')
        }
        rows.push(vals)
      })
      const extracted = extractKardpollData(rows)
      if (!extracted.totalSales && !extracted.totalLitres) {
        setError(
          'Could not find "Total Sales" or "Total Volume" rows in the file.',
        )
      } else {
        setData(extracted)
      }
    } catch {
      setError('Failed to parse the Excel file. Please check the file format.')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files.item(0)
    if (f) processFile(f)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave() {
    setDragActive(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  async function handleSubmit() {
    if (!data) return
    setSubmitting(true)
    setSubmitError('')
    setSubmitSuccess(false)
    try {
      const payload = getTokenPayload() as
        | (ReturnType<typeof getTokenPayload> & { externalToken?: string })
        | null
      const externalToken = payload?.externalToken
      if (!externalToken) throw new Error('No external token available.')

      const res = await fetch(
        'https://app.gen7fuel.com/api/cash-rec/parse-kardpoll-excel',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${externalToken}`,
          },
          body: JSON.stringify({
            site,
            date: data.isoDate,
            totalSales: data.totalSales,
            totalLitres: data.totalLitres,
          }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || body.message || 'Submission failed.')
      }
      setSubmitSuccess(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Kardpoll</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drop a Kardpoll Excel file to extract total sales and litres.
          </p>
        </div>
        <SitePicker value={site} onValueChange={setSite} />
      </div>

      <div
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors',
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
          file && 'border-solid border-primary/40 bg-primary/5',
        )}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={handleInputChange}
        />
        {file ? (
          <>
            <FileSpreadsheet className="h-12 w-12 text-primary" />
            <div className="text-center">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {file.size < 1024 * 1024
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
              </p>
            </div>
          </>
        ) : (
          <>
            <UploadCloud
              className={cn(
                'h-12 w-12 transition-colors',
                dragActive ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <div className="text-center">
              <p className="font-medium">Drop your Excel file here</p>
              <p className="text-sm text-muted-foreground">
                or click to browse — Excel files accepted
              </p>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <div className="flex flex-col gap-6">
          <div className="flex gap-8 flex-wrap">
            {data.date && (
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Date
                </span>
                <span className="text-3xl font-semibold">{data.date}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Sales
              </span>
              <span className="text-3xl font-semibold">{data.totalSales}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Litres
              </span>
              <span className="text-3xl font-semibold">{data.totalLitres}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSubmit}
              disabled={submitting || submitSuccess}
            >
              {submitting
                ? 'Submitting…'
                : submitSuccess
                  ? 'Submitted'
                  : 'Submit Entry'}
            </Button>
            {submitSuccess && (
              <p className="text-sm text-green-600">
                Entry saved successfully.
              </p>
            )}
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
