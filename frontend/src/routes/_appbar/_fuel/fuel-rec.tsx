import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { format, parseISO, subDays } from 'date-fns'
import {
  CalendarIcon,
  ExternalLink,
  FileDown,
  MessageSquareText,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import {
  Document,
  Page,
  Image as PdfImage,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
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
import { Sidebar } from '@/components/sidebar'

export const Route = createFileRoute('/_appbar/_fuel/fuel-rec')({
  component: RouteComponent,
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

type BOLPhoto = {
  _id: string
  site: string
  date: string
  filename: string
  bolNumber?: string
  createdAt?: string
  comments?: Array<{ text: string; createdAt: string; user?: string }>
}

type RightPane =
  | { type: 'image'; entry: BOLPhoto }
  | { type: 'comments'; entry: BOLPhoto }
  | null

const pdfStyles = StyleSheet.create({
  page: { padding: 16 },
  image: { width: '100%', height: '100%', objectFit: 'contain' },
})

function RouteComponent() {
  const [from, setFrom] = React.useState(
    () => subDays(new Date(), 6).toISOString().split('T')[0],
  )
  const [to, setTo] = React.useState(todayIso)
  const [site, setSite] = React.useState('Rankin')
  const [entries, setEntries] = React.useState<Array<BOLPhoto>>([])
  const [loading, setLoading] = React.useState(false)
  const [pending, setPending] = React.useState<Set<string>>(() => new Set())
  const [rightPane, setRightPane] = React.useState<RightPane>(null)
  const [commentText, setCommentText] = React.useState('')
  const [commentPending, setCommentPending] = React.useState(false)

  const fetchEntries = async () => {
    if (!from || !to || !site) return
    setLoading(true)
    try {
      const res = await fetch(
        `${HUB}/api/fuel-rec/list?site=${encodeURIComponent(site)}&from=${from}&to=${to}`,
        { headers: { Authorization: `Bearer ${getExternalToken()}` } },
      )
      const data: unknown = await res.json()
      setEntries(
        Array.isArray((data as { entries?: unknown }).entries)
          ? (data as { entries: Array<BOLPhoto> }).entries
          : [],
      )
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    void fetchEntries()
    setRightPane(null)
  }, [from, to, site])

  const fetchAsDataUrl = async (url: string): Promise<string> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load image (${res.status})`)
    const blob = await res.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const generatePDF = async (e: BOLPhoto) => {
    try {
      const dataUrl = await fetchAsDataUrl(`${HUB}/cdn/download/${e.filename}`)
      const doc = (
        <Document>
          <Page size="A4" style={pdfStyles.page}>
            <PdfImage src={dataUrl} style={pdfStyles.image} />
          </Page>
        </Document>
      )
      const instance = pdf(<></>)
      instance.updateContainer(doc)
      const blob = await instance.toBlob()
      window.open(URL.createObjectURL(blob))
    } catch (err) {
      alert(
        `PDF generation failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  const deleteEntry = async (e: BOLPhoto) => {
    if (!can('accounting.fuelRec', 'delete')) return
    if (
      !window.confirm(
        `Delete entry for ${e.site} on ${e.date}? This cannot be undone.`,
      )
    )
      return
    try {
      setPending((prev) => new Set(prev).add(e._id))
      const res = await fetch(
        `${HUB}/api/fuel-rec/${encodeURIComponent(e._id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getExternalToken()}` },
        },
      )
      if (!res.ok)
        throw new Error(
          (await res.text().catch(() => '')) || `HTTP ${res.status}`,
        )
      setEntries((prev) => prev.filter((x) => x._id !== e._id))
      if (rightPane?.entry._id === e._id) setRightPane(null)
    } catch (err) {
      alert(
        `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(e._id)
        return next
      })
    }
  }

  const requestAgain = async (e: BOLPhoto) => {
    try {
      setPending((prev) => new Set(prev).add(e._id))
      const res = await fetch(`${HUB}/api/fuel-rec/request-again`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getExternalToken()}`,
        },
        body: JSON.stringify({ site: e.site, date: e.date }),
      })
      if (!res.ok)
        throw new Error(
          (await res.text().catch(() => '')) || `HTTP ${res.status}`,
        )
      alert(`Retake request sent for ${e.site} on ${e.date}.`)
    } catch (err) {
      alert(
        `Retake request failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(e._id)
        return next
      })
    }
  }

  const handleCommentSave = async () => {
    if (!commentText.trim() || rightPane?.type !== 'comments') return
    const entry = rightPane.entry
    setCommentPending(true)
    try {
      const res = await fetch(
        `${HUB}/api/fuel-rec/${encodeURIComponent(entry._id)}/comment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getExternalToken()}`,
          },
          body: JSON.stringify({ text: commentText }),
        },
      )
      if (!res.ok) throw new Error('Failed to save')
      const result = await res.json()
      const updated = { ...entry, comments: result.comments }
      setEntries((prev) => prev.map((x) => (x._id === entry._id ? updated : x)))
      setRightPane({ type: 'comments', entry: updated })
      setCommentText('')
    } catch {
      alert('Failed to add comment')
    } finally {
      setCommentPending(false)
    }
  }

  const activeId = rightPane?.entry._id

  return (
    <div className="flex h-full">
      {/* Left pane — list */}
      <Sidebar className="w-1/2 overflow-hidden">
        <div className="flex flex-col gap-4 border-b p-4">
          <h2 className="text-2xl font-semibold">Fuel Rec</h2>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                From
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-[160px] justify-start text-left font-normal',
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
                      'w-[160px] justify-start text-left font-normal',
                      !to && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {to ? (
                      format(parseISO(to), 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
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

          <div className="rounded-md bg-muted/50 px-4 py-2 text-sm font-medium">
            Total Entries: {entries.length}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Loading…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">
                    BOL Number
                  </th>
                  <th className="px-4 py-2 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length > 0 ? (
                  entries.map((e) => (
                    <tr
                      key={e._id}
                      className={cn(
                        'cursor-pointer border-t hover:bg-muted/30',
                        activeId === e._id && 'bg-accent/80',
                      )}
                      onClick={() => setRightPane({ type: 'image', entry: e })}
                    >
                      <td className="px-4 py-2 font-mono">{e.date}</td>
                      <td className="px-4 py-2">{e.bolNumber || '—'}</td>
                      <td
                        className="px-4 py-2 text-center"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {can('accounting.fuelRec', 'read') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void generatePDF(e)}
                              title="Download PDF"
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          )}

                          {can('accounting.fuelRec', 'read') && (
                            <Button
                              size="sm"
                              variant={
                                rightPane?.type === 'comments' &&
                                activeId === e._id
                                  ? 'default'
                                  : 'outline'
                              }
                              onClick={() => {
                                setCommentText('')
                                setRightPane({ type: 'comments', entry: e })
                              }}
                              title="Comments"
                              className="relative"
                            >
                              <MessageSquareText className="h-4 w-4" />
                              {e.comments && e.comments.length > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-background bg-red-600 px-1 text-[10px] text-white">
                                  {e.comments.length}
                                </span>
                              )}
                            </Button>
                          )}

                          {can('accounting.fuelRec', 'requestAgain') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void requestAgain(e)}
                              disabled={pending.has(e._id)}
                              title="Request Again"
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                          )}

                          {can('accounting.fuelRec', 'delete') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => void deleteEntry(e)}
                              disabled={pending.has(e._id)}
                              title="Delete"
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
                      colSpan={3}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Sidebar>

      {/* Right pane — image or comments */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!rightPane && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a row to view the BOL image.
          </div>
        )}

        {rightPane?.type === 'image' && (
          <div className="flex h-full flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {rightPane.entry.date} —{' '}
                {rightPane.entry.bolNumber || 'No BOL #'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `${HUB}/cdn/download/${rightPane.entry.filename}`,
                    '_blank',
                  )
                }
              >
                <ExternalLink className="mr-1 h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-md bg-muted">
              <img
                src={`${HUB}/cdn/download/${rightPane.entry.filename}`}
                alt="BOL Preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        )}

        {rightPane?.type === 'comments' && (
          <div className="flex h-full flex-col gap-4 p-4">
            <span className="text-sm font-medium">
              Comments — {rightPane.entry.date}
            </span>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {rightPane.entry.comments &&
              rightPane.entry.comments.length > 0 ? (
                rightPane.entry.comments.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                  >
                    <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                      <span className="font-bold text-slate-700">
                        {c.user || 'User'}
                      </span>
                      <span>
                        {format(new Date(c.createdAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="leading-relaxed text-slate-800">{c.text}</p>
                  </div>
                ))
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No comments on this record yet.
                </p>
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <textarea
                className="w-full resize-none rounded-md border p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  onClick={handleCommentSave}
                  disabled={commentPending || !commentText.trim()}
                >
                  {commentPending ? 'Adding...' : 'Add Comment'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
