import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { FolderKanban, Plus, Trash2 } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

const STATUS_VARIANTS: Record<
  ProjectStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  active: 'default',
  planning: 'secondary',
  'on-hold': 'outline',
  completed: 'secondary',
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
        <Button>
          <Plus className="mr-2 h-4 w-4" />
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

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Projects</h1>
        </div>
        {can('projects', 'create') && (
          <NewProjectDialog
            onCreated={() =>
              queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
            }
          />
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-muted-foreground">
          No projects yet. Create one to get started.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project._id}>
                <TableCell className="font-medium">
                  <Link
                    to="/projects/$id"
                    params={{ id: project._id }}
                    className="hover:underline"
                  >
                    {project.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.site ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[project.status]}>
                    {STATUS_LABELS[project.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(project.startDate), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  {can('projects', 'delete') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete "${project.name}"?`)) {
                          deleteMutation.mutate(project._id)
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
      )}
    </div>
  )
}
