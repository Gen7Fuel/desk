import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileDown,
  FileText,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pdf } from '@react-pdf/renderer'
import PurchaseOrderPDF from '@/components/custom/PurchaseOrderPDF'
import ReceivablesReportPDF from '@/components/custom/ReceivablesReportPDF'
import ARDiscrepancyReportPDF from '@/components/custom/ARDiscrepancyReportPDF'
import { can, getTokenPayload } from '@/lib/permissions'
import { createLog } from '@/lib/log-api'
import { SitePicker } from '@/components/custom/SitePicker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_appbar/_sidebar/hub/receivables')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.receivables', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

interface PurchaseOrder {
  _id: string
  date: string
  fleetCardNumber: string
  customerName: string
  driverName: string
  quantity: number
  amount: number
  description: string
  vehicleMakeModel: string
  signature: string
  receipt: string
  poNumber: string
  requestReceipt?: boolean
}

const HUB = 'https://app.gen7fuel.com'

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function getExternalToken(): string {
  const payload = getTokenPayload() as { externalToken?: string } | null
  return payload?.externalToken ?? ''
}

const formatFleetCardNumber = (number: string) => {
  return (number || '').replace(/(.{4})/g, '$1 ').trim()
}

async function compressImage(
  filename: string,
  token: string,
  maxDimension = 1400,
  quality = 0.75,
): Promise<string | null> {
  try {
    const res = await fetch(`${HUB}/cdn/download/${filename}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Required-Permission': 'po',
      },
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) return null

    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = blobUrl
    })
    URL.revokeObjectURL(blobUrl)

    let { naturalWidth: w, naturalHeight: h } = img
    if (w > maxDimension || h > maxDimension) {
      if (w >= h) {
        h = Math.round((h / w) * maxDimension)
        w = maxDimension
      } else {
        w = Math.round((w / h) * maxDimension)
        h = maxDimension
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return null
  }
}

function RouteComponent() {
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [site, setSite] = useState('Rankin')
  const [purchaseOrders, setPurchaseOrders] = useState<Array<PurchaseOrder>>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [reportLoading, setReportLoading] = useState(false)
  const [arReportLoading, setArReportLoading] = useState(false)

  const [editingCell, setEditingCell] = useState<{
    id: string
    field: keyof PurchaseOrder
  } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean
    images: Array<string>
    currentIndex: number
    orderId: string
  }>({ isOpen: false, images: [], currentIndex: 0, orderId: '' })

  const fetchPurchaseOrders = async () => {
    if (!from || !to || !site) return
    setLoading(true)
    setFetchError(null)
    try {
      const token = getExternalToken()
      const params = new URLSearchParams({
        startDate: from,
        endDate: to,
        stationName: site,
      })

      const res = await fetch(`${HUB}/api/purchase-orders?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Required-Permission': 'po',
        },
      })
      if (!res.ok) {
        setFetchError(`Error ${res.status}: ${res.statusText}`)
        setPurchaseOrders([])
        return
      }
      const data: unknown = await res.json()
      setPurchaseOrders(Array.isArray(data) ? data : [])
    } catch {
      setFetchError('Network error — could not reach Hub.')
      setPurchaseOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchPurchaseOrders()
  }, [from, to, site])

  const updatePurchaseOrder = async (
    id: string,
    field: keyof PurchaseOrder,
    value: string | number,
  ) => {
    const currentOrder = purchaseOrders.find((o) => o._id === id)
    try {
      const token = getExternalToken()
      const body: Record<string, unknown> = { [field]: value }

      const res = await fetch(`${HUB}/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Required-Permission': 'po',
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        void createLog({
          app: 'hub.receivables',
          action: 'edit',
          entityId: id,
          field: String(field),
          oldValue: currentOrder
            ? (currentOrder as Record<string, unknown>)[field as string]
            : undefined,
          newValue: value,
        })
        setPurchaseOrders((prev) =>
          prev.map((o) => (o._id === id ? { ...o, [field]: value } : o)),
        )
      }
    } catch (err) {
      console.error('Update failed:', err)
    } finally {
      setEditingCell(null)
    }
  }

  const deletePurchaseOrder = async (order: PurchaseOrder) => {
    if (
      !window.confirm(
        `Delete PO entry for ${order.customerName}? This cannot be undone.`,
      )
    )
      return
    try {
      const token = getExternalToken()
      const res = await fetch(`${HUB}/api/purchase-orders/${order._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Required-Permission': 'po',
        },
      })
      if (res.ok) {
        void createLog({
          app: 'hub.receivables',
          action: 'delete',
          entityId: order._id,
          entitySnapshot: order,
          severity: 'warning',
        })
        setPurchaseOrders((prev) => prev.filter((o) => o._id !== order._id))
      }
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const generateArReport = async () => {
    if (['Oliver', 'Osoyoos'].includes(site) || !from || !to) return
    setArReportLoading(true)
    try {
      const token = getExternalToken()
      const params = new URLSearchParams({ site, from, to })
      const res = await fetch(
        `${HUB}/api/cash-summary/ar-check-range?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Required-Permission': 'po',
          },
        },
      )
      if (!res.ok) return
      const days: unknown = await res.json()
      const doc = (
        <ARDiscrepancyReportPDF
          days={Array.isArray(days) ? days : []}
          site={site}
          from={from}
          to={to}
        />
      )
      const instance = pdf(<></>)
      instance.updateContainer(doc)
      const blob = await instance.toBlob()
      window.open(URL.createObjectURL(blob))
    } catch (e) {
      console.error('AR report error', e)
    } finally {
      setArReportLoading(false)
    }
  }

  const generateReport = async () => {
    if (purchaseOrders.length === 0) return
    setReportLoading(true)
    try {
      const token = getExternalToken()
      const uniqueFilenames = [
        ...new Set(purchaseOrders.map((o) => o.receipt).filter(Boolean)),
      ]
      const results = await Promise.all(
        uniqueFilenames.map((fn) => compressImage(fn, token)),
      )
      const receiptDataUris: Record<string, string> = {}
      uniqueFilenames.forEach((fn, i) => {
        const uri = results[i]
        if (uri) receiptDataUris[fn] = uri
      })

      const doc = (
        <ReceivablesReportPDF
          orders={purchaseOrders}
          site={site}
          from={from}
          to={to}
          receiptDataUris={receiptDataUris}
        />
      )
      const instance = pdf(<></>)
      instance.updateContainer(doc)
      const blob = await instance.toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url)
    } catch (e) {
      console.error('Report PDF generation error', e)
    } finally {
      setReportLoading(false)
    }
  }

  const generatePDF = async (order: PurchaseOrder) => {
    try {
      const doc = <PurchaseOrderPDF order={order} />
      const instance = pdf(<></>)
      instance.updateContainer(doc)
      const blob = await instance.toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url)
    } catch (e) {
      console.error('PO PDF generation error', e)
    }
  }

  const viewImages = (order: PurchaseOrder) => {
    const images = [order.receipt, order.signature].filter(Boolean)
    if (images.length === 0) return
    setImageModal({ isOpen: true, images, currentIndex: 0, orderId: order._id })
  }

  const closeModal = () =>
    setImageModal({ isOpen: false, images: [], currentIndex: 0, orderId: '' })

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

  const requestReceipt = async (orderId: string) => {
    try {
      const token = getExternalToken()
      const res = await fetch(`${HUB}/api/purchase-orders/${orderId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Required-Permission': 'po',
        },
        body: JSON.stringify({ requestReceipt: true }),
      })
      if (res.ok) {
        setPurchaseOrders((prev) =>
          prev.map((o) =>
            o._id === orderId ? { ...o, requestReceipt: true } : o,
          ),
        )
      }
    } catch (err) {
      console.error('Request invoice failed:', err)
    }
  }

  const totalAmount = purchaseOrders.reduce(
    (sum, o) => sum + (o.amount || 0),
    0,
  )
  const totalQty = purchaseOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Receivables (Purchase Orders)
        </h2>
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
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() => void generateArReport()}
            disabled={arReportLoading || ['Oliver', 'Osoyoos'].includes(site)}
            title={
              ['Oliver', 'Osoyoos'].includes(site)
                ? 'Not available for this site'
                : undefined
            }
          >
            <FileText className="mr-2 h-4 w-4" />
            {arReportLoading ? 'Generating…' : 'AR Report'}
          </Button>
          <Button
            variant="default"
            onClick={() => void generateReport()}
            disabled={reportLoading || purchaseOrders.length === 0}
          >
            <FileText className="mr-2 h-4 w-4" />
            {reportLoading ? 'Generating…' : 'PDF Report'}
          </Button>
        </div>
      </div>

      <div className="flex justify-between rounded-md bg-muted/50 px-4 py-3 text-sm font-medium">
        <span>Total Entries: {purchaseOrders.length}</span>
        <span>Total Qty: {totalQty.toFixed(2)} L</span>
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
                <th className="px-4 py-2 text-left font-medium">
                  Fleet Card / PO #
                </th>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-left font-medium">Driver</th>
                <th className="px-4 py-2 text-right font-medium">Qty (L)</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length > 0 ? (
                purchaseOrders.map((order) => (
                  <tr key={order._id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-full cursor-pointer rounded px-1 text-left hover:bg-muted/50">
                            {new Date(order.date).toLocaleDateString('en-CA')}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={new Date(order.date)}
                            onSelect={(date) => {
                              if (date) {
                                void createLog({
                                  app: 'hub.receivables',
                                  action: 'edit',
                                  entityId: order._id,
                                  field: 'date',
                                  oldValue: new Date(
                                    order.date,
                                  ).toLocaleDateString('en-CA'),
                                  newValue: `${format(date, 'yyyy-MM-dd')}T12:00:00.000Z`,
                                })
                                void updatePurchaseOrder(
                                  order._id,
                                  'date',
                                  `${format(date, 'yyyy-MM-dd')}T12:00:00.000Z`,
                                )
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td
                      className="cursor-pointer px-4 py-2"
                      onDoubleClick={() => {
                        setEditingCell({ id: order._id, field: 'poNumber' })
                        setEditValue(order.poNumber || '')
                      }}
                    >
                      {editingCell?.id === order._id &&
                      editingCell.field === 'poNumber' ? (
                        <input
                          autoFocus
                          className="w-full rounded border bg-background px-1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() =>
                            updatePurchaseOrder(
                              order._id,
                              'poNumber',
                              editValue,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              updatePurchaseOrder(
                                order._id,
                                'poNumber',
                                editValue,
                              )
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                        />
                      ) : (
                        formatFleetCardNumber(order.fleetCardNumber) ||
                        order.poNumber ||
                        '-'
                      )}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-2"
                      onDoubleClick={() => {
                        setEditingCell({ id: order._id, field: 'customerName' })
                        setEditValue(order.customerName || '')
                      }}
                    >
                      {editingCell?.id === order._id &&
                      editingCell.field === 'customerName' ? (
                        <input
                          autoFocus
                          className="w-full rounded border bg-background px-1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() =>
                            updatePurchaseOrder(
                              order._id,
                              'customerName',
                              editValue,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              updatePurchaseOrder(
                                order._id,
                                'customerName',
                                editValue,
                              )
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                        />
                      ) : (
                        order.customerName || '-'
                      )}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-2"
                      onDoubleClick={() => {
                        setEditingCell({ id: order._id, field: 'driverName' })
                        setEditValue(order.driverName || '')
                      }}
                    >
                      {editingCell?.id === order._id &&
                      editingCell.field === 'driverName' ? (
                        <input
                          autoFocus
                          className="w-full rounded border bg-background px-1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() =>
                            updatePurchaseOrder(
                              order._id,
                              'driverName',
                              editValue,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              updatePurchaseOrder(
                                order._id,
                                'driverName',
                                editValue,
                              )
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                        />
                      ) : (
                        order.driverName || '-'
                      )}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-2 text-right"
                      onDoubleClick={() => {
                        setEditingCell({ id: order._id, field: 'quantity' })
                        setEditValue(order.quantity.toString() || '0')
                      }}
                    >
                      {editingCell?.id === order._id &&
                      editingCell.field === 'quantity' ? (
                        <input
                          autoFocus
                          type="text"
                          inputMode="decimal"
                          className="w-full rounded border bg-background px-1 text-right"
                          value={editValue}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setEditValue(val)
                            }
                          }}
                          onBlur={() =>
                            updatePurchaseOrder(
                              order._id,
                              'quantity',
                              parseFloat(editValue) || 0,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              updatePurchaseOrder(
                                order._id,
                                'quantity',
                                parseFloat(editValue) || 0,
                              )
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                        />
                      ) : (
                        (order.quantity || 0).toFixed(2)
                      )}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-2 text-right"
                      onDoubleClick={() => {
                        setEditingCell({ id: order._id, field: 'amount' })
                        setEditValue(order.amount.toString() || '0')
                      }}
                    >
                      {editingCell?.id === order._id &&
                      editingCell.field === 'amount' ? (
                        <input
                          autoFocus
                          type="text"
                          inputMode="decimal"
                          className="w-full rounded border bg-background px-1 text-right"
                          value={editValue}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setEditValue(val)
                            }
                          }}
                          onBlur={() =>
                            updatePurchaseOrder(
                              order._id,
                              'amount',
                              parseFloat(editValue) || 0,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              updatePurchaseOrder(
                                order._id,
                                'amount',
                                parseFloat(editValue) || 0,
                              )
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                        />
                      ) : (
                        `$${(order.amount || 0).toFixed(2)}`
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewImages(order)}
                          disabled={
                            ![order.receipt, order.signature].some(Boolean)
                          }
                          title="View Images"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.requestReceipt && (
                          <RefreshCw
                            className="h-4 w-4 text-muted-foreground"
                            title="Invoice requested"
                          />
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void generatePDF(order)}
                          title="Download PDF"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => void deletePurchaseOrder(order)}
                          title="Delete Entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {fetchError ?? 'No purchase orders found.'}
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
                alt={`Document ${imageModal.currentIndex + 1}`}
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
              <Button
                variant="outline"
                size="sm"
                disabled={
                  purchaseOrders.find((o) => o._id === imageModal.orderId)
                    ?.requestReceipt === true
                }
                onClick={() => void requestReceipt(imageModal.orderId)}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                {purchaseOrders.find((o) => o._id === imageModal.orderId)
                  ?.requestReceipt
                  ? 'Receipt Requested'
                  : 'Request Receipt'}
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
