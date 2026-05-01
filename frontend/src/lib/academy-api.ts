import { apiFetch } from './api'

export interface AcademyItem {
  _id?: string
  type: 'hotspot' | 'video' | 'mcq' | 'flip-card' | 'ordering' | 'matching'
  order: number
  content: Record<string, unknown>
}

export interface AcademySection {
  _id?: string
  title: string
  order: number
  type: 'lesson' | 'test'
  items: Array<AcademyItem>
}

export interface AcademyCourse {
  _id: string
  title: string
  description: string
  thumbnail: string
  status: 'draft' | 'published'
  sections: Array<AcademySection>
  createdAt: string
  updatedAt: string
}

export interface AcademyCourseSummary {
  _id: string
  title: string
  description: string
  thumbnail: string
  status: 'draft' | 'published'
  sectionCount: number
  createdAt: string
}

export async function getCourses(): Promise<Array<AcademyCourseSummary>> {
  const res = await apiFetch('/api/academy/courses')
  if (!res.ok) throw new Error('Failed to fetch courses')
  return res.json()
}

export async function getCourse(id: string): Promise<AcademyCourse> {
  const res = await apiFetch(`/api/academy/courses/${id}`)
  if (!res.ok) throw new Error('Failed to fetch course')
  return res.json()
}

export async function createCourse(
  data: Omit<AcademyCourse, '_id' | 'createdAt' | 'updatedAt'>,
): Promise<AcademyCourse> {
  const res = await apiFetch('/api/academy/courses', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create course')
  return res.json()
}

export async function updateCourse(
  id: string,
  data: Omit<AcademyCourse, '_id' | 'createdAt' | 'updatedAt'>,
): Promise<AcademyCourse> {
  const res = await apiFetch(`/api/academy/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update course')
  return res.json()
}

export async function deleteCourse(id: string): Promise<void> {
  const res = await apiFetch(`/api/academy/courses/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete course')
}

export async function publishCourse(id: string): Promise<AcademyCourse> {
  const res = await apiFetch(`/api/academy/courses/${id}/publish`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to publish course')
  return res.json()
}

export async function unpublishCourse(id: string): Promise<AcademyCourse> {
  const res = await apiFetch(`/api/academy/courses/${id}/unpublish`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to unpublish course')
  return res.json()
}

export interface AcademyEmployee {
  _id: string
  name: string
  code: string
  createdAt: string
}

export interface AcademyCompletion {
  _id: string
  employeeCode: string
  employeeName: string
  courseId: string
  courseTitle: string
  completedAt: string
  createdAt: string
}

export async function getEmployees(): Promise<Array<AcademyEmployee>> {
  const res = await apiFetch('/api/academy/employees')
  if (!res.ok) throw new Error('Failed to fetch employees')
  return res.json()
}

export async function createEmployee(name: string): Promise<AcademyEmployee> {
  const res = await apiFetch('/api/academy/employees', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to create employee')
  return res.json()
}

export async function deleteEmployee(id: string): Promise<void> {
  const res = await apiFetch(`/api/academy/employees/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete employee')
}

export async function getCompletions(
  courseId?: string,
): Promise<Array<AcademyCompletion>> {
  const qs = courseId ? `?courseId=${courseId}` : ''
  const res = await apiFetch(`/api/academy/completions${qs}`)
  if (!res.ok) throw new Error('Failed to fetch completions')
  return res.json()
}

export interface AcademyMediaFile {
  name: string
  fullPath: string
  size: number
  lastModified: string | null
  contentType: string
  url: string
}

export async function getAcademyMedia(): Promise<Array<AcademyMediaFile>> {
  const res = await apiFetch('/api/academy/media')
  if (!res.ok) throw new Error('Failed to fetch media')
  const data = await res.json()
  return data.files
}

export async function getAcademyMediaSasUrl(path: string): Promise<string> {
  const res = await apiFetch(
    `/api/academy/media/sas?path=${encodeURIComponent(path)}`,
  )
  if (!res.ok) throw new Error('Failed to generate media URL')
  const data = await res.json()
  return (data as { url: string }).url
}

export async function uploadAcademyMedia(file: File): Promise<AcademyMediaFile> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/api/academy/media/upload', { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Upload failed')
  }
  return res.json()
}

export async function uploadAcademyAsset(file: File): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/api/academy/upload', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error('Failed to upload file')
  return res.json()
}
