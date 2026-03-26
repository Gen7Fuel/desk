import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type {Issue, IssueForm} from '@/lib/issues-api';
import { can } from '@/lib/permissions'
import {
  createIssue,
  deleteIssue,
  fetchIssues,
  updateIssue,
} from '@/lib/issues-api'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'


export const Route = createFileRoute('/_appbar/issues')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('issues.tracker', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const DEPARTMENTS = [
  'OPERATIONS',
  'INVENTORY',
  'STATION MANAGERS',
  'MARKETING',
  'PROCUREMENT',
]

const DEPT_COLORS: Record<string, string> = {
  OPERATIONS: 'bg-blue-100 text-blue-700',
  INVENTORY: 'bg-purple-100 text-purple-700',
  'STATION MANAGERS': 'bg-orange-100 text-orange-700',
  MARKETING: 'bg-rose-100 text-rose-700',
  PROCUREMENT: 'bg-teal-100 text-teal-700',
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; count: string }
> = {
  open: {
    label: 'Open',
    badge: 'bg-red-100 text-red-700',
    count: 'text-red-600',
  },
  'in-progress': {
    label: 'In Progress',
    badge: 'bg-blue-100 text-blue-700',
    count: 'text-blue-600',
  },
  'on-hold': {
    label: 'On Hold',
    badge: 'bg-amber-100 text-amber-700',
    count: 'text-amber-600',
  },
  resolved: {
    label: 'Resolved',
    badge: 'bg-green-100 text-green-700',
    count: 'text-green-600',
  },
}

const DEFAULT_FORM: IssueForm = {
  station: '',
  issue: '',
  comments: '',
  department: 'OPERATIONS',
  assignee: '',
  startDate: new Date().toISOString().split('T')[0],
  notes: '',
  status: 'open',
}

function RouteComponent() {
  const [locations, setLocations] = useState<Array<string>>([])
  const [issues, setIssues] = useState<Array<Issue>>([])
  const [loading, setLoading] = useState(false)
  const [filterStation, setFilterStation] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null)
  const [form, setForm] = useState<IssueForm>({ ...DEFAULT_FORM })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchIssues()
      setIssues(data)
    } catch {
      setIssues([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    apiFetch('https://app.gen7fuel.com/api/locations')
      .then((res) => res.json())
      .then((data: Array<{ stationName: string }>) =>
        setLocations(data.map((d) => d.stationName)),
      )
      .catch(() => setLocations([]))
  }, [])

  const filtered = useMemo(
    () =>
      issues.filter(
        (i) =>
          (!filterStation || i.station === filterStation) &&
          (!filterDept || i.department === filterDept) &&
          (!filterStatus || i.status === filterStatus),
      ),
    [issues, filterStation, filterDept, filterStatus],
  )

  const counts = useMemo(
    () => ({
      total: issues.length,
      open: issues.filter((i) => i.status === 'open').length,
      'in-progress': issues.filter((i) => i.status === 'in-progress').length,
      'on-hold': issues.filter((i) => i.status === 'on-hold').length,
      resolved: issues.filter((i) => i.status === 'resolved').length,
    }),
    [issues],
  )

  const openCreate = () => {
    setEditingIssue(null)
    setForm({ ...DEFAULT_FORM })
    setFormError('')
    setDialogOpen(true)
  }

  const openEdit = (issue: Issue) => {
    setEditingIssue(issue)
    setForm({
      station: issue.station,
      issue: issue.issue,
      comments: issue.comments,
      department: issue.department,
      assignee: issue.assignee,
      startDate: issue.startDate.split('T')[0],
      notes: issue.notes,
      status: issue.status,
    })
    setFormError('')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (
      !form.station.trim() ||
      !form.issue.trim() ||
      !form.department ||
      !form.startDate
    ) {
      setFormError('Station, issue, department, and start date are required.')
      return
    }
    setSaving(true)
    try {
      if (editingIssue) {
        const updated = await updateIssue(editingIssue._id, form)
        setIssues((prev) =>
          prev.map((i) => (i._id === editingIssue._id ? updated : i)),
        )
      } else {
        const created = await createIssue(form)
        setIssues((prev) => [created, ...prev])
      }
      setDialogOpen(false)
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (issue: Issue) => {
    if (
      !window.confirm(
        `Delete issue "${issue.issue}" for ${issue.station}? This cannot be undone.`,
      )
    )
      return
    try {
      await deleteIssue(issue._id)
      setIssues((prev) => prev.filter((i) => i._id !== issue._id))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const setField = <K extends keyof IssueForm>(key: K, value: IssueForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Open Issues Tracker</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage open issues across all stations.
          </p>
        </div>
        {can('issues.tracker', 'create') && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Issue
          </Button>
        )}
      </div>

      {/* Status stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <button
          onClick={() => setFilterStatus('')}
          className={cn(
            'rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
            !filterStatus && 'border-primary bg-primary/5',
          )}
        >
          <div className="text-2xl font-bold">{counts.total}</div>
          <div className="text-xs text-muted-foreground">All Issues</div>
        </button>
        {(
          [
            { key: 'open', label: 'Open' },
            { key: 'in-progress', label: 'In Progress' },
            { key: 'on-hold', label: 'On Hold' },
            { key: 'resolved', label: 'Resolved' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
              filterStatus === key && 'border-primary bg-primary/5',
            )}
          >
            <div className={cn('text-2xl font-bold', STATUS_CONFIG[key].count)}>
              {counts[key]}
            </div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStation}
          onChange={(e) => setFilterStation(e.target.value)}
          className="rounded border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All Stations</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="rounded border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'issue' : 'issues'}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Station</th>
                <th className="px-4 py-2 text-left font-medium">Issue</th>
                <th className="px-4 py-2 text-left font-medium">Comments</th>
                <th className="px-4 py-2 text-left font-medium">Department</th>
                <th className="px-4 py-2 text-left font-medium">Assignee</th>
                <th className="px-4 py-2 text-left font-medium">Start Date</th>
                <th className="px-4 py-2 text-left font-medium">Notes</th>
                <th className="px-4 py-2 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((issue) => {
                  const sc = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG.open
                  return (
                    <tr key={issue._id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 text-xs font-medium',
                            sc.badge,
                          )}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {issue.station}
                      </td>
                      <td className="px-4 py-3">{issue.issue}</td>
                      <td className="max-w-[180px] px-4 py-3">
                        <span
                          className="line-clamp-2 text-muted-foreground"
                          title={issue.comments}
                        >
                          {issue.comments || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 text-xs font-medium',
                            DEPT_COLORS[issue.department] ?? '',
                          )}
                        >
                          {issue.department}
                        </span>
                      </td>
                      <td className="px-4 py-3">{issue.assignee || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {new Date(issue.startDate).toLocaleDateString('en-CA', {
                          timeZone: 'UTC',
                        })}
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <span
                          className="line-clamp-2 text-muted-foreground"
                          title={issue.notes}
                        >
                          {issue.notes || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {can('issues.tracker', 'update') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(issue)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {can('issues.tracker', 'delete') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => void handleDelete(issue)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No issues found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingIssue ? 'Edit Issue' : 'New Issue'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Station *
              </label>
              <select
                className="rounded border bg-background px-2 py-1.5 text-sm"
                value={form.station}
                onChange={(e) => setField('station', e.target.value)}
              >
                <option value="">Select station…</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Issue *
              </label>
              <input
                className="rounded border bg-background px-2 py-1.5 text-sm"
                value={form.issue}
                onChange={(e) => setField('issue', e.target.value)}
                placeholder="Issue title"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Department *
              </label>
              <select
                className="rounded border bg-background px-2 py-1.5 text-sm"
                value={form.department}
                onChange={(e) => setField('department', e.target.value)}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assignee
              </label>
              <input
                className="rounded border bg-background px-2 py-1.5 text-sm"
                value={form.assignee}
                onChange={(e) => setField('assignee', e.target.value)}
                placeholder="e.g. Cal"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Start Date *
              </label>
              <input
                type="date"
                className="rounded border bg-background px-2 py-1.5 text-sm"
                value={form.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </label>
              <select
                className="rounded border bg-background px-2 py-1.5 text-sm"
                value={form.status}
                onChange={(e) =>
                  setField('status', e.target.value as IssueForm['status'])
                }
              >
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="on-hold">On Hold</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Comments
              </label>
              <textarea
                className="min-h-[80px] resize-y rounded border bg-background px-2 py-1.5 text-sm"
                value={form.comments}
                onChange={(e) => setField('comments', e.target.value)}
                placeholder="Describe the issue…"
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notes
              </label>
              <textarea
                className="min-h-[80px] resize-y rounded border bg-background px-2 py-1.5 text-sm"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Additional notes and updates…"
              />
            </div>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? 'Saving…'
                : editingIssue
                  ? 'Save Changes'
                  : 'Create Issue'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
