import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDays,
  differenceInDays,
  format,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  Filter,
  GanttChartSquare,
  LayoutList,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  ProjectTask,
  ProjectUser,
  TaskPhase,
  TaskPriority,
  TaskStatus,
} from '@/lib/projects-api'
import { can } from '@/lib/permissions'
import {
  createProjectTask,
  deleteProjectTask,
  getProject,
  getProjectTasks,
  getProjectUsers,
  projectKeys,
  updateProjectTask,
} from '@/lib/projects-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/_appbar/_sidebar/projects/$id')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('projects', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

// ── Constants ──────────────────────────────────────────────────────────────────

type ViewTab = 'gantt' | 'list'
type GanttZoom = 'Week' | 'Month' | 'Quarter'

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
}

const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  'not-started': 'bg-muted text-muted-foreground border-border',
  'in-progress': 'bg-primary/15 text-primary border-primary/25',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  blocked:
    'bg-destructive/15 text-destructive-foreground border-destructive/25',
}

const PHASE_LABELS: Record<TaskPhase, string> = {
  planning: 'Planning',
  design: 'Design',
  development: 'Dev',
  qa: 'QA',
  launch: 'Launch',
}

const PHASE_COLORS: Record<TaskPhase, { bar: string; badge: string }> = {
  planning: {
    bar: 'oklch(0.61 0.25 292)',
    badge: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  },
  design: {
    bar: 'oklch(0.71 0.15 205)',
    badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  },
  development: {
    bar: 'oklch(0.58 0.22 270)',
    badge: 'bg-primary/15 text-primary border-primary/25',
  },
  qa: {
    bar: 'oklch(0.77 0.17 65)',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  },
  launch: {
    bar: 'oklch(0.70 0.17 162)',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  },
}

const PRIORITY_ICONS: Record<TaskPriority, React.ReactNode> = {
  high: <ArrowUp className="h-3 w-3 text-red-400" />,
  medium: <Minus className="h-3 w-3 text-amber-400" />,
  low: <ChevronDown className="h-3 w-3 text-muted-foreground" />,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(user: { firstName: string; lastName: string }) {
  return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
}

function Avatar({ user }: { user: { firstName: string; lastName: string } }) {
  return (
    <div className="h-6 w-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
      {initials(user)}
    </div>
  )
}

// ── Blank form ─────────────────────────────────────────────────────────────────

function blankTask() {
  const today = format(new Date(), 'yyyy-MM-dd')
  return {
    name: '',
    notes: '',
    assignee: '',
    status: 'not-started' as TaskStatus,
    phase: 'planning' as TaskPhase,
    priority: 'medium' as TaskPriority,
    progress: 0,
    startDate: today,
    endDate: today,
  }
}

// ── Add / Edit Task Dialog ─────────────────────────────────────────────────────

interface TaskDialogProps {
  projectId: string
  editTask: ProjectTask | null
  open: boolean
  onClose: () => void
  users: Array<ProjectUser>
}

function TaskDialog({
  projectId,
  editTask,
  open,
  onClose,
  users,
}: TaskDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = editTask !== null

  const [form, setForm] = useState(() =>
    editTask
      ? {
          name: editTask.name,
          notes: editTask.notes ?? '',
          assignee: editTask.assignee?._id ?? '',
          status: editTask.status,
          phase: editTask.phase ?? ('planning'),
          priority: editTask.priority ?? ('medium'),
          progress: editTask.progress,
          startDate: editTask.startDate.slice(0, 10),
          endDate: editTask.endDate.slice(0, 10),
        }
      : blankTask(),
  )

  useEffect(() => {
    setForm(
      editTask
        ? {
            name: editTask.name,
            notes: editTask.notes ?? '',
            assignee: editTask.assignee?._id ?? '',
            status: editTask.status,
            phase: editTask.phase ?? 'planning',
            priority: editTask.priority ?? 'medium',
            progress: editTask.progress,
            startDate: editTask.startDate.slice(0, 10),
            endDate: editTask.endDate.slice(0, 10),
          }
        : blankTask(),
    )
  }, [editTask])

  const setField = <TKey extends keyof typeof form>(
    key: TKey,
    val: (typeof form)[TKey],
  ) => setForm((prev) => ({ ...prev, [key]: val }))

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateProjectTask(projectId, editTask._id, {
            ...form,
            assignee: form.assignee || undefined,
            notes: form.notes || undefined,
          })
        : createProjectTask(projectId, {
            ...form,
            assignee: form.assignee || undefined,
            notes: form.notes || undefined,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) })
      toast.success(isEdit ? 'Task updated' : 'Task created')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Task name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Phase</Label>
              <Select
                value={form.phase}
                onValueChange={(v) => setField('phase', v as TaskPhase)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PHASE_LABELS) as Array<TaskPhase>).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PHASE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setField('priority', v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setField('endDate', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setField('status', v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TASK_STATUS_LABELS) as Array<TaskStatus>).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Progress ({form.progress}%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) =>
                  setField(
                    'progress',
                    Math.min(100, Math.max(0, Number(e.target.value))),
                  )
                }
              />
            </div>
          </div>
          {users.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select
                value={form.assignee || 'unassigned'}
                onValueChange={(v) =>
                  setField('assignee', v === 'unassigned' ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Add notes…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!form.name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Task Detail Drawer ─────────────────────────────────────────────────────────

interface TaskDrawerProps {
  task: ProjectTask | null
  projectId: string
  onClose: () => void
  onEdit: (task: ProjectTask) => void
}

function TaskDrawer({ task, projectId, onClose, onEdit }: TaskDrawerProps) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    setNotes(task?.notes ?? '')
  }, [task?._id])

  const updateStatusMutation = useMutation({
    mutationFn: (status: TaskStatus) =>
      updateProjectTask(projectId, task!._id, { status }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) }),
    onError: () => toast.error('Failed to update status'),
  })

  async function saveNotes() {
    if (!task) return
    setSavingNotes(true)
    try {
      await updateProjectTask(projectId, task._id, { notes })
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) })
      toast.success('Notes saved')
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const duration = task
    ? differenceInDays(parseISO(task.endDate), parseISO(task.startDate)) + 1
    : 0

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${task ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[420px] z-50 bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-out ${task ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {task && (
          <>
            {/* Drawer header */}
            <div className="flex items-start justify-between p-5 border-b border-border gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
                  Task
                </p>
                <h2 className="font-semibold text-base leading-snug">
                  {task.name}
                </h2>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onEdit(task)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Badges row */}
              <div className="flex flex-wrap gap-2">
                <span
                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${TASK_STATUS_STYLE[task.status]}`}
                >
                  {TASK_STATUS_LABELS[task.status]}
                </span>
                <span
                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${PHASE_COLORS[task.phase ?? 'planning'].badge}`}
                >
                  {PHASE_LABELS[task.phase ?? 'planning']}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                  {PRIORITY_ICONS[task.priority ?? 'medium']}
                  {(task.priority ?? 'medium').charAt(0).toUpperCase() +
                    (task.priority ?? 'medium').slice(1)}{' '}
                  priority
                </span>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    Start
                  </p>
                  <p className="text-sm font-mono font-medium">
                    {format(parseISO(task.startDate), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    End
                  </p>
                  <p className="text-sm font-mono font-medium">
                    {format(parseISO(task.endDate), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    Duration
                  </p>
                  <p className="text-sm font-mono font-medium">
                    {duration} day{duration !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    Assignee
                  </p>
                  {task.assignee ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar user={task.assignee} />
                      <p className="text-sm font-medium truncate">
                        {task.assignee.firstName}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Progress
                  </p>
                  <p className="text-sm font-mono font-bold text-primary">
                    {task.progress}%
                  </p>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>

              {/* Status change */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Update Status
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TASK_STATUS_LABELS) as Array<TaskStatus>).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => updateStatusMutation.mutate(s)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                          task.status === s
                            ? TASK_STATUS_STYLE[s] + ' ring-1 ring-current'
                            : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                        }`}
                      >
                        {TASK_STATUS_LABELS[s]}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Notes
                </p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this task…"
                  rows={4}
                  className="resize-none text-sm"
                />
                {notes !== (task.notes ?? '') && (
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={saveNotes}
                    disabled={savingNotes}
                  >
                    {savingNotes ? 'Saving…' : 'Save Notes'}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Custom Gantt Chart ─────────────────────────────────────────────────────────

const ZOOM_DAY_WIDTH: Record<GanttZoom, number> = {
  Week: 38,
  Month: 16,
  Quarter: 8,
}

const ROW_H = 44
const HEADER_H = 52
const LEFT_W = 220

interface GanttViewProps {
  tasks: Array<ProjectTask>
  onTaskClick: (task: ProjectTask) => void
}

function GanttView({ tasks, onTaskClick }: GanttViewProps) {
  const [zoom, setZoom] = useState<GanttZoom>('Month')
  const [tooltip, setTooltip] = useState<{
    task: ProjectTask
    x: number
    y: number
  } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  if (tasks.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground text-sm">
        No tasks yet — add a task to see the Gantt chart.
      </div>
    )
  }

  const today = startOfDay(new Date())
  const allStarts = tasks.map((t) => startOfDay(parseISO(t.startDate)))
  const allEnds = tasks.map((t) => startOfDay(parseISO(t.endDate)))
  const minDate = subDays(
    allStarts.reduce((a, b) => (a < b ? a : b)),
    3,
  )
  const maxDate = addDays(
    allEnds.reduce((a, b) => (a > b ? a : b)),
    5,
  )
  const totalDays = differenceInDays(maxDate, minDate) + 1
  const dayW = ZOOM_DAY_WIDTH[zoom]
  const totalW = totalDays * dayW

  const todayOffset = differenceInDays(today, minDate) * dayW
  const todayInRange = todayOffset >= 0 && todayOffset <= totalW

  // Scroll today into view on mount / zoom change
  useEffect(() => {
    if (scrollRef.current && todayInRange) {
      const scrollTo = Math.max(
        0,
        todayOffset + LEFT_W - scrollRef.current.clientWidth / 2,
      )
      scrollRef.current.scrollLeft = scrollTo
    }
  }, [zoom])

  // Build month header segments
  const months: Array<{ label: string; startDay: number; days: number }> = []
  let cur = new Date(minDate)
  while (cur <= maxDate) {
    const monthStart = differenceInDays(cur, minDate)
    const y = cur.getFullYear()
    const m = cur.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const dayOfMonth = cur.getDate()
    const remaining = daysInMonth - dayOfMonth + 1
    const days = Math.min(remaining, totalDays - monthStart)
    months.push({
      label: format(cur, zoom === 'Quarter' ? 'MMM yyyy' : 'MMM yyyy'),
      startDay: monthStart,
      days,
    })
    cur = new Date(y, m + 1, 1)
  }

  return (
    <div className="space-y-3">
      {/* Zoom controls */}
      <div className="flex items-center gap-1.5">
        {(['Week', 'Month', 'Quarter'] as Array<GanttZoom>).map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`text-xs font-medium px-3 py-1 rounded-md border transition-all cursor-pointer ${
              zoom === z
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30'
                : 'bg-muted text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {z}
          </button>
        ))}
      </div>

      {/* Gantt container */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex">
          {/* Fixed left panel */}
          <div
            className="flex-shrink-0 border-r border-border bg-card"
            style={{ width: LEFT_W }}
          >
            {/* Left header */}
            <div
              className="flex items-center px-3 border-b border-border bg-muted/30"
              style={{ height: HEADER_H }}
            >
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Task
              </span>
            </div>
            {/* Task name rows */}
            {tasks.map((task) => (
              <div
                key={task._id}
                className="flex items-center gap-2 px-3 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                style={{ height: ROW_H }}
                onClick={() => onTaskClick(task)}
              >
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{
                    background: PHASE_COLORS[task.phase ?? 'planning'].bar,
                  }}
                />
                <span className="text-xs font-medium truncate">
                  {task.name}
                </span>
              </div>
            ))}
          </div>

          {/* Scrollable timeline */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto relative"
            style={{ minWidth: 0 }}
          >
            <div style={{ width: totalW, position: 'relative' }}>
              {/* Month header */}
              <div
                className="flex border-b border-border bg-muted/30 relative"
                style={{ height: HEADER_H }}
              >
                {months.map((seg, i) => (
                  <div
                    key={i}
                    className="absolute flex items-center justify-center border-r border-border/40"
                    style={{
                      left: seg.startDay * dayW,
                      width: seg.days * dayW,
                      height: HEADER_H,
                    }}
                  >
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {seg.label}
                    </span>
                  </div>
                ))}
                {/* Week ticks (only for Week/Month zoom) */}
                {zoom !== 'Quarter' &&
                  Array.from({ length: totalDays }).map((_, i) => {
                    const d = addDays(minDate, i)
                    const isMonday = d.getDay() === 1
                    if (!isMonday) return null
                    return (
                      <div
                        key={i}
                        className="absolute bottom-0 flex items-end pb-1"
                        style={{ left: i * dayW + 2 }}
                      >
                        <span className="text-[9px] font-mono text-muted-foreground/60">
                          {format(d, 'd')}
                        </span>
                      </div>
                    )
                  })}
              </div>

              {/* Task rows */}
              <div className="relative">
                {/* Grid lines */}
                {months.map((seg, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-r border-border/20"
                    style={{ left: seg.startDay * dayW + seg.days * dayW }}
                  />
                ))}

                {/* Today line */}
                {todayInRange && (
                  <div
                    className="gantt-today-line absolute top-0 bottom-0 w-[2px] z-10"
                    style={{
                      left: todayOffset,
                      background: 'oklch(0.58 0.22 270)',
                      boxShadow: '0 0 8px oklch(0.58 0.22 270 / 0.6)',
                    }}
                  />
                )}

                {/* Task bars */}
                {tasks.map((task) => {
                  const taskStart = startOfDay(parseISO(task.startDate))
                  const taskEnd = startOfDay(parseISO(task.endDate))
                  const barLeft = differenceInDays(taskStart, minDate) * dayW
                  const barWidth = Math.max(
                    (differenceInDays(taskEnd, taskStart) + 1) * dayW - 2,
                    dayW,
                  )
                  const phaseColor = PHASE_COLORS[task.phase ?? 'planning'].bar

                  return (
                    <div
                      key={task._id}
                      className="relative border-b border-border/50 flex items-center"
                      style={{ height: ROW_H }}
                    >
                      {/* Alternating row bg */}
                      <div className="absolute inset-0 hover:bg-primary/[0.03] transition-colors" />
                      {/* Bar */}
                      <div
                        className="absolute rounded-md cursor-pointer transition-all hover:brightness-110 hover:scale-y-105"
                        style={{
                          left: barLeft + 1,
                          width: barWidth,
                          height: 24,
                          top: (ROW_H - 24) / 2,
                          background: `linear-gradient(135deg, ${phaseColor}, ${phaseColor}cc)`,
                          boxShadow: `0 2px 6px ${phaseColor}55`,
                        }}
                        onMouseEnter={(e) =>
                          setTooltip({
                            task,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => onTaskClick(task)}
                      >
                        {/* Progress overlay */}
                        <div
                          className="absolute left-0 top-0 bottom-0 rounded-md opacity-30"
                          style={{
                            width: `${task.progress}%`,
                            background: 'white',
                          }}
                        />
                        {/* Bar label */}
                        {barWidth > 60 && (
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-white/90 truncate">
                            {task.name}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover shadow-xl p-3 text-xs space-y-1"
          style={{ left: tooltip.x + 12, top: tooltip.y - 80 }}
        >
          <p className="font-semibold text-sm">{tooltip.task.name}</p>
          <p className="text-muted-foreground">
            {format(parseISO(tooltip.task.startDate), 'MMM d')} →{' '}
            {format(parseISO(tooltip.task.endDate), 'MMM d, yyyy')}
          </p>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${PHASE_COLORS[tooltip.task.phase ?? 'planning'].badge}`}
            >
              {PHASE_LABELS[tooltip.task.phase ?? 'planning']}
            </span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${TASK_STATUS_STYLE[tooltip.task.status]}`}
            >
              {TASK_STATUS_LABELS[tooltip.task.status]}
            </span>
          </div>
          {tooltip.task.assignee && (
            <p className="text-muted-foreground">
              {tooltip.task.assignee.firstName} {tooltip.task.assignee.lastName}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${tooltip.task.progress}%` }}
              />
            </div>
            <span className="text-muted-foreground">
              {tooltip.task.progress}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tasks List View ────────────────────────────────────────────────────────────

interface TasksListViewProps {
  projectId: string
  tasks: Array<ProjectTask>
  users: Array<ProjectUser>
  onTaskClick: (task: ProjectTask) => void
  onEditTask: (task: ProjectTask) => void
}

function TasksListView({
  projectId,
  tasks,
  users,
  onTaskClick,
  onEditTask,
}: TasksListViewProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterPhase, setFilterPhase] = useState<TaskPhase | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteProjectTask(projectId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) })
      toast.success('Task deleted')
    },
    onError: () => toast.error('Failed to delete task'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateProjectTask(projectId, taskId, { status }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) }),
    onError: () => toast.error('Failed to update status'),
  })

  const filtered = tasks.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()))
      return false
    if (filterPhase !== 'all' && (t.phase ?? 'planning') !== filterPhase)
      return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterAssignee !== 'all' && t.assignee?._id !== filterAssignee)
      return false
    return true
  })

  if (tasks.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground text-sm">
        No tasks yet — click "Add Task" to get started.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select
          value={filterPhase}
          onValueChange={(v) => setFilterPhase(v as TaskPhase | 'all')}
        >
          <SelectTrigger className="h-8 w-32 text-xs gap-1">
            <Filter className="h-3 w-3" />
            <SelectValue placeholder="Phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            {(Object.keys(PHASE_LABELS) as Array<TaskPhase>).map((p) => (
              <SelectItem key={p} value={p}>
                {PHASE_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as TaskStatus | 'all')}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(TASK_STATUS_LABELS) as Array<TaskStatus>).map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {users.length > 0 && (
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="h-8 w-36 text-xs gap-1">
              <User className="h-3 w-3" />
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {users.map((u) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(search ||
          filterPhase !== 'all' ||
          filterStatus !== 'all' ||
          filterAssignee !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setSearch('')
              setFilterPhase('all')
              setFilterStatus('all')
              setFilterAssignee('all')
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Task
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
                Phase
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">
                Assignee
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">
                Status
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">
                Progress
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-mono text-muted-foreground uppercase tracking-wider w-24">
                Start
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-mono text-muted-foreground uppercase tracking-wider w-24">
                End
              </th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground text-xs"
                >
                  No tasks match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((task, i) => (
                <tr
                  key={task._id}
                  className={`border-b border-border/50 hover:bg-muted/20 transition-colors group ${
                    i === filtered.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <button
                      className="flex items-center gap-2 text-left hover:text-primary transition-colors"
                      onClick={() => onTaskClick(task)}
                    >
                      {PRIORITY_ICONS[task.priority ?? 'medium']}
                      <span className="font-medium text-sm">{task.name}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${PHASE_COLORS[task.phase ?? 'planning'].badge}`}
                    >
                      {PHASE_LABELS[task.phase ?? 'planning']}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar user={task.assignee} />
                        <span className="text-xs">
                          {task.assignee.firstName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={task.status}
                      onValueChange={(v) =>
                        updateStatusMutation.mutate({
                          taskId: task._id,
                          status: v as TaskStatus,
                        })
                      }
                    >
                      <SelectTrigger className="h-6 w-32 border-0 bg-transparent p-0 text-[11px] shadow-none focus:ring-0">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${TASK_STATUS_STYLE[task.status]}`}
                        >
                          {TASK_STATUS_LABELS[task.status]}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TASK_STATUS_LABELS) as Array<TaskStatus>).map(
                          (s) => (
                            <SelectItem key={s} value={s}>
                              {TASK_STATUS_LABELS[s]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {task.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {format(parseISO(task.startDate), 'MMM d')}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {format(parseISO(task.endDate), 'MMM d')}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {can('projects', 'create') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onEditTask(task)}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                    {can('projects', 'delete') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          if (confirm(`Delete "${task.name}"?`)) {
                            deleteMutation.mutate(task._id)
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length < tasks.length && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filtered.length} of {tasks.length} tasks
        </p>
      )}
    </div>
  )
}

// ── Route component ────────────────────────────────────────────────────────────

function RouteComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ViewTab>('gantt')
  const [addOpen, setAddOpen] = useState(false)
  const [editTask, setEditTask] = useState<ProjectTask | null>(null)
  const [drawerTask, setDrawerTask] = useState<ProjectTask | null>(null)

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => getProject(id),
  })

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: projectKeys.tasks(id),
    queryFn: () => getProjectTasks(id),
  })

  const { data: users = [] } = useQuery({
    queryKey: projectKeys.users(),
    queryFn: getProjectUsers,
  })

  const isLoading = projectLoading || tasksLoading

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const inProgressCount = tasks.filter((t) => t.status === 'in-progress').length
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length
  const overallProgress =
    tasks.length > 0
      ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length)
      : 0

  function handleTaskClick(task: ProjectTask) {
    setDrawerTask(task)
  }

  function handleEditTask(task: ProjectTask) {
    setDrawerTask(null)
    setEditTask(task)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3 bg-card/50 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate({ to: '/projects' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold leading-none">
            {projectLoading ? '…' : (project?.name ?? 'Project')}
          </h1>
          {project?.site && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {project.site}
            </p>
          )}
        </div>

        {/* Stats pills */}
        {tasks.length > 0 && (
          <div className="hidden md:flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono">
                {completedCount}/{tasks.length}
              </span>
              <span className="text-muted-foreground">done</span>
            </div>
            {inProgressCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="font-mono text-primary">
                  {inProgressCount}
                </span>
                <span className="text-muted-foreground">active</span>
              </div>
            )}
            {blockedCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1">
                <AlertTriangle className="h-3 w-3 text-destructive-foreground" />
                <span className="font-mono text-destructive-foreground">
                  {blockedCount}
                </span>
                <span className="text-muted-foreground">blocked</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
              <span className="font-mono font-bold text-primary">
                {overallProgress}%
              </span>
            </div>
          </div>
        )}

        {/* View switcher */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-muted/50">
          <button
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'gantt'
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('gantt')}
          >
            <GanttChartSquare className="h-3.5 w-3.5" />
            Gantt
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('list')}
          >
            <LayoutList className="h-3.5 w-3.5" />
            List
          </button>
        </div>

        {can('projects', 'create') && (
          <Button
            size="sm"
            className="gap-1.5 shadow-sm shadow-primary/20"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        )}
      </div>

      {/* Overall progress bar */}
      {tasks.length > 0 && (
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : activeTab === 'gantt' ? (
          <GanttView tasks={tasks} onTaskClick={handleTaskClick} />
        ) : (
          <TasksListView
            projectId={id}
            tasks={tasks}
            users={users}
            onTaskClick={handleTaskClick}
            onEditTask={handleEditTask}
          />
        )}
      </div>

      {/* Add task dialog */}
      <TaskDialog
        projectId={id}
        editTask={null}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        users={users}
      />

      {/* Edit task dialog */}
      <TaskDialog
        projectId={id}
        editTask={editTask}
        open={editTask !== null}
        onClose={() => setEditTask(null)}
        users={users}
      />

      {/* Task detail drawer */}
      <TaskDrawer
        task={drawerTask}
        projectId={id}
        onClose={() => setDrawerTask(null)}
        onEdit={handleEditTask}
      />
    </div>
  )
}
