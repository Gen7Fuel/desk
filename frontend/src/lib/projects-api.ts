import { apiFetch } from './api'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed'
export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked'
export type TaskPhase = 'planning' | 'design' | 'development' | 'qa' | 'launch'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface ProjectTask {
  _id: string
  projectId: string
  name: string
  notes?: string
  assignee?: { _id: string; firstName: string; lastName: string } | null
  status: TaskStatus
  phase?: TaskPhase
  priority?: TaskPriority
  progress: number
  startDate: string
  endDate: string
  dependencies?: Array<string>
  order: number
  createdAt: string
  updatedAt: string
}

export interface Project {
  _id: string
  name: string
  description?: string
  site?: string
  status: ProjectStatus
  startDate: string
  createdBy?: { _id: string; firstName: string; lastName: string } | null
  createdAt: string
  updatedAt: string
}

export interface ProjectTemplate {
  _id: string
  name: string
  description?: string
  tasks?: Array<{
    name: string
    durationDays: number
    order: number
    dependsOnPrevious: boolean
  }>
}

export interface ProjectUser {
  _id: string
  firstName: string
  lastName: string
  email: string
}

// ── Query key factory ──────────────────────────────────────────────────────────

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
  tasks: (projectId: string) =>
    [...projectKeys.all, 'tasks', projectId] as const,
  templates: () => [...projectKeys.all, 'templates'] as const,
  users: () => [...projectKeys.all, 'users'] as const,
}

// ── Projects CRUD ──────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Array<Project>> {
  const res = await apiFetch('/api/projects')
  if (!res.ok) throw new Error('Failed to fetch projects')
  const data = await res.json()
  return data.projects
}

export async function getProject(id: string): Promise<Project> {
  const res = await apiFetch(`/api/projects/${id}`)
  if (!res.ok) throw new Error('Failed to fetch project')
  const data = await res.json()
  return data.project
}

export async function createProject(data: {
  name: string
  description?: string
  site?: string
  status: ProjectStatus
  startDate: string
  templateId?: string
}): Promise<Project> {
  const res = await apiFetch('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to create project',
    )
  }
  const result = await res.json()
  return result.project
}

export async function updateProject(
  id: string,
  data: Partial<{
    name: string
    description: string
    site: string
    status: ProjectStatus
    startDate: string
  }>,
): Promise<Project> {
  const res = await apiFetch(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to update project',
    )
  }
  const result = await res.json()
  return result.project
}

export async function deleteProject(id: string): Promise<void> {
  const res = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to delete project',
    )
  }
}

// ── Tasks CRUD ─────────────────────────────────────────────────────────────────

export async function getProjectTasks(
  projectId: string,
): Promise<Array<ProjectTask>> {
  const res = await apiFetch(`/api/projects/${projectId}/tasks`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
  const data = await res.json()
  return data.tasks
}

export async function createProjectTask(
  projectId: string,
  data: {
    name: string
    notes?: string
    assignee?: string
    status: TaskStatus
    phase?: TaskPhase
    priority?: TaskPriority
    progress: number
    startDate: string
    endDate: string
    dependencies?: Array<string>
    order?: number
  },
): Promise<ProjectTask> {
  const res = await apiFetch(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to create task',
    )
  }
  const result = await res.json()
  return result.task
}

export async function updateProjectTask(
  projectId: string,
  taskId: string,
  data: Partial<{
    name: string
    notes: string
    assignee: string | null
    status: TaskStatus
    phase: TaskPhase
    priority: TaskPriority
    progress: number
    startDate: string
    endDate: string
    dependencies: Array<string>
    order: number
  }>,
): Promise<ProjectTask> {
  const res = await apiFetch(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to update task',
    )
  }
  const result = await res.json()
  return result.task
}

export async function deleteProjectTask(
  projectId: string,
  taskId: string,
): Promise<void> {
  const res = await apiFetch(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to delete task',
    )
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function getProjectTemplates(): Promise<Array<ProjectTemplate>> {
  const res = await apiFetch('/api/projects/templates')
  if (!res.ok) throw new Error('Failed to fetch project templates')
  const data = await res.json()
  return data.templates
}

export async function getProjectTemplate(id: string): Promise<ProjectTemplate> {
  const res = await apiFetch(`/api/projects/templates/${id}`)
  if (!res.ok) throw new Error('Failed to fetch template')
  const data = await res.json()
  return data.template
}

// ── Users (assignee picker) ────────────────────────────────────────────────────

export async function getProjectUsers(): Promise<Array<ProjectUser>> {
  const res = await apiFetch('/api/users')
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}
