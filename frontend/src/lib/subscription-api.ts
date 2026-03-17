import { apiFetch } from './api'

export interface Subscription {
  _id: string
  category: string
  identifier: string
  price: number
  billing_cycle: 'monthly' | 'yearly'
  end_date: string
  notes?: string
  createdAt: string
}

export async function getSubscriptions(): Promise<Array<Subscription>> {
  const res = await apiFetch('/api/subscriptions')
  if (!res.ok) throw new Error('Failed to fetch subscriptions')
  return res.json()
}

export async function createSubscription(data: {
  category: string
  identifier: string
  price: number
  billing_cycle: 'monthly' | 'yearly'
  end_date: string
  notes?: string
}): Promise<Subscription> {
  const res = await apiFetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error || 'Failed to create subscription',
    )
  }
  return res.json()
}

export async function updateSubscription(
  id: string,
  data: Partial<{
    category: string
    identifier: string
    price: number
    billing_cycle: string
    end_date: string
    notes: string
  }>,
): Promise<Subscription> {
  const res = await apiFetch(`/api/subscriptions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error || 'Failed to update subscription',
    )
  }
  return res.json()
}

export async function deleteSubscription(id: string): Promise<void> {
  const res = await apiFetch(`/api/subscriptions/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error || 'Failed to delete subscription',
    )
  }
}
