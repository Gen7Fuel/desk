import * as React from 'react'
import {
  createFileRoute,
  useLoaderData,
  useNavigate,
} from '@tanstack/react-router'
import { format, subDays } from 'date-fns'
import {
  Document,
  Page,
  Image as PdfImage,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import {
  ExternalLink,
  MessageSquareText,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { SitePicker } from '@/components/custom/SitePicker'
import { DatePickerWithRange } from '@/components/custom/DatePickerWithRange'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/permissions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type BOLPhoto = {
  _id: string
  site: string
  date: string
  filename: string
  bolNumber?: string
  createdAt?: string
  updatedAt?: string
  comments?: Array<{ text: string; createdAt: string; user?: string }>
}
type Search = { site: string; from: string; to: string }
type ListResponse = {
  site: string
  from: string | null
  to: string | null
  count: number
  entries: Array<BOLPhoto>
}

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
const parseYmd = (s?: string) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const Route = createFileRoute('/_appbar/_fuel/fuel-rec')({
  validateSearch: (search: Record<string, unknown>) => {
    const today = new Date()
    const last7From = subDays(today, 6)
    return {
      site: typeof search.site === 'string' ? search.site : 'Rankin',
      from: typeof search.from === 'string' ? search.from : ymd(last7From),
      to: typeof search.to === 'string' ? search.to : ymd(today),
    } as Search
  },
  loaderDeps: ({ search }) => ({
    site: search.site,
    from: search.from,
    to: search.to,
  }),
  loader: async ({ deps }) => {
    const { site, from, to } = deps as Search
    if (
      !site ||
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to)
    ) {
      return { site, from, to, data: null as ListResponse | null }
    }
    const res = await fetch(
      `/api/fuel-rec/list?site=${encodeURIComponent(site)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      },
    )
    if (!res.ok) {
      const msg = await res.text().catch(() => '')
      throw new Error(msg || `HTTP ${res.status}`)
    }
    const data = (await res.json()) as ListResponse
    return { site, from, to, data }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { site, from, to, data } = useLoaderData({ from: Route.id })
  const navigate = useNavigate({ from: Route.fullPath })
  const setSearch = (next: Partial<Search>) =>
    navigate({ search: (prev: unknown) => ({ ...(prev as object), ...next }) })

  const range: DateRange | undefined = React.useMemo(() => {
    const f = parseYmd(from)
    const t = parseYmd(to)
    return f && t ? { from: f, to: t } : undefined
  }, [from, to])

  const onRangeSet: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  > = (val) => {
    const next = typeof val === 'function' ? val(range) : val
    if (!next.from || !next.to) return
    setSearch({ from: ymd(next.from), to: ymd(next.to) })
  }

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        page: { padding: 16 },
        image: { width: '100%', height: '100%', objectFit: 'contain' },
      }),
    [],
  )

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

  const [pending, setPending] = React.useState<Set<string>>(() => new Set())
  const [entries, setEntries] = React.useState<Array<BOLPhoto>>(
    () => data?.entries || [],
  )
  React.useEffect(() => {
    setEntries(data?.entries || [])
  }, [data])

  const [selectedImg, setSelectedImg] = React.useState<string | null>(null)
  const [activeCommentEntry, setActiveCommentEntry] =
    React.useState<BOLPhoto | null>(null)
  const [commentText, setCommentText] = React.useState('')
  const [commentPending, setCommentPending] = React.useState(false)

  const requestAgain = async (e: BOLPhoto) => {
    try {
      setPending((prev) => new Set(prev).add(e._id))
      const res = await fetch('/api/fuel-rec/request-again', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ site: e.site, date: e.date }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || `HTTP ${res.status}`)
      }
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

  const sanitizeSegment = (s?: string) => {
    const n = (s ?? '').toString()
    const invalid = '<>:"/\\|?*'
    let out = ''
    let prevSpace = false
    for (const ch of n) {
      const code = ch.charCodeAt(0)
      const isInvalid = invalid.indexOf(ch) !== -1 || code < 32
      const mapped = isInvalid ? ' ' : ch
      const isSpace = mapped === ' '
      if (isSpace) {
        if (!prevSpace && out.length > 0) {
          out += ' '
        }
        prevSpace = true
      } else {
        out += mapped
        prevSpace = false
      }
    }
    if (out.endsWith(' ')) out = out.slice(0, -1)
    return out
  }

  const formatDesiredName = (e: BOLPhoto) => {
    const date = (e.date || '').trim()
    const siteName = sanitizeSegment(e.site)
    const bol = sanitizeSegment(e.bolNumber || '')
    const parts = [date, siteName, bol].filter(Boolean)
    return parts.join(' - ')
  }

  const downloadPdfForEntry = async (e: BOLPhoto) => {
    try {
      const imgUrl = `/cdn/download/${e.filename}`
      const dataUrl = await fetchAsDataUrl(imgUrl)
      const Doc = (
        <Document>
          <Page size="A4" style={styles.page}>
            <PdfImage src={dataUrl} style={styles.image} />
          </Page>
        </Document>
      )
      const blob = await pdf(Doc).toBlob()
      const a = document.createElement('a')
      const url = URL.createObjectURL(blob)
      a.href = url
      const dot = e.filename.lastIndexOf('.')
      const base = dot > 0 ? e.filename.slice(0, dot) : e.filename
      const desired = formatDesiredName(e) || base
      a.download = `${desired}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(
        `PDF download failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  const deleteEntry = async (e: BOLPhoto) => {
    if (!can('accounting.fuelRec', 'delete')) return
    const ok = window.confirm(
      `Delete entry for ${e.site} on ${e.date}? This cannot be undone.`,
    )
    if (!ok) return
    try {
      setPending((prev) => new Set(prev).add(e._id))
      const res = await fetch(`/api/fuel-rec/${encodeURIComponent(e._id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'accounting.fuelRec.delete',
        },
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || `HTTP ${res.status}`)
      }
      setEntries((prev) => prev.filter((x) => x._id !== e._id))
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

  const handleCommentSave = async () => {
    if (!commentText.trim() || !activeCommentEntry) return
    setCommentPending(true)
    try {
      const res = await fetch(
        `/api/fuel-rec/${encodeURIComponent(activeCommentEntry._id)}/comment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({ text: commentText }),
        },
      )
      if (!res.ok) throw new Error('Failed to save')
      const result = await res.json()
      setEntries((prev) =>
        prev.map((x) =>
          x._id === activeCommentEntry._id
            ? { ...x, comments: result.comments }
            : x,
        ),
      )
      setActiveCommentEntry({
        ...activeCommentEntry,
        comments: result.comments,
      })
      setCommentText('')
    } catch {
      alert('Failed to add comment')
    } finally {
      setCommentPending(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <SitePicker
          value={site}
          onValueChange={(v) => setSearch({ site: v })}
          placeholder="Pick a site"
          label="Site"
          className="w-[240px]"
        />
        <DatePickerWithRange date={range} setDate={onRangeSet} />
      </div>

      {!site && (
        <div className="text-xs text-muted-foreground">
          Pick a site to view BOL entries.
        </div>
      )}

      {data && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Showing {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}{' '}
            for {data.site} from {data.from} to {data.to}
          </div>
          {entries.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No entries found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">BOL Number</th>
                    <th className="px-2 py-2">Preview</th>
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e._id} className="border-b">
                      <td className="px-2 py-2 font-mono">{e.date}</td>
                      <td className="px-2 py-2">{e.bolNumber || '—'}</td>
                      <td className="px-2 py-2">
                        <img
                          src={`/cdn/download/${e.filename}`}
                          alt={`${e.date} preview`}
                          className="w-16 h-16 object-cover rounded border cursor-pointer"
                          loading="lazy"
                          onClick={() =>
                            setSelectedImg('/cdn/download/' + e.filename)
                          }
                        />
                      </td>
                      <td className="px-2 py-2 space-x-3">
                        <Button onClick={() => downloadPdfForEntry(e)}>
                          PDF
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setActiveCommentEntry(e)}
                          title="Comments"
                          aria-label="Comments"
                          className="relative"
                        >
                          <MessageSquareText className="h-4 w-4" />
                          <span className="sr-only">Comments</span>
                          {e.comments && e.comments.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1.5 min-w-[1.25rem] h-5 flex items-center justify-center border border-white">
                              {e.comments.length}
                            </span>
                          )}
                        </Button>

                        {can('accounting.fuelRec', 'requestAgain') && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => requestAgain(e)}
                            disabled={pending.has(e._id)}
                            title="Request Again"
                            aria-label="Request Again"
                          >
                            {pending.has(e._id) ? (
                              <span className="text-xs">…</span>
                            ) : (
                              <RefreshCcw className="h-4 w-4" />
                            )}
                          </Button>
                        )}

                        {can('accounting.fuelRec', 'delete') && (
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteEntry(e)}
                            disabled={pending.has(e._id)}
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Image Viewer Dialog */}
      <Dialog open={!!selectedImg} onOpenChange={() => setSelectedImg(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>BOL Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
            <img
              src={selectedImg || ''}
              className="max-w-full max-h-[70vh] object-contain"
              alt="BOL Preview"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => window.open(selectedImg || '', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" /> Open in New Tab
            </Button>
            <Button variant="secondary" onClick={() => setSelectedImg(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog
        open={!!activeCommentEntry}
        onOpenChange={() => setActiveCommentEntry(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Comments - {activeCommentEntry?.date}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 border-b pb-4">
              {activeCommentEntry?.comments &&
              activeCommentEntry.comments.length > 0 ? (
                activeCommentEntry.comments.map((c, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm"
                  >
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span className="font-bold text-slate-700">
                        {c.user || 'User'}
                      </span>
                      <span>
                        {format(new Date(c.createdAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-slate-800 leading-relaxed">{c.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-400 text-sm py-10">
                  No comments on this record yet.
                </p>
              )}
            </div>
            <div className="space-y-3">
              <textarea
                className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                rows={3}
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setActiveCommentEntry(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCommentSave}
                  disabled={commentPending || !commentText.trim()}
                >
                  {commentPending ? 'Adding...' : 'Add Comment'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
