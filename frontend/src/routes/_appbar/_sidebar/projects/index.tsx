import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderKanban,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ProjectStatus } from '@/lib/projects-api'
import { can } from '@/lib/permissions'
import {
  createProject,
  deleteProject,
  getProjectTemplates,
  getProjects,
  projectKeys,
} from '@/lib/projects-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export const Route = createFileRoute('/_appbar/_sidebar/projects/')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('projects', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  'on-hold': 'On Hold',
  completed: 'Completed',
}

const STATUS_COLORS: Record<
  ProjectStatus,
  { dot: string; badge: string; border: string }
> = {
  active: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    border: 'border-t-emerald-500',
  },
  planning: {
    dot: 'bg-primary',
    badge: 'bg-primary/15 text-primary border-primary/20',
    border: 'border-t-primary',
  },
  'on-hold': {
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    border: 'border-t-amber-500',
  },
  completed: {
    dot: 'bg-muted-foreground',
    badge: 'bg-muted text-muted-foreground border-border',
    border: 'border-t-muted-foreground',
  },
}

// ── Stats card ─────────────────────────────────────────────────────────────────

function StatsCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={`rounded-lg p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── New Project Dialog ─────────────────────────────────────────────────────────

interface NewProjectDialogProps {
  onCreated: () => void
}

function NewProjectDialog({ onCreated }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [site, setSite] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [templateId, setTemplateId] = useState<string>('')

  const { data: templates = [] } = useQuery({
    queryKey: projectKeys.templates(),
    queryFn: getProjectTemplates,
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createProject({
        name,
        description: description || undefined,
        site: site || undefined,
        status,
        startDate,
        templateId: templateId || undefined,
      }),
    onSuccess: () => {
      toast.success('Project created')
      setOpen(false)
      resetForm()
      onCreated()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function resetForm() {
    setName('')
    setDescription('')
    setSite('')
    setStatus('planning')
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setTemplateId('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Name</Label>
            <Input
              id="proj-name"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select
                value={templateId}
                onValueChange={(v) => setTemplateId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="proj-site">Site</Label>
            <Input
              id="proj-site"
              placeholder="e.g. Station 01"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ProjectStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as Array<ProjectStatus>).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-start">Start Date</Label>
              <Input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea
              id="proj-desc"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Project card ───────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onDelete,
}: {
  project: {
    _id: string
    name: string
    site?: string
    status: ProjectStatus
    startDate: string
    createdBy: { firstName: string; lastName: string }
  }
  onDelete: (id: string) => void
}) {
  const colors = STATUS_COLORS[project.status]

  return (
    <div
      className={`group relative rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 border-t-2 ${colors.border}`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <Link
              to="/projects/$id"
              params={{ id: project._id }}
              className="font-semibold text-sm leading-snug hover:text-primary transition-colors line-clamp-2"
            >
              {project.name}
            </Link>
            {project.site && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {project.site}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${colors.badge}`}
          >
            {STATUS_LABELS[project.status]}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(project.startDate), 'MMM d, yyyy')}
          </span>
          <span className="flex items-center gap-1">
            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-semibold uppercase">
              {project.createdBy.firstName[0]}
              {project.createdBy.lastName[0]}
            </div>
            {project.createdBy.firstName}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 px-5 py-2.5 bg-muted/30">
        <Link
          to="/projects/$id"
          params={{ id: project._id }}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          View project
          <ChevronRight className="h-3 w-3" />
        </Link>
        {can('projects', 'delete') && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive-foreground hover:bg-destructive/20"
            onClick={() => {
              if (confirm(`Delete "${project.name}"?`)) {
                onDelete(project._id)
              }
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Route component ────────────────────────────────────────────────────────────

function RouteComponent() {
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: projectKeys.lists(),
    queryFn: getProjects,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      toast.success('Project deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const active = projects.filter((p) => p.status === 'active').length
  const completed = projects.filter((p) => p.status === 'completed').length
  const planning = projects.filter((p) => p.status === 'planning').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <FolderKanban className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Projects</h1>
            <p className="text-xs text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>
        {can('projects', 'create') && (
          <NewProjectDialog
            onCreated={() =>
              queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
            }
          />
        )}
      </div>

      {/* Stats row */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatsCard
            icon={Activity}
            label="Total Projects"
            value={projects.length}
            color="bg-primary/10 text-primary"
          />
          <StatsCard
            icon={Activity}
            label="Active"
            value={active}
            color="bg-emerald-500/10 text-emerald-500"
          />
          <StatsCard
            icon={Clock}
            label="Planning"
            value={planning}
            color="bg-primary/10 text-primary"
          />
          <StatsCard
            icon={CheckCircle2}
            label="Completed"
            value={completed}
            color="bg-muted text-muted-foreground"
          />
        </div>
      )}

      {/* Projects grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 gap-3">
          <div className="rounded-xl bg-primary/10 p-4">
            <FolderKanban className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground">
              Create a project to start tracking work.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
