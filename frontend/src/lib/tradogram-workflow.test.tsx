// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Route } from '../routes/_appbar/_sidebar/hub/intacct/tradogram'
import type { ComponentType } from 'react'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch }))
vi.mock('@/lib/permissions', () => ({ can: () => true }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => ({ options: config }),
}))
const Component = Route.options.component as ComponentType
const source = {
  deliveryCode: 'receipt',
  poNumber: 'PO-1',
  supplier: 'Supplier',
  supplierAccountNumber: 'V1',
  sourceHash: 'hash',
  receivedDate: '2026-10-22',
  currency: 'CAD',
  subtotal: 10,
  issues: [],
  lines: [],
}
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              _id: 'station-1',
              site: 'Walpole',
              stationName: 'Walpole station',
            },
          ]),
      }),
  )
  HTMLElement.prototype.scrollIntoView = vi.fn()
  apiFetch.mockImplementation((url: string, init?: RequestInit) => {
    let body: unknown
    if (url.endsWith('/settings'))
      body = { entityId: 'T010', company: 'Test company', environment: 'test' }
    else if (url.endsWith('/gl-accounts')) body = []
    else if (url.endsWith('/sites'))
      body = init?.method === 'PUT' ? JSON.parse(String(init.body)) : []
    else if (url.includes('/deliveries?page='))
      body = { deliveries: [source], hasMore: false }
    else if (url.endsWith('/vendor'))
      body = {
        sourceHash: 'hash',
        issue: '',
        vendor: {
          id: 'V1',
          key: '1',
          name: 'Verified Supplier',
          entityId: 'T010',
          status: 'active',
        },
      }
    else if (url.endsWith('/deliveries/receipt'))
      body = { source, accounts: [], draft: null, stale: false }
    else throw new Error('Unexpected request ' + url)
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
it('resolves the vendor in T010 before any construction site has been selected', async () => {
  render(<Component />)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Review delivery' }),
  )
  await waitFor(
    () => expect(screen.getByText(/Verified Supplier/)).toBeTruthy(),
    { timeout: 5000 },
  )
  expect(screen.getByText(/Intacct company: T010/)).toBeTruthy()
  expect(screen.queryByText(/Choose a site with a configured/)).toBeNull()
  expect(
    apiFetch.mock.calls.some(
      ([url]) => url === '/api/tradogram/deliveries/receipt/vendor',
    ),
  ).toBe(true)
})
it('creates a construction site without requiring a Hub station or per-site company', async () => {
  render(<Component />)
  fireEvent.click(screen.getByRole('button', { name: 'Site accounts' }))
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Construction site name' }),
    { target: { value: 'New station construction' } },
  )
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Save site accounts',
      }).disabled,
    ).toBe(false),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save site accounts' }))
  await screen.findByText(
    'Site accounts saved. Reopen affected deliveries to review their account mappings.',
  )
  const call = apiFetch.mock.calls.find(([, init]) => init?.method === 'PUT')
  expect(JSON.parse(String(call?.[1].body))).toMatchObject({
    site: 'New station construction',
  })
  expect(JSON.parse(String(call?.[1].body))).not.toHaveProperty(
    'sageLocationId',
  )
})

it('offers Hub sites even without saved mappings and keeps the vendor scoped to the company', async () => {
  render(<Component />)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Review delivery' }),
  )
  await screen.findByText(/Verified Supplier/)
  const picker = await screen.findByRole('combobox', { name: 'Site' })
  await waitFor(() =>
    expect((picker as HTMLButtonElement).disabled).toBe(false),
  )
  expect(picker.textContent).toBe('Select a site')
  fireEvent.keyDown(picker, { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: 'Walpole' }))
  await waitFor(() => expect(picker.textContent).toBe('Walpole'))
  expect(screen.queryByText(/Select a construction site/)).toBeNull()
  expect(screen.queryByText(/Receiving site/)).toBeNull()
  expect(
    apiFetch.mock.calls.filter(([url]) => url.endsWith('/vendor')),
  ).toHaveLength(1)
})
