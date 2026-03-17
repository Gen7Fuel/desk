import { apiFetch } from './api'

export interface Category {
  _id: string
  name: string
  createdAt: string
}

export async function getCategories(): Promise<Array<Category>> {
  const res = await apiFetch('/api/subscriptions/categories')
  if (!res.ok) throw new Error('Failed to fetch categories')
  return res.json()
}

export async function createCategory(data: {
  name: string
}): Promise<Category> {
  const res = await apiFetch('/api/subscriptions/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error || 'Failed to create category',
    )
  }
  return res.json()
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await apiFetch(`/api/subscriptions/categories/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error || 'Failed to delete category',
    )
  }
}
