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
