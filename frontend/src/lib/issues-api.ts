import { apiFetch } from './api'

export interface Issue {
  _id: string
  station: string
  issue: string
  comments: string
  department: string
  assignee: string
  startDate: string
  notes: string
  status: 'open' | 'in-progress' | 'on-hold' | 'resolved'
  createdAt: string
  updatedAt: string
}

export interface IssueForm {
  station: string
  issue: string
  comments: string
  department: string
  assignee: string
  startDate: string
  notes: string
  status: 'open' | 'in-progress' | 'on-hold' | 'resolved'
}

export async function fetchIssues(params?: {
  station?: string
  department?: string
  status?: string
}): Promise<Array<Issue>> {
  const query = new URLSearchParams()
  if (params?.station) query.set('station', params.station)
  if (params?.department) query.set('department', params.department)
  if (params?.status) query.set('status', params.status)
  const res = await apiFetch(`/api/issues?${query}`)
  if (!res.ok) throw new Error('Failed to fetch issues')
  return res.json()
}

export async function createIssue(form: IssueForm): Promise<Issue> {
  const res = await apiFetch('/api/issues', {
    method: 'POST',
    body: JSON.stringify(form),
  })
  if (!res.ok)
    throw new Error((await res.json()).error || 'Failed to create issue')
  return res.json()
}

export async function updateIssue(id: string, form: IssueForm): Promise<Issue> {
  const res = await apiFetch(`/api/issues/${id}`, {
    method: 'PUT',
    body: JSON.stringify(form),
  })
  if (!res.ok)
    throw new Error((await res.json()).error || 'Failed to update issue')
  return res.json()
}

export async function deleteIssue(id: string): Promise<void> {
  const res = await apiFetch(`/api/issues/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete issue')
}
