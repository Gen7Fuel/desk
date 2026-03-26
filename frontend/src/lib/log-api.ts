import { apiFetch } from './api'

export interface LogEntry {
  app: string
  action: 'create' | 'edit' | 'delete'
  entityId: string
  field?: string
  oldValue?: unknown
  newValue?: unknown
  entitySnapshot?: unknown
  severity?: 'info' | 'warning' | 'critical'
}

export interface LogRecord {
  _id: string
  timestamp: string
  app: string
  action: 'create' | 'edit' | 'delete'
  entityId: string
  user: { id?: string; email?: string }
  field?: string
  oldValue?: unknown
  newValue?: unknown
  entitySnapshot?: unknown
  ip?: string
  userAgent?: string
  severity: 'info' | 'warning' | 'critical'
  status: 'success' | 'failure'
}

export interface LogsResponse {
  logs: Array<LogRecord>
  total: number
  page: number
  limit: number
}

export async function createLog(entry: LogEntry): Promise<void> {
  try {
    await apiFetch('/api/logs', {
      method: 'POST',
      body: JSON.stringify(entry),
    })
  } catch {
    // Logging must never interrupt the main application flow
  }
}

export async function fetchLogs(params: {
  app?: string
  action?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}): Promise<LogsResponse> {
  const query = new URLSearchParams()
  if (params.app) query.set('app', params.app)
  if (params.action) query.set('action', params.action)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))

  const res = await apiFetch(`/api/logs?${query}`)
  if (!res.ok) throw new Error('Failed to fetch logs')
  return res.json()
}
