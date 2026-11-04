// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import { Route } from '@/routes/_appbar/_sidebar/hub/pos-reports'

const { apiFetch, can } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  can: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ apiFetch }))
vi.mock('@/lib/permissions', () => ({ can }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => ({ options: config }),
  redirect: vi.fn(),
}))
const Component = Route.options.component as ComponentType
const totals = {
  sales: 2,
  voids: 1,
  gross: 2000,
  tax: 100,
  fees: 0,
  rounding: 0,
  total: 2100,
  quantity: 2,
  taxableSales: 2000,
  untaxedSales: 0,
  discounts: 0,
  discountLines: 0,
  cash: 2100,
  otherPayments: 0,
  safeDrops: 0,
}
const report = {
  site: 'burlington',
  siteName: 'Burlington',
  date: '2026-11-03',
  timezone: 'America/Toronto',
  sourceHash: 'a'.repeat(64),
  revision: 1,
  status: 'needs-review',
  acceptedBy: 'reviewer@test',
  acceptedAt: '2026-11-04T10:00:00Z',
  totals,
  issues: [
    {
      code: 'item-tax',
      message: 'Transaction tax total used.',
      transactionId: '2',
    },
  ],
  payments: { Cash: 2100 },
  departments: {},
  eventCount: 3,
  pendingFiles: 1,
  events: [],
  files: [
    {
      path: 'late.xml',
      hash: 'b'.repeat(64),
      archived: false,
      days: ['2026-11-03'],
    },
  ],
  history: [
    {
      revision: 1,
      acceptedBy: 'reviewer@test',
      acceptedAt: '2026-11-04T10:00:00Z',
      sourceHash: 'c'.repeat(64),
      snapshot: {
        totals: { ...totals, total: 1050 },
        timezone: 'America/Toronto',
      },
    },
  ],
}
let client: QueryClient
beforeEach(() => {
  can.mockImplementation(() => true)
  apiFetch.mockImplementation((url: string, init?: RequestInit) => {
    let body: unknown
    if (url.endsWith('/sites'))
      body = {
        sites: [
          {
            id: 'burlington',
            name: 'Burlington',
            folder: 'Burlington',
            storeLocationIds: ['STORE'],
            timezone: 'America/Toronto',
          },
        ],
        locations: [],
        locationIssue: '',
      }
    else if (url.endsWith('/scan'))
      body = {
        imported: 0,
        waiting: 0,
        duplicates: 0,
        completedAt: null,
        issues: [
          {
            site: 'burlington',
            file: 'invalid.xml',
            message: 'Malformed XML journal.',
          },
        ],
      }
    else if (url.includes('/reports?')) body = [report]
    else if (url.endsWith('/accept') && init?.method === 'POST')
      body = {
        report: { ...report, status: 'accepted', revision: 2 },
        archive: { archived: 1, waiting: 0, errors: [] },
      }
    else body = report
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(structuredClone(body)),
    })
  })
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})
afterEach(() => {
  cleanup()
  client.clear()
  vi.clearAllMocks()
})
const show = () =>
  render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  )

it('shows late-file review, authoritative totals, import issues, and sends the reviewed revision only after confirmation', async () => {
  show()
  expect(await screen.findByText('Revised — review required')).toBeTruthy()
  expect(await screen.findByText(/invalid.xml: Malformed XML/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'View report' }))
  const accept = await screen.findByRole('button', {
    name: 'Accept revised report',
  })
  expect(
    screen.getByText('Transaction 2: Transaction tax total used.'),
  ).toBeTruthy()
  expect(screen.getByText(/Revision 1.*Total 10.50/)).toBeTruthy()
  fireEvent.click(accept)
  expect(apiFetch.mock.calls.some(([url]) => url.endsWith('/accept'))).toBe(
    false,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/pos-reports/reports/burlington/2026-11-03/accept',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sourceHash: 'a'.repeat(64), revision: 1 }),
      }),
    ),
  )
})
it('allows read-only users to view reports without exposing acceptance or configuration controls', async () => {
  can.mockImplementation(
    (_permission: string, action: string) => action === 'read',
  )
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'View report' }))
  await screen.findByText('Total including tax')
  expect(
    screen.queryByRole('button', { name: 'Accept revised report' }),
  ).toBeNull()
  expect(screen.queryByRole('button', { name: 'Refresh files' })).toBeNull()
  expect(screen.queryByText('Site configuration')).toBeNull()
})
