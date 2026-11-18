// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { Bookworks } from '@/routes/_appbar/_sidebar/hub/intacct/bookworks'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
}))

const invoice = {
  id: 101,
  invoiceNumber: 'TEST-100',
  vendorCode: 'EXAMPLE',
  vendorName: 'Example Company Ltd',
  invoiceDate: '2026-10-20T00:00:00',
  dueDate: '2026-10-28T00:00:00',
  discountDate: null,
  totalAmount: 123.45,
  posted: true,
  description: 'Supplier Invoice',
  distributions: [
    {
      glAccountCode: '12000',
      costCenterCode: 'WEST',
      debitOrCredit: 'Debit',
      description: 'Fuel inventory',
      amount: 123.45,
    },
  ],
}
const result = (overrides: object = {}) => ({
  invoiceNumber: 'TEST-100',
  offset: 0,
  pageSize: 25,
  hasMore: false,
  invoices: [invoice],
  warnings: [],
  ...overrides,
})
const respond = (data: unknown, ok = true) => ({ ok, json: () => Promise.resolve(data) })
const submit = (number = 'TEST-100') => {
  fireEvent.change(screen.getByLabelText('Invoice #'), {
    target: { value: number },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Search invoices' }))
}
beforeEach(() => {
  vi.resetAllMocks()
  apiFetch.mockResolvedValue(respond(result()))
})
afterEach(cleanup)

it('does not load invoices until the user searches, then displays selectable details', async () => {
  render(<Bookworks />)
  expect(apiFetch).not.toHaveBeenCalled()
  submit(' TEST-100 ')
  const button = await screen.findByRole('button', {
    name: /View invoice TEST-100 from EXAMPLE/,
  })
  const url = new URL(apiFetch.mock.calls[0][0], 'http://desk.test')
  expect(url.pathname).toBe('/api/bookworks/invoices')
  expect(url.searchParams.get('invoiceNumber')).toBe('TEST-100')
  expect(screen.queryByRole('region', { name: 'Invoice details' })).toBeNull()
  fireEvent.click(button)
  const details = screen.getByRole('region', { name: 'Invoice details' })
  expect(within(details).getByText('Example Company Ltd')).toBeTruthy()
  expect(within(details).getByText('2026-10-20')).toBeTruthy()
  expect(within(details).getByText('2026-10-28')).toBeTruthy()
  expect(within(details).getByText('12000')).toBeTruthy()
  expect(within(details).getByText('Fuel inventory')).toBeTruthy()
})

it('lets the user select the correct vendor when invoice numbers are shared', async () => {
  apiFetch.mockResolvedValue(
    respond(
      result({
        invoices: [
          invoice,
          {
            ...invoice,
            id: 102,
            vendorCode: 'OTHER',
            vendorName: 'Other Company Ltd',
            totalAmount: 678.9,
          },
        ],
      }),
    ),
  )
  render(<Bookworks />)
  submit()
  fireEvent.click(
    await screen.findByRole('button', {
      name: /View invoice TEST-100 from OTHER/,
    }),
  )
  const details = screen.getByRole('region', { name: 'Invoice details' })
  expect(within(details).getByText('Other Company Ltd')).toBeTruthy()
  expect(within(details).getByText('678.90')).toBeTruthy()
})

it('shows no matches and removes details from a previous search', async () => {
  render(<Bookworks />)
  submit()
  fireEvent.click(
    await screen.findByRole('button', { name: /View invoice TEST-100/ }),
  )
  apiFetch.mockResolvedValue(
    respond(result({ invoiceNumber: 'MISSING', invoices: [] })),
  )
  submit('MISSING')
  expect(await screen.findByText(/No invoices found/)).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Invoice details' })).toBeNull()
})

it('shows upstream failures and lets the user retry', async () => {
  apiFetch.mockResolvedValueOnce(
    respond({ message: 'Bookworks timed out. Please retry.' }, false),
  )
  render(<Bookworks />)
  submit()
  expect((await screen.findByRole('alert')).textContent).toContain('timed out')
  submit()
  expect(
    await screen.findByRole('button', { name: /View invoice TEST-100/ }),
  ).toBeTruthy()
})

it('uses the searched invoice number when paging even if the input is edited', async () => {
  apiFetch.mockResolvedValueOnce(respond(result({ hasMore: true })))
  render(<Bookworks />)
  submit()
  const next = await screen.findByRole('button', { name: 'Next' })
  fireEvent.change(screen.getByLabelText('Invoice #'), {
    target: { value: 'UNSUBMITTED' },
  })
  apiFetch.mockResolvedValueOnce(respond(result({ offset: 25 })))
  fireEvent.click(next)
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2))
  const url = new URL(apiFetch.mock.calls[1][0], 'http://desk.test')
  expect(url.searchParams.get('invoiceNumber')).toBe('TEST-100')
  expect(url.searchParams.get('offset')).toBe('25')
})

it('keeps invoice information available when vendor names are missing', async () => {
  apiFetch.mockResolvedValue(
    respond(
      result({
        invoices: [{ ...invoice, vendorName: null, posted: null }],
        warnings: ['Vendor names could not be loaded.'],
      }),
    ),
  )
  render(<Bookworks />)
  submit()
  expect(
    await screen.findByText('Vendor names could not be loaded.'),
  ).toBeTruthy()
  expect(screen.getByText('Unknown')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /View invoice TEST-100/ }))
  expect(
    within(screen.getByRole('region', { name: 'Invoice details' })).getByText(
      '12000',
    ),
  ).toBeTruthy()
})
