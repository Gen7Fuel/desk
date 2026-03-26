import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarIcon, Eye } from 'lucide-react'
import type {LogRecord} from '@/lib/log-api';
import { can } from '@/lib/permissions'
import {  fetchLogs } from '@/lib/log-api'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_appbar/_sidebar/settings/logs')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('settings.logs', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const APP_OPTIONS = [
  { value: '', label: 'All Apps' },
  { value: 'hub.payables', label: 'Hub — Payables' },
  { value: 'hub.receivables', label: 'Hub — Receivables' },
  { value: 'fuel.fuelRec', label: 'Fuel — Fuel Rec' },
  { value: 'fuel.kardpoll', label: 'Fuel — Kardpoll' },
  { value: 'fuel.fuelInvoicing', label: 'Fuel — Fuel Invoicing' },
]

const LIMIT = 50

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function RouteComponent() {
  const [app, setApp] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<Array<LogRecord>>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [snapshotModal, setSnapshotModal] = useState<{
    open: boolean
    data: unknown
  }>({ open: false, data: null })

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetchLogs({
        app: app || undefined,
        action: action || undefined,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        page,
        limit: LIMIT,
      })
      setLogs(res.logs)
      setTotal(res.total)
    } catch {
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [app, action, from, to, page])

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div>
        <h2 className="text-2xl font-semibold">Activity Log</h2>
        <p className="text-sm text-muted-foreground">
          Audit trail of edits and deletions across the application.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            App
          </span>
          <select
            value={app}
            onChange={(e) => {
              setApp(e.target.value)
              setPage(1)
            }}
            className="rounded border bg-background px-2 py-1.5 text-sm"
          >
            {APP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Action
          </span>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setPage(1)
            }}
            className="rounded border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="edit">Edit</option>
            <option value="delete">Delete</option>
          </select>
        </div>

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
                onSelect={(d) => {
                  setFrom(d ? format(d, 'yyyy-MM-dd') : '')
                  setPage(1)
                }}
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
                {to ? format(parseISO(to), 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={to ? parseISO(to) : undefined}
                onSelect={(d) => {
                  setTo(d ? format(d, 'yyyy-MM-dd') : '')
                  setPage(1)
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="rounded-md bg-muted/50 px-4 py-3 text-sm font-medium">
        {total} {total === 1 ? 'entry' : 'entries'} found
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
                <th className="px-4 py-2 text-left font-medium">Timestamp</th>
                <th className="px-4 py-2 text-left font-medium">App</th>
                <th className="px-4 py-2 text-left font-medium">Action</th>
                <th className="px-4 py-2 text-left font-medium">Entity ID</th>
                <th className="px-4 py-2 text-left font-medium">User</th>
                <th className="px-4 py-2 text-left font-medium">IP</th>
                <th className="px-4 py-2 text-left font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log._id} className="border-t hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{log.app}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 text-xs font-medium',
                          log.action === 'delete'
                            ? 'bg-destructive/10 text-destructive'
                            : log.action === 'create'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        )}
                      >
                        {log.action === 'delete'
                          ? 'Delete'
                          : log.action === 'create'
                            ? 'Create'
                            : 'Edit'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs">{log.entityId}</span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {log.user?.email ?? '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {log.ip ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      {log.action === 'edit' ? (
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <span className="font-medium">{log.field}:</span>
                          <span className="font-mono text-muted-foreground line-through">
                            {String(log.oldValue ?? '')}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono">
                            {String(log.newValue ?? '')}
                          </span>
                        </div>
                      ) : log.entitySnapshot ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSnapshotModal({
                              open: true,
                              data: log.entitySnapshot,
                            })
                          }
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View Details
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No log entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog
        open={snapshotModal.open}
        onOpenChange={(open) =>
          setSnapshotModal({ open, data: snapshotModal.data })
        }
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Entry Details</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 font-mono text-xs">
            {JSON.stringify(snapshotModal.data, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}
