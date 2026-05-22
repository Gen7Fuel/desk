import { getTokenPayload } from '@/lib/permissions'

const HUB = 'https://app.gen7fuel.com'

function getExternalToken(): string {
  const payload = getTokenPayload() as { externalToken?: string } | null
  return payload?.externalToken ?? ''
}

async function hubFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getExternalToken()}`,
    ...(init.headers as Record<string, string> | undefined),
  }
  return fetch(HUB + path, { ...init, headers })
}

export interface ArCustomer {
  _id: string
  customerId: string
  name: string
  creditLimit: number | null
  phone: string
  email: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type ArCustomerUpdate = Partial<
  Pick<ArCustomer, 'creditLimit' | 'phone' | 'email' | 'notes'>
>

export async function getArCustomers(): Promise<Array<ArCustomer>> {
  const res = await hubFetch('/api/ar-customers')
  if (!res.ok) throw new Error('Failed to fetch AR customers')
  return res.json()
}

export async function getArCustomer(id: string): Promise<ArCustomer> {
  const res = await hubFetch(`/api/ar-customers/${id}`)
  const body = await res.json()
  if (!res.ok)
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to fetch AR customer',
    )
  return body
}

export async function updateArCustomer(
  id: string,
  data: ArCustomerUpdate,
): Promise<ArCustomer> {
  const res = await hubFetch(`/api/ar-customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok)
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to update AR customer',
    )
  return body
}

export async function deleteArCustomer(id: string): Promise<void> {
  const res = await hubFetch(`/api/ar-customers/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to delete AR customer',
    )
  }
}

export async function syncArCustomers(
  file: File,
): Promise<{ created: number; updated: number; deleted: number }> {
  const html = await file.text()
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
  const customers: Array<{ customerId: string; name: string }> = []
  for (const tr of trMatches) {
    const cells = (tr.match(/<(?:td|th)[\s\S]*?<\/(?:td|th)>/gi) ?? []).map(
      (td) =>
        td
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/gi, '')
          .trim(),
    )
    if (cells.length >= 2 && /^\d+$/.test(cells[0])) {
      customers.push({ customerId: cells[0], name: cells[1] })
    }
  }
  if (customers.length === 0)
    throw new Error('No valid customer rows found in file')
  const res = await hubFetch('/api/ar-customers/sync', {
    method: 'POST',
    body: JSON.stringify({ customers }),
  })
  const body = await res.json()
  if (!res.ok)
    throw new Error((body as { error?: string }).error ?? 'Sync failed')
  return body as { created: number; updated: number; deleted: number }
}
