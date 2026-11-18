// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { BookworksDraft } from '@/components/custom/BookworksDraft'
import { inspectInvoiceText } from '@/lib/bookworks-pdf'

const { api, inspect } = vi.hoisted(() => ({
  api: {
    context: vi.fn(),
    vendors: vi.fn(),
    saveMapping: vi.fn(),
    preview: vi.fn(),
    createDraft: vi.fn(),
  },
  inspect: vi.fn(),
}))
vi.mock('@/lib/bookworks-api', () => ({ bookworksIntacct: api }))
vi.mock('@/lib/bookworks-pdf', async (original) => ({
  ...(await original<{ inspectInvoiceText: typeof inspectInvoiceText }>()),
  inspectBookworksPdf: inspect,
}))
const invoice = {
  id: 501,
  invoiceNumber: 'TEST-501',
  vendorCode: 'EXAMPLE',
  vendorName: 'Example',
  posted: true,
  totalAmount: 113,
  invoiceDate: '2026-10-20',
  dueDate: '2026-10-28',
  discountDate: null,
  description: '',
  distributions: [],
}
const vendor = { id: 'V001', key: '11', name: 'Example Ltd' }
const mapping = { vendorId: vendor.id, vendorName: vendor.name }
const preview = {
  hash: 'a'.repeat(64),
  invoiceId: 501,
  invoiceNumber: 'TEST-501',
  vendor,
  cogsType: 'fuel',
  cogsAccount: '50200',
  entityId: 'A210',
  currency: 'CAD',
  costCents: 10000,
  hstCents: 1300,
  totalCents: 11300,
  invoiceDate: '2026-10-20',
  postingDate: '2026-10-20',
  dueDate: '2026-10-28',
}
beforeEach(() => {
  vi.resetAllMocks()
  api.context.mockResolvedValue({ mapping, entry: null, entityId: 'A210' })
  api.vendors.mockResolvedValue({ vendors: [vendor], hasMore: false })
  api.saveMapping.mockResolvedValue(mapping)
  api.preview.mockResolvedValue(preview)
  api.createDraft.mockResolvedValue({ billKey: '9001', alreadyCreated: false })
})
afterEach(cleanup)
async function ready() {
  await waitFor(
    () => expect(screen.getByLabelText<HTMLSelectElement>('COGS account')).toBeTruthy(),
    { timeout: 5000 },
  )
}
const upload = () =>
  fireEvent.change(screen.getByLabelText('Invoice PDF (optional)'), {
    target: {
      files: [
        new File(['synthetic'], 'invoice.pdf', { type: 'application/pdf' }),
      ],
    },
  })
it('defaults to Fuel and requires an explicit preview and create action', async () => {
  render(<BookworksDraft invoice={invoice} />)
  await ready()
  expect(screen.getByLabelText<HTMLSelectElement>('COGS account').value).toBe('fuel')
  expect(api.createDraft).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: 'Preview draft' }))
  await waitFor(() =>
    expect(screen.getByText('Accounts Payable — vendor default')).toBeTruthy(),
  )
  expect(screen.getByText('HST — 22000')).toBeTruthy()
  expect(screen.getByText('113.00')).toBeTruthy()
  fireEvent.click(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Create draft in Intacct' }),
  )
  await waitFor(() =>
    expect(screen.getByText(/Intacct draft reference: 9001/)).toBeTruthy(),
  )
  expect(api.createDraft).toHaveBeenCalledWith(501, 'fuel', preview.hash)
  expect(
    screen.queryByRole('button', { name: 'Create draft in Intacct' }),
  ).toBeNull()
})
it('requires a saved vendor mapping before previewing', async () => {
  api.context.mockResolvedValue({ mapping: null, entry: null })
  render(<BookworksDraft invoice={invoice} />)
  await ready()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Preview draft' }).disabled).toBe(
    true,
  )
  fireEvent.change(screen.getByLabelText('Intacct vendor name'), {
    target: { value: 'Example' },
  })
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: 'Find vendors' }))
  await waitFor(() =>
    expect(screen.getByRole('option', { name: /V001/ })).toBeTruthy(),
  )
  fireEvent.change(screen.getByLabelText('Intacct vendor'), {
    target: { value: 'V001' },
  })
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: 'Save vendor mapping' }))
  await waitFor(() => expect(api.saveMapping).toHaveBeenCalledWith(501, 'V001'))
  await waitFor(() =>
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Preview draft' }).disabled).toBe(
      false,
    ),
  )
})
it('blocks unposted invoices', async () => {
  render(<BookworksDraft invoice={{ ...invoice, posted: false }} />)
  await waitFor(() =>
    expect(
      screen.getByText(
        'Only posted Bookworks invoices can be sent to Intacct.',
      ),
    ).toBeTruthy(),
  )
  expect(screen.queryByRole('button', { name: 'Preview draft' })).toBeNull()
})
it.each([
  [true, 'fuel'],
  [false, 'freight'],
])(
  'suggests an account using matching PDF text (litre=%s)',
  async (hasLitre, account) => {
    inspect.mockResolvedValue({ hasText: true, matchesInvoice: true, hasLitre })
    render(<BookworksDraft invoice={invoice} />)
    await ready()
    upload()
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('COGS account').value).toBe(account),
    )
    await waitFor(() =>
      expect(screen.getByText(/you can override it/)).toBeTruthy(),
    )
    fireEvent.change(screen.getByLabelText<HTMLSelectElement>('COGS account'), {
      target: { value: account === 'fuel' ? 'freight' : 'fuel' },
    })
    expect(screen.getByLabelText<HTMLSelectElement>('COGS account').value).not.toBe(account)
  },
)
it('keeps Fuel for scanned PDFs and blocks a mismatched PDF', async () => {
  inspect
    .mockResolvedValueOnce({
      hasText: false,
      matchesInvoice: false,
      hasLitre: false,
    })
    .mockResolvedValueOnce({
      hasText: true,
      matchesInvoice: false,
      hasLitre: true,
    })
  render(<BookworksDraft invoice={invoice} />)
  await ready()
  upload()
  await waitFor(() => expect(screen.getByText(/no readable text/)).toBeTruthy())
  expect(screen.getByLabelText<HTMLSelectElement>('COGS account').value).toBe('fuel')
  upload()
  await waitFor(() =>
    expect(
      screen.getByText(/does not contain the selected invoice number/),
    ).toBeTruthy(),
  )
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Preview draft' }).disabled).toBe(
    true,
  )
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: 'Clear PDF suggestion' }))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Preview draft' }).disabled).toBe(
    false,
  )
})
it('invalidates the preview when COGS changes', async () => {
  render(<BookworksDraft invoice={invoice} />)
  await ready()
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: 'Preview draft' }))
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Create draft in Intacct' }),
    ).toBeTruthy(),
  )
  fireEvent.change(screen.getByLabelText<HTMLSelectElement>('COGS account'), {
    target: { value: 'freight' },
  })
  expect(
    screen.queryByRole('button', { name: 'Create draft in Intacct' }),
  ).toBeNull()
})
it('refreshes creation status after an ambiguous failure', async () => {
  api.createDraft.mockRejectedValue(new Error('Check Intacct before retrying'))
  render(<BookworksDraft invoice={invoice} />)
  await ready()
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: 'Preview draft' }))
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Create draft in Intacct' }),
    ).toBeTruthy(),
  )
  api.context.mockResolvedValue({ mapping, entry: { status: 'uncertain' } })
  fireEvent.click(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Create draft in Intacct' }),
  )
  await waitFor(() =>
    expect(screen.getByText(/A creation attempt is in progress/)).toBeTruthy(),
  )
  expect(screen.queryByRole('button', { name: 'Preview draft' })).toBeNull()
})
it('detects litre anywhere in PDF text and normalizes invoice-number whitespace', () => {
  expect(inspectInvoiceText('IN 501 quantity per LITRE', 'IN501')).toEqual({
    hasText: true,
    hasLitre: true,
    matchesInvoice: true,
  })
  expect(inspectInvoiceText('', 'IN501').hasText).toBe(false)
})
