import { useEffect, useRef, useState } from 'react'
import type {
  BookworksContext,
  BookworksInvoice,
  BookworksPreview,
  IntacctVendor,
} from '@/lib/bookworks-api'
import { bookworksIntacct } from '@/lib/bookworks-api'
import { inspectBookworksPdf } from '@/lib/bookworks-pdf'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const message = (err: unknown) =>
  err instanceof Error ? err.message : 'Request failed. Please retry.'
const money = (cents: number) =>
  (cents / 100).toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function BookworksDraft({ invoice }: { invoice: BookworksInvoice }) {
  const [context, setContext] = useState<BookworksContext | null>(null)
  const [vendorSearch, setVendorSearch] = useState('')
  const [vendors, setVendors] = useState<Array<IntacctVendor>>([])
  const [vendorId, setVendorId] = useState('')
  const [vendorMore, setVendorMore] = useState(false)
  const [cogsType, setCogsType] = useState<'fuel' | 'freight'>('fuel')
  const [preview, setPreview] = useState<BookworksPreview | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pdfNote, setPdfNote] = useState(
    'Fuel is selected by default. You can upload a PDF for an account suggestion or choose the account manually.',
  )
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMismatch, setPdfMismatch] = useState(false)
  const [vendorBusy, setVendorBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const mounted = useRef(true)
  const pdfVersion = useRef(0)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      pdfVersion.current++
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setBusy(true)
    bookworksIntacct
      .context(invoice.id, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setContext(data)
        setVendorId(data.mapping?.vendorId || '')
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })
    return () => controller.abort()
  }, [invoice.id, refresh])

  const savedVendor = context?.mapping
  const mappingChanged = Boolean(vendorId && vendorId !== savedVendor?.vendorId)
  const blockedEntry =
    context?.entry &&
    ['creating', 'uncertain', 'created'].includes(context.entry.status)
  const canPreview =
    !busy &&
    !pdfBusy &&
    !pdfMismatch &&
    !blockedEntry &&
    Boolean(savedVendor) &&
    !mappingChanged &&
    invoice.posted === true

  async function vendorLookup() {
    setError('')
    setVendorBusy(true)
    try {
      const data = await bookworksIntacct.vendors(vendorSearch.trim())
      if (mounted.current) {
        setVendors(data.vendors)
        setVendorMore(data.hasMore)
      }
    } catch (err) {
      if (mounted.current) setError(message(err))
    } finally {
      if (mounted.current) setVendorBusy(false)
    }
  }
  async function saveVendor() {
    setError('')
    setBusy(true)
    setPreview(null)
    setNotice('')
    try {
      const mapping = await bookworksIntacct.saveMapping(invoice.id, vendorId)
      if (mounted.current) {
        setContext((current) => (current ? { ...current, mapping } : current))
        setNotice(
          'Vendor mapping saved for future invoices from this Bookworks vendor.',
        )
      }
    } catch (err) {
      if (mounted.current) setError(message(err))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function inspect(file?: File) {
    const version = ++pdfVersion.current
    setPreview(null)
    setPdfMismatch(false)
    setPdfBusy(Boolean(file))
    if (!file) {
      setCogsType('fuel')
      setPdfNote('PDF cleared. Fuel is selected by default.')
      return
    }
    setPdfNote('Reading invoice PDF…')
    try {
      const result = await inspectBookworksPdf(file, invoice.invoiceNumber)
      if (!mounted.current || version !== pdfVersion.current) return
      if (!result.hasText) {
        setCogsType('fuel')
        setPdfNote(
          'This PDF has no readable text. Fuel remains selected; review the invoice and choose the correct account manually.',
        )
      } else if (!result.matchesInvoice) {
        setPdfMismatch(true)
        setPdfNote(
          'This PDF does not contain the selected invoice number. Choose the matching PDF or clear the upload.',
        )
      } else {
        setCogsType(result.hasLitre ? 'fuel' : 'freight')
        setPdfNote(
          result.hasLitre
            ? '“Litre” was found in the invoice text. Fuel is suggested; you can override it.'
            : 'No “litre” text was found. Freight is suggested; you can override it.',
        )
      }
    } catch (err) {
      if (mounted.current && version === pdfVersion.current) {
        setPdfMismatch(true)
        setPdfNote(message(err))
      }
    } finally {
      if (mounted.current && version === pdfVersion.current) setPdfBusy(false)
    }
  }
  async function showPreview() {
    setBusy(true)
    setError('')
    setNotice('')
    setPreview(null)
    try {
      const data = await bookworksIntacct.preview(invoice.id, cogsType)
      if (mounted.current) setPreview(data)
    } catch (err) {
      if (mounted.current) setError(message(err))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function createDraft() {
    if (!preview) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await bookworksIntacct.createDraft(
        invoice.id,
        cogsType,
        preview.hash,
      )
      if (mounted.current) {
        setNotice(
          `Draft ${result.billKey} ${result.alreadyCreated ? 'already exists' : 'created'} in A210 / Gen7 LP. It has not been posted.`,
        )
        setContext((current) =>
          current
            ? {
                ...current,
                entry: {
                  status: 'created',
                  billKey: result.billKey,
                  entityId: 'A210',
                },
              }
            : current,
        )
        setPreview(null)
      }
    } catch (err) {
      if (mounted.current) {
        setError(message(err))
        setPreview(null)
        setRefresh((value) => value + 1)
      }
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <section
      aria-label="Intacct draft"
      className="space-y-4 rounded-lg border p-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Create draft AP bill</h2>
        <p className="text-sm text-muted-foreground">
          A210 · Gen7 LP · CAD. The invoice and posting dates use the Bookworks
          invoice date; the Bookworks due date is retained.
        </p>
      </div>
      {invoice.posted !== true && (
        <p role="status">
          Only posted Bookworks invoices can be sent to Intacct.
        </p>
      )}
      {context?.entry?.status === 'created' && (
        <p role="status">
          Intacct draft reference: {context.entry.billKey}. This invoice has
          already been sent.
        </p>
      )}
      {context?.entry &&
        ['creating', 'uncertain'].includes(context.entry.status) && (
          <p role="alert">
            A creation attempt is in progress or its result is uncertain. Check
            Intacct before retrying.
          </p>
        )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {!context && !busy && (
        <Button
          variant="outline"
          onClick={() => {
            setError('')
            setRefresh((value) => value + 1)
          }}
        >
          Retry draft setup
        </Button>
      )}
      {busy && !context && <p role="status">Loading vendor mapping…</p>}
      {context && !blockedEntry && invoice.posted === true && (
        <>
          <div className="space-y-3 rounded-md bg-muted/30 p-4">
            <p className="text-sm">
              Bookworks vendor:{' '}
              <strong>{invoice.vendorName || invoice.vendorCode}</strong> (
              {invoice.vendorCode})
            </p>
            <p className="text-sm">
              Saved Intacct vendor:{' '}
              {savedVendor
                ? `${savedVendor.vendorId} — ${savedVendor.vendorName}`
                : 'Not mapped'}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="bw-vendor-search">Intacct vendor name</Label>
                <Input
                  id="bw-vendor-search"
                  value={vendorSearch}
                  maxLength={100}
                  onChange={(event) => setVendorSearch(event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                disabled={busy || vendorBusy || vendorSearch.trim().length < 2}
                onClick={() => void vendorLookup()}
              >
                {vendorBusy ? 'Searching…' : 'Find vendors'}
              </Button>
            </div>
            {vendorMore && (
              <p className="text-sm text-muted-foreground">
                More vendors match. Refine the name to find the correct vendor.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="bw-vendor">Intacct vendor</Label>
                <select
                  id="bw-vendor"
                  value={vendorId}
                  disabled={busy || vendorBusy}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:min-w-80"
                  onChange={(event) => {
                    setVendorId(event.target.value)
                    setPreview(null)
                    setNotice('')
                  }}
                >
                  <option value="">Select a vendor</option>
                  {savedVendor &&
                    !vendors.some((v) => v.id === savedVendor.vendorId) && (
                      <option value={savedVendor.vendorId}>
                        {savedVendor.vendorId} — {savedVendor.vendorName}
                      </option>
                    )}
                  {vendors.map((vendor) => (
                    <option key={vendor.key} value={vendor.id}>
                      {vendor.id} — {vendor.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                disabled={busy || vendorBusy || !vendorId}
                onClick={() => void saveVendor()}
              >
                Save vendor mapping
              </Button>
            </div>
            {mappingChanged && (
              <p className="text-sm text-muted-foreground">
                Save the selected vendor mapping before previewing.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bw-invoice-pdf">Invoice PDF (optional)</Label>
            <Input
              id="bw-invoice-pdf"
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
              onChange={(event) => {
                void inspect(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            <p className="text-sm text-muted-foreground">
              The PDF is read locally to suggest an account. Amounts come from
              Bookworks; this upload is not attached to Intacct.
            </p>
            <p role="status" className="text-sm">
              {pdfNote}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void inspect()}
            >
              Clear PDF suggestion
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bw-cogs">COGS account</Label>
            <select
              id="bw-cogs"
              value={cogsType}
              disabled={busy || pdfBusy}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              onChange={(event) => {
                setCogsType(event.target.value as 'fuel' | 'freight')
                setPreview(null)
              }}
            >
              <option value="fuel">Fuel — 50200</option>
              <option value="freight">Freight — 51050</option>
            </select>
          </div>
          <Button
            disabled={!canPreview || vendorBusy}
            onClick={() => void showPreview()}
          >
            Preview draft
          </Button>
        </>
      )}
      {preview && !blockedEntry && (
        <div className="space-y-3" aria-label="Draft preview">
          <h3 className="font-medium">
            Draft preview — {preview.invoiceNumber}
          </h3>
          <p className="text-sm">
            {preview.vendor.id} — {preview.vendor.name} · Invoice/posting date:{' '}
            {preview.invoiceDate} · Due: {preview.dueDate}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debit (CAD)</TableHead>
                <TableHead className="text-right">Credit (CAD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  COGS {preview.cogsType === 'fuel' ? 'Fuel' : 'Freight'} —{' '}
                  {preview.cogsAccount}
                </TableCell>
                <TableCell className="text-right">
                  {money(preview.costCents)}
                </TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell>HST — 22000</TableCell>
                <TableCell className="text-right">
                  {money(preview.hstCents)}
                </TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell>Accounts Payable — vendor default</TableCell>
                <TableCell />
                <TableCell className="text-right">
                  {money(preview.totalCents)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground">
            The draft will remain unposted for review in Intacct.
          </p>
          <Button
            disabled={
              !canPreview || vendorBusy || cogsType !== preview.cogsType
            }
            onClick={() => void createDraft()}
          >
            {busy ? 'Creating…' : 'Create draft in Intacct'}
          </Button>
        </div>
      )}
    </section>
  )
}
