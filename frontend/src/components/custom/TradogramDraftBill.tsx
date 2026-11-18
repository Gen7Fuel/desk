import { useState } from 'react'
import type { DeliveryDetail, TradogramBillPreview } from '@/lib/tradogram-api'
import { tradogramRequest } from '@/lib/tradogram-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Result = {
  billKey: string
  billNumber: string
  entityId: string
  state: 'draft'
  alreadyCreated: boolean
}
const money = (cents: number) =>
  (cents / 100).toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function TradogramDraftBill({
  detail,
  disabled,
  onBusy,
  onCreated,
  onReload,
}: {
  detail: DeliveryDetail
  disabled: boolean
  onBusy: (busy: boolean) => void
  onCreated: (result: Result) => void
  onReload: () => Promise<void>
}) {
  const date = detail.source.receivedDate.slice(0, 10)
  const [fields, setFields] = useState({
    billNumber:
      `${detail.draft?.invoiceNumber || 'TG'}-${detail.source.deliveryCode}`.slice(
        0,
        100,
      ),
    invoiceDate: date,
    dueDate: date,
  })
  const [preview, setPreview] = useState<TradogramBillPreview | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const draft = detail.draft
  const blocked = ['creating', 'created', 'uncertain'].includes(
    draft?.intacctCreationState || '',
  )
  const unavailable =
    disabled ||
    busy ||
    detail.stale ||
    draft?.status !== 'ready' ||
    blocked ||
    !!draft.intacctBillKey
  const endpoint = `/deliveries/${detail.source.deliveryCode}`
  function change(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }))
    setPreview(null)
    setAcknowledged(false)
  }
  async function submit(create: boolean) {
    setBusy(true)
    onBusy(true)
    setError('')
    try {
      if (create && preview) {
        const result = await tradogramRequest<Result>(
          `${endpoint}/intacct-draft`,
          {
            method: 'POST',
            body: JSON.stringify({
              ...fields,
              previewHash: preview.hash,
              subtotalAcknowledged: acknowledged,
            }),
          },
        )
        setPreview(null)
        onCreated(result)
      } else {
        setPreview(null)
        setAcknowledged(false)
        setPreview(
          await tradogramRequest<TradogramBillPreview>(
            `${endpoint}/draft-preview`,
            { method: 'POST', body: JSON.stringify(fields) },
          ),
        )
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Intacct draft request failed.',
      )
      setPreview(null)
      if (create) await onReload()
    } finally {
      setBusy(false)
      onBusy(false)
    }
  }
  return (
    <section
      aria-label="Intacct draft bill"
      className="space-y-4 rounded-lg border p-4"
    >
      <h3 className="font-semibold">Create Intacct draft bill</h3>
      <p className="text-sm text-muted-foreground">
        Creates an unposted, received-subtotal bill. Review tax, fees and
        discounts in Intacct before posting. Tradogram records are unchanged.
      </p>
      {draft?.intacctBillKey ? (
        <p role="status">
          Intacct draft reference: {draft.intacctBillKey} · Entity{' '}
          {draft.intacctEntityId} · Bill {draft.intacctBillNumber}. This
          delivery has already been sent.
        </p>
      ) : blocked ? (
        <p role="alert">
          A creation attempt is in progress or its result is uncertain. Check
          Intacct before retrying. Desk has blocked another creation attempt.
        </p>
      ) : (
        <>
          {(disabled || detail.stale || draft?.status !== 'ready') && (
            <p className="text-sm">
              Save your changes and mark this delivery ready before previewing.
            </p>
          )}
          <fieldset
            disabled={unavailable}
            className="grid gap-3 sm:grid-cols-3"
          >
            <div className="space-y-2">
              <Label htmlFor="tg-bill-number">Intacct bill number</Label>
              <Input
                id="tg-bill-number"
                maxLength={100}
                value={fields.billNumber}
                onChange={(e) => change('billNumber', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tg-invoice-date">Invoice date</Label>
              <Input
                id="tg-invoice-date"
                type="date"
                value={fields.invoiceDate}
                onChange={(e) => change('invoiceDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tg-due-date">Due date</Label>
              <Input
                id="tg-due-date"
                type="date"
                value={fields.dueDate}
                onChange={(e) => change('dueDate', e.target.value)}
              />
            </div>
          </fieldset>
          <p className="text-xs text-muted-foreground">
            Use a distinct bill number for each partial receipt. Dates initially
            use the receipt date; confirm them against the supplier invoice. The
            posting date uses the invoice date.
          </p>
          <Button
            variant="outline"
            disabled={
              unavailable ||
              !fields.billNumber.trim() ||
              !fields.invoiceDate ||
              !fields.dueDate
            }
            onClick={() => void submit(false)}
          >
            Preview Intacct draft
          </Button>
          {preview && !unavailable && (
            <div className="space-y-3 rounded-md bg-muted/40 p-4">
              <p className="font-medium">
                {preview.entityId} · {preview.company} · Draft only
              </p>
              <p className="text-sm">
                Vendor: {preview.vendor.id} · {preview.vendor.name}
                <br />
                Bill: {preview.billNumber}
                <br />
                Invoice / posting date: {preview.invoiceDate} · Due:{' '}
                {preview.dueDate}
                <br />
                Site: {preview.site}
              </p>
              <ul className="space-y-1 text-sm">
                {preview.lines.map((line) => (
                  <li key={line.id}>
                    {line.name} · Received {line.quantity} · GL {line.accountId}{' '}
                    ({line.accountName}) · {preview.currency}{' '}
                    {money(line.amountCents)}
                  </li>
                ))}
              </ul>
              <p className="font-medium">
                Received subtotal: {preview.currency}{' '}
                {money(preview.totalCents)}
              </p>
              <Label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                I will review tax, fees and discounts in Intacct before posting
                this subtotal-only draft.
              </Label>
              <Button
                disabled={!acknowledged || unavailable}
                onClick={() => void submit(true)}
              >
                Create Intacct draft bill
              </Button>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
