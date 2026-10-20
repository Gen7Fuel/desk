// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../api'
import { Route } from '../../routes/_appbar/_fuel/fuel-invoicing'
import { extractFieldsFromRects } from './pdf-extractor'
import { fuelEntry, fuelInvoice } from './test-fixtures'
import type { ComponentType } from 'react'

vi.mock('../api', () => ({ apiFetch: vi.fn() }))
vi.mock('../permissions', () => ({ can: () => true }))
vi.mock('../log-api', () => ({ createLog: vi.fn().mockResolvedValue({}) }))
vi.mock('./pdf-extractor', () => ({ extractFieldsFromRects: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    ...options,
    useLoaderData: () => ({ access_token: 'test-token' }),
  }),
  redirect: vi.fn(),
}))

const Page = (Route as unknown as { component: ComponentType }).component

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(extractFieldsFromRects).mockResolvedValue(fuelInvoice())
  vi.mocked(apiFetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ 'ia::result': { key: 'test-key' } }),
  } as Response)
})
afterEach(cleanup)

async function upload() {
  const file = new File(['test'], 'invoice.pdf', { type: 'application/pdf' })
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(new ArrayBuffer(1)),
  })
  fireEvent.change(document.getElementById('pdf-upload-input')!, {
    target: { files: [file] },
  })
  await waitFor(() => expect(extractFieldsFromRects).toHaveBeenCalled())
  await screen.findByText('Invoice Details')
}

describe('fuel invoicing Litres switch', () => {
  it('is labelled and defaults off again after remounting', () => {
    const view = render(<Page />)
    const toggle = screen.getByRole('switch', {
      name: 'Include Litres in Sage AR invoice',
    })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByText('Include Litres in Sage AR invoice'))
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    view.unmount()
    render(<Page />)
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
      'false',
    )
  })

  it.each([false, true])(
    'submits the selected mode (%s) and clears the file successfully',
    async (enabled) => {
      render(<Page />)
      if (enabled) fireEvent.click(screen.getByRole('switch'))
      await upload()
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
      await waitFor(() => expect(screen.queryByText('invoice.pdf')).toBeNull())
      expect(apiFetch).toHaveBeenCalledTimes(3)
      const calls = vi.mocked(apiFetch).mock.calls
      expect(calls.map(([url]) => url)).toEqual([
        '/api/sage/attachment',
        '/api/sage/bill',
        '/api/sage/invoice',
      ])
      expect(String(calls[1][1]?.body)).not.toContain('nsp::FUEL_LITRES')
      const product = JSON.parse(String(calls[2][1]?.body)).lines[0]
      if (enabled) expect(product['nsp::FUEL_LITRES']).toBe(10000.125)
      else expect(product).not.toHaveProperty('nsp::FUEL_LITRES')
    },
  )

  it('validates before attachment, AP, or AR writes', async () => {
    vi.mocked(extractFieldsFromRects).mockResolvedValue(
      fuelInvoice({
        tableEntries: [fuelEntry({ qtyNet: '' })],
      }),
    )
    render(<Page />)
    fireEvent.click(screen.getByRole('switch'))
    await upload()
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await screen.findByText(/Invalid Qty Delivered for Regular Gas/)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('locks the switch while submitting', async () => {
    let finish!: (response: Response) => void
    vi.mocked(apiFetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    render(<Page />)
    await upload()
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByRole<HTMLButtonElement>('switch').disabled).toBe(true)
    act(() =>
      finish({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Test failure' }),
      } as Response),
    )
    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>('switch').disabled).toBe(
        false,
      ),
    )
  })
})
