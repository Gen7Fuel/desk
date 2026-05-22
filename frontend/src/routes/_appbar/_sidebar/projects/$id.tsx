import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gantt, ViewMode, type Task as GanttTask } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'
import { format } from 'date-fns'
import {
  ArrowLeft,
  LayoutList,
  GanttChartSquare,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { can } from '@/lib/permissions'
import {
  createProjectTask,
  deleteProjectTask,
  getProject,
  getProjectTasks,
  getProjectUsers,
  projectKeys,
  updateProjectTask,
  type ProjectTask,
  type ProjectUser,
  type TaskStatus,
} from '@/lib/projects-api'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_appbar/_sidebar/projects/$id')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('projects', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

type ViewTab = 'gantt' | 'table'

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
}

const TASK_STATUS_VARIANTS: Record<
  TaskStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  'not-started': 'secondary',
  'in-progress': 'default',
  completed: 'outline',
  blocked: 'destructive',
}

// ── Blank task form state ──────────────────────────────────────────────────────

function blankTask() {
  const today = format(new Date(), 'yyyy-MM-dd')
  return {
    name: '',
    notes: '',
    assignee: '',
    status: 'not-started' as TaskStatus,
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
          progress: editTask.progress,
          startDate: editTask.startDate.slice(0, 10),
          endDate: editTask.endDate.slice(0, 10),
        }
      : blankTask(),
  )

  // Reset form when editTask changes
  const setField = <K extends keyof typeof form>(
    key: K,
    val: (typeof form)[K],
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
      queryClient.invalidateQueries({
        queryKey: projectKeys.tasks(projectId),
      })
      toast.success(isEdit ? 'Task updated' : 'Task created')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
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

// ── Gantt view ─────────────────────────────────────────────────────────────────

interface GanttViewProps {
  projectId: string
  tasks: Array<ProjectTask>
}

function GanttView({ projectId, tasks }: GanttViewProps) {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week)

  const updateMutation = useMutation({
    mutationFn: ({
      taskId,
      startDate,
      endDate,
    }: {
      taskId: string
      startDate: string
      endDate: string
    }) => updateProjectTask(projectId, taskId, { startDate, endDate }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) }),
    onError: () => toast.error('Failed to update task dates'),
  })

  const ganttTasks: Array<GanttTask> = tasks.map((t) => ({
    id: t._id,
    name: t.name,
    type: 'task',
    start: new Date(t.startDate),
    end: new Date(t.endDate),
    progress: t.progress,
    dependencies: t.dependencies ?? [],
  }))

  if (ganttTasks.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground">
        No tasks yet — add a task to see the Gantt chart.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {([ViewMode.Day, ViewMode.Week, ViewMode.Month] as const).map((m) => (
          <Button
            key={m}
            variant={viewMode === m ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode(m)}
          >
            {m}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          ganttHeight={400}
          onDateChange={(task) => {
            updateMutation.mutate({
              taskId: task.id,
              startDate: task.start.toISOString(),
              endDate: task.end.toISOString(),
            })
          }}
        />
      </div>
    </div>
  )
}

// ── Tasks table view ───────────────────────────────────────────────────────────

interface TasksTableProps {
  projectId: string
  tasks: Array<ProjectTask>
  users: Array<ProjectUser>
}

function TasksTable({ projectId, tasks, users }: TasksTableProps) {
  const queryClient = useQueryClient()
  const [editTask, setEditTask] = useState<ProjectTask | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

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

  if (tasks.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground">
        No tasks yet — click "Add Task" to get started.
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task._id}>
              <TableCell
                className="cursor-pointer font-medium hover:underline"
                onClick={() => {
                  setEditTask(task)
                  setDialogOpen(true)
                }}
              >
                {task.name}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {task.assignee
                  ? `${task.assignee.firstName} ${task.assignee.lastName}`
                  : '—'}
              </TableCell>
              <TableCell>
                <Select
                  value={task.status}
                  onValueChange={(v) =>
                    updateStatusMutation.mutate({
                      taskId: task._id,
                      status: v as TaskStatus,
                    })
                  }
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue>
                      <Badge variant={TASK_STATUS_VARIANTS[task.status]}>
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                    </SelectValue>
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
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {task.progress}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(task.startDate), 'MMM d')}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(task.endDate), 'MMM d')}
              </TableCell>
              <TableCell>
                {can('projects', 'delete') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Delete "${task.name}"?`)) {
                        deleteMutation.mutate(task._id)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TaskDialog
        projectId={projectId}
        editTask={editTask}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditTask(null)
        }}
        users={users}
      />
    </>
  )
}

// ── Route component ────────────────────────────────────────────────────────────

function RouteComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ViewTab>('gantt')
  const [addOpen, setAddOpen] = useState(false)

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: '/projects' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">
            {projectLoading ? 'Loading…' : (project?.name ?? 'Project')}
          </h1>
          {project?.site && (
            <p className="text-xs text-muted-foreground">{project.site}</p>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant={activeTab === 'gantt' ? 'default' : 'ghost'}
            size="sm"
            className="h-7"
            onClick={() => setActiveTab('gantt')}
          >
            <GanttChartSquare className="mr-1.5 h-3.5 w-3.5" />
            Gantt
          </Button>
          <Button
            variant={activeTab === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="h-7"
            onClick={() => setActiveTab('table')}
          >
            <LayoutList className="mr-1.5 h-3.5 w-3.5" />
            Tasks
          </Button>
        </div>
        {can('projects', 'create') && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Task
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : activeTab === 'gantt' ? (
          <GanttView projectId={id} tasks={tasks} />
        ) : (
          <TasksTable projectId={id} tasks={tasks} users={users} />
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
    </div>
  )
}
