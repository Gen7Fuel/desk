import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileDown,
  Trash2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pdf } from '@react-pdf/renderer'
import PayablePDF from '@/components/custom/PayablePDF'
import { can, getTokenPayload } from '@/lib/permissions'
import { createLog } from '@/lib/log-api'
import { SitePicker } from '@/components/custom/SitePicker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_appbar/_sidebar/hub/payables')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.payables', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

interface Payable {
  _id: string
  vendorName: string
  location: {
    _id: string
    stationName: string
    csoCode: string
  }
  notes: string
  paymentMethod: string
  amount: number
  images: Array<string>
  createdAt: string
}

const HUB = 'https://app.gen7fuel.com'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  safe: 'Safe',
  till: 'Till',
  cheque: 'Cheque',
  on_account: 'On Account',
  other: 'Other',
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function getExternalToken(): string {
  const payload = getTokenPayload() as
    | (ReturnType<typeof getTokenPayload> & { externalToken?: string })
    | null
  return payload?.externalToken ?? ''
}

function toLocalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

type SafesheetEntry = { _id: string; date: string; description: string }

async function findSafesheetEntry(
  site: string,
  dateStr: string,
  vendorName: string,
): Promise<SafesheetEntry | null> {
  try {
    const res = await fetch(
      `${HUB}/api/safesheets/site/${encodeURIComponent(site)}?from=${dateStr}&to=${dateStr}`,
      { headers: { Authorization: `Bearer ${getExternalToken()}` } },
    )
    if (!res.ok) return null
    const data: { entries?: Array<SafesheetEntry> } = await res.json()
    return (
      (data.entries ?? []).find(
        (e) =>
          e.description === `Payout - ${vendorName}` &&
          toLocalDate(e.date) === dateStr,
      ) ?? null
    )
  } catch {
    return null
  }
}

async function createSafesheetEntry(
  site: string,
  isoDate: string,
  vendorName: string,
  amount: number,
): Promise<void> {
  try {
    await fetch(
      `${HUB}/api/safesheets/site/${encodeURIComponent(site)}/entries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getExternalToken()}`,
        },
        body: JSON.stringify({
          date: isoDate,
          description: `Payout - ${vendorName}`,
          cashExpenseOut: amount,
        }),
      },
    )
  } catch (err) {
    console.error('Safesheet create failed:', err)
  }
}

async function updateSafesheetEntry(
  site: string,
  entryId: string,
  changes: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(
      `${HUB}/api/safesheets/site/${encodeURIComponent(site)}/entries/${entryId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getExternalToken()}`,
        },
        body: JSON.stringify(changes),
      },
    )
  } catch (err) {
    console.error('Safesheet update failed:', err)
  }
}

async function deleteSafesheetEntry(
  site: string,
  entryId: string,
): Promise<void> {
  try {
    await fetch(
      `${HUB}/api/safesheets/site/${encodeURIComponent(site)}/entries/${entryId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getExternalToken()}` },
      },
    )
  } catch (err) {
    console.error('Safesheet delete failed:', err)
  }
}

function PayableDateCell({
  payable,
  onUpdate,
}: {
  payable: Payable
  onUpdate: (newCreatedAt: string, newVal: string) => void
}) {
  const [selected, setSelected] = useState(new Date(payable.createdAt))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full cursor-pointer rounded px-1 text-left hover:bg-muted/50">
          {new Date(payable.createdAt).toLocaleDateString('en-CA')}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              setSelected(date)
              onUpdate(date, format(date, 'yyyy-MM-dd'))
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function RouteComponent() {
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [site, setSite] = useState('Rankin')
  const [payables, setPayables] = useState<Array<Payable>>([])
  const [loading, setLoading] = useState(false)
  const [editingCell, setEditingCell] = useState<{
    id: string
    field: 'createdAt' | 'vendorName' | 'amount' | 'paymentMethod'
  } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean
    images: Array<string>
    currentIndex: number
  }>({ isOpen: false, images: [], currentIndex: 0 })

  const fetchPayables = async () => {
    if (!from || !to || !site) return
    setLoading(true)
    try {
      const token = getExternalToken()

      const locRes = await fetch(`${HUB}/api/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const locations: Array<{ _id: string; stationName: string }> =
        await locRes.json()
      const selected = locations.find((l) => l.stationName === site)
      if (!selected) {
        setPayables([])
        return
      }

      const params = new URLSearchParams({
        location: selected._id,
        from: new Date(`${from}T00:00:00Z`).toISOString(),
        to: new Date(`${to}T23:59:59Z`).toISOString(),
      })

      const res = await fetch(`${HUB}/api/payables?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Required-Permission': 'payables',
        },
      })
      const data: unknown = await res.json()
      setPayables(Array.isArray(data) ? data : [])
    } catch {
      setPayables([])
    } finally {
      setLoading(false)
    }
  }

  const deletePayable = async (payable: Payable) => {
    if (
      !window.confirm(
        `Delete payable entry for ${payable.vendorName}? This cannot be undone.`,
      )
    )
      return
    try {
      const token = getExternalToken()
      const res = await fetch(`${HUB}/api/payables/${payable._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Required-Permission': 'payables',
        },
      })
      if (res.ok) {
        void createLog({
          app: 'hub.payables',
          action: 'delete',
          entityId: payable._id,
          entitySnapshot: payable,
          severity: 'warning',
        })
        setPayables((prev) => prev.filter((p) => p._id !== payable._id))
      }
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const updatePayable = async (
    id: string,
    field: 'createdAt' | 'vendorName' | 'amount',
    value: string,
  ) => {
    if (!editingCell) return

    const currentPayable = payables.find((p) => p._id === id)
    if (!currentPayable) {
      setEditingCell(null)
      return
    }

    let isChanged = false
    if (field === 'createdAt') {
      const currentVal = new Date(currentPayable.createdAt).toLocaleDateString(
        'en-CA',
      )
      isChanged = currentVal !== value
    } else if (field === 'amount') {
      isChanged = currentPayable.amount !== parseFloat(value)
    } else {
      isChanged =
        (currentPayable as Record<string, any>)[field as string] !== value
    }

    if (!isChanged) {
      setEditingCell(null)
      return
    }

    try {
      const token = getExternalToken()
      const body: Record<string, unknown> = {}

      if (field === 'createdAt') {
        body.createdAt = `${value}T12:00:00.000Z`
      } else if (field === 'amount') {
        body.amount = parseFloat(value)
      } else {
        body[field] = value
      }

      const res = await fetch(`${HUB}/api/payables/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Required-Permission': 'payables',
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        void createLog({
          app: 'hub.payables',
          action: 'edit',
          entityId: id,
          field,
          oldValue:
            field === 'createdAt'
              ? new Date(currentPayable.createdAt).toLocaleDateString('en-CA')
              : field === 'amount'
                ? currentPayable.amount
                : (currentPayable as Record<string, unknown>)[field as string],
          newValue: field === 'amount' ? parseFloat(value) : value,
        })
        setPayables((prev) =>
          prev.map((p) =>
            p._id === id
              ? {
                  ...p,
                  [field]: field === 'amount' ? parseFloat(value) : value,
                  createdAt:
                    field === 'createdAt'
                      ? `${value}T12:00:00.000Z`
                      : p.createdAt,
                }
              : p,
          ),
        )

        // Sync safesheet
        const stationName = currentPayable.location.stationName
        const dateStr = toLocalDate(currentPayable.createdAt)

        if (field === 'paymentMethod') {
          const oldMethod = currentPayable.paymentMethod
          if (oldMethod !== 'safe' && value === 'safe') {
            void createSafesheetEntry(
              stationName,
              currentPayable.createdAt,
              currentPayable.vendorName,
              currentPayable.amount,
            )
          } else if (oldMethod === 'safe' && value !== 'safe') {
            void (async () => {
              const entry = await findSafesheetEntry(
                stationName,
                dateStr,
                currentPayable.vendorName,
              )
              if (entry) await deleteSafesheetEntry(stationName, entry._id)
            })()
          }
        } else if (
          field === 'amount' &&
          currentPayable.paymentMethod === 'safe'
        ) {
          void (async () => {
            const entry = await findSafesheetEntry(
              stationName,
              dateStr,
              currentPayable.vendorName,
            )
            if (entry)
              await updateSafesheetEntry(stationName, entry._id, {
                cashExpenseOut: parseFloat(value),
              })
          })()
        } else if (
          field === 'vendorName' &&
          currentPayable.paymentMethod === 'safe'
        ) {
          void (async () => {
            const entry = await findSafesheetEntry(
              stationName,
              dateStr,
              currentPayable.vendorName,
            )
            if (entry)
              await updateSafesheetEntry(stationName, entry._id, {
                description: `Payout - ${value}`,
              })
          })()
        } else if (
          field === 'createdAt' &&
          currentPayable.paymentMethod === 'safe'
        ) {
          void (async () => {
            const entry = await findSafesheetEntry(
              stationName,
              dateStr,
              currentPayable.vendorName,
            )
            if (entry)
              await updateSafesheetEntry(stationName, entry._id, {
                date: `${value}T12:00:00.000Z`,
              })
          })()
        }
      }
    } catch (err) {
      console.error('Update failed:', err)
    } finally {
      setEditingCell(null)
    }
  }

  useEffect(() => {
    void fetchPayables()
  }, [from, to, site])

  const viewImages = (images: Array<string>) => {
    if (images.length === 0) return
    setImageModal({ isOpen: true, images, currentIndex: 0 })
  }

  const closeModal = () =>
    setImageModal({ isOpen: false, images: [], currentIndex: 0 })

  const nextImage = () =>
    setImageModal((prev) => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.images.length,
    }))

  const prevImage = () =>
    setImageModal((prev) => ({
      ...prev,
      currentIndex:
        prev.currentIndex === 0
          ? prev.images.length - 1
          : prev.currentIndex - 1,
    }))

  const totalAmount = payables.reduce((sum, p) => sum + p.amount, 0)

  const fetchImageDataUri = async (filename: string): Promise<string> => {
    try {
      const resp = await fetch(
        `${HUB}/cdn/download/${encodeURIComponent(filename)}`,
      )
      if (!resp.ok) return ''
      const blob = await resp.blob()
      const reader = new FileReader()
      return await new Promise<string>((resolve, reject) => {
        reader.onerror = () => reject(reader.error)
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(blob)
      })
    } catch {
      return ''
    }
  }

  const generatePDF = async (payable: Payable) => {
    try {
      const imageDataUris: Array<string> = []
      for (const img of payable.images) {
        const uri = await fetchImageDataUri(img)
        if (uri) imageDataUris.push(uri)
      }

      const doc = <PayablePDF payable={payable} imageDataUris={imageDataUris} />
      const instance = pdf(<></>)
      instance.updateContainer(doc)
      const blob = await instance.toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url)
    } catch (e) {
      console.error('Payable PDF generation error', e)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div>
        <h2 className="text-2xl font-semibold">Payables</h2>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            From
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[180px] justify-start text-left font-normal',
                  !from && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {from ? (
                  format(parseISO(from), 'PPP')
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={from ? parseISO(from) : undefined}
                onSelect={(date) =>
                  setFrom(date ? format(date, 'yyyy-MM-dd') : '')
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            To
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[180px] justify-start text-left font-normal',
                  !to && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {to ? format(parseISO(to), 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={to ? parseISO(to) : undefined}
                onSelect={(date) =>
                  setTo(date ? format(date, 'yyyy-MM-dd') : '')
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <SitePicker value={site} onValueChange={setSite} />
      </div>

      <div className="flex justify-between rounded-md bg-muted/50 px-4 py-3 text-sm font-medium">
        <span>Total Entries: {payables.length}</span>
        <span>Total Amount: ${totalAmount.toFixed(2)}</span>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Vendor</th>
                <th className="px-4 py-2 text-left font-medium">
                  Payment Method
                </th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-center font-medium">Images</th>
                <th className="px-4 py-2 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payables.length > 0 ? (
                payables.map((payable) => (
                  <tr key={payable._id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <PayableDateCell
                        payable={payable}
                        onUpdate={(date, newVal) => {
                          void (async () => {
                            try {
                              const token = getExternalToken()
                              const body = {
                                createdAt: `${newVal}T12:00:00.000Z`,
                              }
                              const res = await fetch(
                                `${HUB}/api/payables/${payable._id}`,
                                {
                                  method: 'PUT',
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                    'X-Required-Permission': 'payables',
                                  },
                                  body: JSON.stringify(body),
                                },
                              )
                              if (res.ok) {
                                void createLog({
                                  app: 'hub.payables',
                                  action: 'edit',
                                  entityId: payable._id,
                                  field: 'createdAt',
                                  oldValue: toLocalDate(payable.createdAt),
                                  newValue: newVal,
                                })
                                setPayables((prev) =>
                                  prev.map((p) =>
                                    p._id === payable._id
                                      ? { ...p, createdAt: body.createdAt }
                                      : p,
                                  ),
                                )
                                if (payable.paymentMethod === 'safe') {
                                  const stationName =
                                    payable.location.stationName
                                  const oldDateStr = toLocalDate(
                                    payable.createdAt,
                                  )
                                  void (async () => {
                                    const entry = await findSafesheetEntry(
                                      stationName,
                                      oldDateStr,
                                      payable.vendorName,
                                    )
                                    if (entry)
                                      await updateSafesheetEntry(
                                        stationName,
                                        entry._id,
                                        {
                                          date: `${newVal}T12:00:00.000Z`,
                                        },
                                      )
                                  })()
                                }
                              }
                            } catch (err) {
                              console.error('Update failed:', err)
                            }
                          })()
                        }}
                      />
                    </td>
                    <td
                      className="cursor-pointer px-4 py-2"
                      onDoubleClick={() => {
                        setEditingCell({ id: payable._id, field: 'vendorName' })
                        setEditValue(payable.vendorName)
                      }}
                    >
                      {editingCell?.id === payable._id &&
                      editingCell.field === 'vendorName' ? (
                        <input
                          autoFocus
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() =>
                            updatePayable(payable._id, 'vendorName', editValue)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              updatePayable(
                                payable._id,
                                'vendorName',
                                editValue,
                              )
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                          className="w-full rounded border bg-background px-1"
                        />
                      ) : (
                        payable.vendorName
                      )}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-2"
                      onDoubleClick={() => {
                        setEditingCell({
                          id: payable._id,
                          field: 'paymentMethod',
                        })
                        setEditValue(payable.paymentMethod)
                      }}
                    >
                      {editingCell?.id === payable._id &&
                      editingCell.field === 'paymentMethod' ? (
                        <select
                          autoFocus
                          value={editValue}
                          onChange={(e) =>
                            void updatePayable(
                              payable._id,
                              'paymentMethod',
                              e.target.value,
                            )
                          }
                          onBlur={() => setEditingCell(null)}
                          className="rounded border bg-background px-1 text-sm"
                        >
                          <option value="safe">Safe</option>
                          <option value="till">Till</option>
                          <option value="cheque">Cheque</option>
                          <option value="on_account">On Account</option>
                          <option value="other">Other</option>
                        </select>
                      ) : (
                        (PAYMENT_METHOD_LABELS[payable.paymentMethod] ??
                        payable.paymentMethod)
                      )}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-2 text-right"
                      onDoubleClick={() => {
                        setEditingCell({ id: payable._id, field: 'amount' })
                        setEditValue(payable.amount.toString())
                      }}
                    >
                      {editingCell?.id === payable._id &&
                      editingCell.field === 'amount' ? (
                        <input
                          autoFocus
                          type="text"
                          inputMode="decimal"
                          value={editValue}
                          onChange={(e) => {
                            // Only allow numbers and one decimal point
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setEditValue(val)
                            }
                          }}
                          onBlur={() =>
                            updatePayable(payable._id, 'amount', editValue)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              updatePayable(payable._id, 'amount', editValue)
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                          className="w-full rounded border bg-background px-1 text-right"
                        />
                      ) : (
                        `$${payable.amount.toFixed(2)}`
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {payable.images.length}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewImages(payable.images)}
                          disabled={payable.images.length === 0}
                          title="View Images"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void generatePDF(payable)}
                          title="Download PDF"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        {can('hub.payables', 'delete') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => void deletePayable(payable)}
                            title="Delete Entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No payables found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={imageModal.isOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Image {imageModal.currentIndex + 1} of {imageModal.images.length}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-[60vh] w-full items-center justify-center overflow-hidden rounded-md bg-muted">
              <img
                src={`${HUB}/cdn/download/${imageModal.images[imageModal.currentIndex]}`}
                alt={`Payable document ${imageModal.currentIndex + 1}`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            {imageModal.images.length > 1 && (
              <div className="flex items-center gap-4">
                <Button onClick={prevImage} variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {imageModal.currentIndex + 1} / {imageModal.images.length}
                </span>
                <Button onClick={nextImage} variant="outline" size="sm">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `${HUB}/cdn/download/${imageModal.images[imageModal.currentIndex]}`,
                    '_blank',
                  )
                }
              >
                <ExternalLink className="mr-1 h-4 w-4" />
                Open in New Tab
              </Button>
              <Button onClick={closeModal} variant="secondary" size="sm">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
