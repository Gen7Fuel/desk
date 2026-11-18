// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { DeliveryDetail } from '@/lib/tradogram-api'
import { TradogramDraftBill } from '@/components/custom/TradogramDraftBill'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api', () => ({ apiFetch }))
const detail: DeliveryDetail = {
  source: {
    deliveryCode: 'abcdefghijkl',
    poNumber: 'PO-1',
    supplier: 'Vendor',
    supplierAccountNumber: 'V001',
    receivedDate: '2026-11-01',
    sourceHash: 'source',
    currency: 'CAD',
    subtotal: 100,
    lines: [],
    issues: [],
    poTax: '13',
    poDiscount: '0',
    poFees: '0',
  },
  draft: {
    revision: 1,
    site: 'Construction',
    vendorId: 'V001',
    invoiceNumber: 'INV-1',
    notes: '',
    status: 'ready',
    intacctBillKey: '',
    lines: [],
  },
  accounts: [],
  stale: false,
}
const p = {
  hash: 'preview-hash',
  entityId: 'A210',
  company: 'Gen7 LP',
  vendor: { id: 'V001', name: 'Example Vendor' },
  billNumber: 'INV-1-abcdefghijkl',
  invoiceDate: '2026-11-01',
  postingDate: '2026-11-01',
  dueDate: '2026-11-01',
  currency: 'CAD',
  totalCents: 10000,
  subtotalOnly: true,
  lines: [
    {
      id: 'line1',
      name: 'Pump',
      quantity: 4,
      accountId: '13001',
      accountName: 'Construction Loan',
      amountCents: 10000,
    },
  ],
}
const props = () => ({
  detail: structuredClone(detail),
  disabled: false,
  onBusy: vi.fn(),
  onCreated: vi.fn(),
  onReload: vi.fn(async () => {}),
})
beforeEach(() => {
  apiFetch.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(
          url.endsWith('draft-preview')
            ? p
            : {
                billKey: '9001',
                billNumber: p.billNumber,
                entityId: 'A210',
                state: 'draft',
                alreadyCreated: false,
              },
        ),
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('requires a reviewed preview and subtotal acknowledgment before creating the draft', async () => {
  const handlers = props()
  render(<TradogramDraftBill {...handlers} />)
  expect(
    screen.queryByRole('button', { name: 'Create Intacct draft bill' }),
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Preview Intacct draft' }))
  await screen.findByText('A210 · Gen7 LP · Draft only')
  expect(screen.getByText(/GL 13001/)).toBeTruthy()
  const button = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Create Intacct draft bill',
  })
  expect(button.disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(button)
  await waitFor(() =>
    expect(handlers.onCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        billKey: '9001',
        entityId: 'A210',
        state: 'draft',
      }),
    ),
  )
  const body = JSON.parse(apiFetch.mock.calls[1][1].body)
  expect(body).toMatchObject({
    previewHash: p.hash,
    subtotalAcknowledged: true,
    billNumber: p.billNumber,
  })
  expect(body).not.toHaveProperty('state')
})

it('invalidates the preview when dates or the bill number change', async () => {
  render(<TradogramDraftBill {...props()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Preview Intacct draft' }))
  await screen.findByText('A210 · Gen7 LP · Draft only')
  fireEvent.change(screen.getByLabelText('Due date'), {
    target: { value: '2026-12-01' },
  })
  expect(
    screen.queryByRole('button', { name: 'Create Intacct draft bill' }),
  ).toBeNull()
})

it('requires saved ready changes and blocks stale preparations', () => {
  const handlers = props()
  const { rerender } = render(<TradogramDraftBill {...handlers} disabled />)
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Preview Intacct draft',
    }).disabled,
  ).toBe(true)
  rerender(
    <TradogramDraftBill
      {...handlers}
      detail={{ ...handlers.detail, stale: true }}
    />,
  )
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Preview Intacct draft',
    }).disabled,
  ).toBe(true)
})

it('shows the persisted reference and blocks creating or uncertain attempts', () => {
  const handlers = props()
  const { rerender } = render(
    <TradogramDraftBill
      {...handlers}
      detail={{
        ...detail,
        draft: {
          ...detail.draft!,
          intacctBillKey: '9001',
          intacctEntityId: 'A210',
          intacctBillNumber: p.billNumber,
        },
      }}
    />,
  )
  expect(screen.getByText(/Intacct draft reference: 9001/)).toBeTruthy()
  expect(
    screen.queryByRole('button', { name: 'Preview Intacct draft' }),
  ).toBeNull()
  rerender(
    <TradogramDraftBill
      {...handlers}
      detail={{
        ...detail,
        draft: { ...detail.draft!, intacctCreationState: 'uncertain' },
      }}
    />,
  )
  expect(screen.getByRole('alert').textContent).toContain(
    'Check Intacct before retrying',
  )
  expect(
    screen.queryByRole('button', { name: 'Preview Intacct draft' }),
  ).toBeNull()
})

it('refreshes persisted creation state after an ambiguous failure without retrying', async () => {
  const handlers = props()
  render(<TradogramDraftBill {...handlers} />)
  fireEvent.click(screen.getByRole('button', { name: 'Preview Intacct draft' }))
  await screen.findByText('A210 · Gen7 LP · Draft only')
  apiFetch.mockResolvedValueOnce({
    ok: false,
    json: () =>
      Promise.resolve({
        message: 'The creation result is uncertain. Check Intacct.',
      }),
  })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(
    screen.getByRole('button', { name: 'Create Intacct draft bill' }),
  )
  await screen.findByRole('alert')
  expect(handlers.onReload).toHaveBeenCalledOnce()
  expect(handlers.onCreated).not.toHaveBeenCalled()
  expect(apiFetch).toHaveBeenCalledTimes(2)
  expect(
    screen.queryByRole('button', { name: 'Create Intacct draft bill' }),
  ).toBeNull()
})
