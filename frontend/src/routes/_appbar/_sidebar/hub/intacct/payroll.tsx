import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import type { PayworksJournal } from '@/lib/payworks-journal'
import { can } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'
import { getSageToken, resolveSiteEntity } from '@/lib/sage-site'
import { SITE_BANK_GL_ACCOUNTS } from '@/lib/sage-bank-accounts'
import {
  buildJournalEntryPayload,
  extractPdfText,
  isBalanced,
  journalDebits,
  parsePayworksJournal,
  totalDebits,
} from '@/lib/payworks-journal'
import { SitePicker } from '@/components/custom/SitePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_appbar/_sidebar/hub/intacct/payroll')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.intacct', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const fmt = (n: number) =>
  n.toLocaleString('en-CA', { minimumFractionDigits: 2 })

function RouteComponent() {
  const [sageToken, setSageToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState('')

  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [journal, setJournal] = useState<PayworksJournal | null>(null)

  const [site, setSite] = useState<string | undefined>(undefined)
  const [locationId, setLocationId] = useState('')
  const [creditAccountId, setCreditAccountId] = useState('')
  const [siteLoading, setSiteLoading] = useState(false)
  const [siteError, setSiteError] = useState('')
  const [description, setDescription] = useState('')

  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [created, setCreated] = useState<string | null>(null)

  useEffect(() => {
    getSageToken()
      .then(setSageToken)
      .catch((err: unknown) =>
        setTokenError(
          err instanceof Error ? err.message : 'Failed to connect to Sage',
        ),
      )
  }, [])

  // Resolve the Sage location and the bank GL account whenever the site changes.
  useEffect(() => {
    setLocationId('')
    setCreditAccountId('')
    setSiteError('')
    setDescription(site ? `${site} Weekly Payroll` : '')
    if (!site || !sageToken) return
    const run = { cancelled: false }
    const stale = () => run.cancelled
    setSiteLoading(true)
    ;(async () => {
      try {
        const entityId = await resolveSiteEntity(sageToken, site)
        if (stale()) return
        setLocationId(entityId)
        const gl = SITE_BANK_GL_ACCOUNTS[site] as string | undefined
        if (gl) setCreditAccountId(gl)
        else
          setSiteError(
            'No bank GL account on file for this site — enter it below.',
          )
      } catch (err) {
        if (!stale())
          setSiteError(err instanceof Error ? err.message : 'Lookup failed')
      } finally {
        if (!stale()) setSiteLoading(false)
      }
    })()
    return () => {
      run.cancelled = true
    }
  }, [site, sageToken])

  async function handleFile(file: File | undefined) {
    setJournal(null)
    setParseError('')
    setCreated(null)
    setPostError('')
    if (!file) return
    setFileName(file.name)
    setParsing(true)
    try {
      setJournal(parsePayworksJournal(await extractPdfText(file)))
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Failed to read the PDF',
      )
    } finally {
      setParsing(false)
    }
  }

  const balanced = journal ? isBalanced(journal) : false
  const canPost =
    !!journal &&
    balanced &&
    !!sageToken &&
    !!locationId &&
    !!creditAccountId.trim() &&
    !!description.trim() &&
    !posting &&
    !created

  async function handlePost() {
    if (!journal || !sageToken) return
    setPosting(true)
    setPostError('')
    try {
      const payload = buildJournalEntryPayload({
        journal,
        locationId,
        creditAccountId: creditAccountId.trim(),
        description: description.trim(),
      })
      const res = await apiFetch('/api/sage/journal-entry', {
        method: 'POST',
        headers: { 'X-Sage-Token': sageToken, 'X-Sage-Entity': locationId },
        body: JSON.stringify(payload),
      })
      const raw = await res.text()
      let body: Record<string, any> = {}
      try {
        body = JSON.parse(raw) as Record<string, any>
      } catch {
        // Non-JSON reply (e.g. a proxy/Express 404 page) — keep the raw text.
      }
      if (!res.ok) {
        const detail =
          body['ia::result']?.['ia::error']?.message ??
          body['ia::error']?.message ??
          body.message ??
          (raw.trim().slice(0, 300) || '(empty response)')
        throw new Error(`Sage ${res.status}: ${detail}`)
      }
      const result = body['ia::result'] as
        | { key?: string; id?: string }
        | undefined
      setCreated(result?.key ?? result?.id ?? 'created')
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Payroll</h1>
        <p className="text-sm text-muted-foreground">
          Upload a Payworks Journal Entry PDF to create a draft payroll journal
          entry in Intacct.
        </p>
      </div>

      {tokenError && <p className="text-sm text-destructive">{tokenError}</p>}

      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-1.5">
          <Label htmlFor="payworks-pdf">Payworks Journal Entry (PDF)</Label>
          <label
            htmlFor="payworks-pdf"
            className="flex h-24 w-80 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-accent"
          >
            {parsing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            <span className="max-w-72 truncate px-2">
              {fileName || 'Click to choose a PDF'}
            </span>
          </label>
          <input
            id="payworks-pdf"
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => {
              void handleFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        <div className="w-72 space-y-1.5">
          <Label>Site</Label>
          <SitePicker value={site} onValueChange={setSite} />
        </div>
      </div>

      {parseError && <p className="text-sm text-destructive">{parseError}</p>}

      {journal && (
        <div className="space-y-4">
          <div className="grid max-w-3xl grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
            <span className="text-muted-foreground">Pay group</span>
            <span>{journal.payGroup ?? '—'}</span>
            <span className="text-muted-foreground">Pay period</span>
            <span>{journal.payPeriod}</span>
            <span className="text-muted-foreground">Period ending</span>
            <span>{journal.periodEnding ?? '—'}</span>
            <span className="text-muted-foreground">
              Posting date (run date)
            </span>
            <span>{journal.runDate}</span>
          </div>

          <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="je-desc">Description</Label>
              <Input
                id="je-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="je-credit">Credit GL account</Label>
              <Input
                id="je-credit"
                value={creditAccountId}
                onChange={(e) => setCreditAccountId(e.target.value)}
                placeholder="e.g. 10131"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <div className="flex h-9 items-center gap-2 text-sm">
                {siteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {locationId || (site ? '' : 'Select a site')}
              </div>
            </div>
          </div>
          {siteError && <p className="text-sm text-destructive">{siteError}</p>}

          <Table className="max-w-3xl">
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Line</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>{creditAccountId || '—'}</TableCell>
                <TableCell>Payroll Clearing (bank)</TableCell>
                <TableCell />
                <TableCell className="text-right">
                  {fmt(journal.clearingTotal)}
                </TableCell>
              </TableRow>
              {journalDebits(journal).map((d) => (
                <TableRow key={d.key}>
                  <TableCell>{d.glAccount}</TableCell>
                  <TableCell>{d.label}</TableCell>
                  <TableCell className="text-right">{fmt(d.amount)}</TableCell>
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">
                  {fmt(totalDebits(journal))}
                </TableCell>
                <TableCell className="text-right">
                  {fmt(journal.clearingTotal)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>

          {!balanced && (
            <p className="text-sm text-destructive">
              Debits and credits don&apos;t balance &mdash; check the PDF.
              Posting is blocked.
            </p>
          )}

          <div className="flex items-center gap-4">
            <Button onClick={handlePost} disabled={!canPost}>
              {posting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create draft in Intacct
            </Button>
            {created && (
              <span className="text-sm text-green-700">
                Draft journal entry created (key {created}).
              </span>
            )}
          </div>
          {postError && <p className="text-sm text-destructive">{postError}</p>}
        </div>
      )}
    </div>
  )
}
