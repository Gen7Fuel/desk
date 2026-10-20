import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../api'
import { createInvoice } from './sage-api'
import { deliveredLitres } from './litres'
import { fuelEntry, fuelInvoice } from './test-fixtures'

vi.mock('../api', () => ({ apiFetch: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiFetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ 'ia::result': { key: 'test-key' } }),
  } as Response)
})

function submittedBody() {
  return JSON.parse(String(vi.mocked(apiFetch).mock.calls[0][1]?.body))
}

describe('AR invoice Litres', () => {
  it('keeps the legacy payload by default and when explicitly off', async () => {
    const fields = fuelInvoice()
    await createInvoice(fields, 'attachment', 'token')
    const legacy = submittedBody()
    expect(
      legacy.lines.map((line: { txnAmount: string }) => line.txnAmount),
    ).toEqual(['12000.15', '100.00', '50.00', '110.00'])
    expect(JSON.stringify(legacy)).not.toContain('nsp::FUEL_LITRES')
    vi.mocked(apiFetch).mockClear()
    await createInvoice(fields, 'attachment', 'token', { includeLitres: false })
    expect(submittedBody()).toEqual(legacy)
  })

  it('adds numeric delivered litres only to product lines, preserving all other fields', async () => {
    const fields = fuelInvoice({
      tableEntries: [
        fuelEntry(),
        fuelEntry({
          product: 'D',
          description: 'Diesel',
          qtyNet: '2500.875',
          qtyGross: '3000',
        }),
      ],
    })
    await createInvoice(fields, 'attachment', 'token')
    const legacy = submittedBody()
    vi.mocked(apiFetch).mockClear()
    await createInvoice(fields, 'attachment', 'token', { includeLitres: true })
    const enabled = submittedBody()
    expect(enabled.lines[0]['nsp::FUEL_LITRES']).toBe(10000.125)
    expect(enabled.lines[3]['nsp::FUEL_LITRES']).toBe(2500.875)
    for (const index of [1, 2, 4, 5, 6]) {
      expect(enabled.lines[index]).not.toHaveProperty('nsp::FUEL_LITRES')
    }
    delete enabled.lines[0]['nsp::FUEL_LITRES']
    delete enabled.lines[3]['nsp::FUEL_LITRES']
    expect(enabled).toEqual(legacy)
  })

  it('allows legacy submissions even when delivered quantity is missing', async () => {
    await createInvoice(
      fuelInvoice({ tableEntries: [fuelEntry({ qtyNet: '' })] }),
      'a',
      't',
    )
    expect(apiFetch).toHaveBeenCalledOnce()
  })

  it.each([
    '',
    'abc',
    '12L',
    '1,23',
    '1.2.3',
    'NaN',
    'Infinity',
    '9'.repeat(400),
  ])(
    'rejects invalid delivered quantity %s without an API request',
    async (qtyNet) => {
      await expect(
        createInvoice(
          fuelInvoice({ tableEntries: [fuelEntry({ qtyNet })] }),
          'a',
          't',
          {
            includeLitres: true,
          },
        ),
      ).rejects.toThrow(/Invalid Qty Delivered for Regular Gas/)
      expect(apiFetch).not.toHaveBeenCalled()
    },
  )

  it('rejects an enabled invoice without any products', async () => {
    await expect(
      createInvoice(fuelInvoice({ tableEntries: [] }), 'a', 't', {
        includeLitres: true,
      }),
    ).rejects.toThrow(/No fuel products/)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('accepts zero and does not round fractional quantities', () => {
    expect(deliveredLitres(fuelEntry({ qtyNet: '0' }))).toBe(0)
    expect(deliveredLitres(fuelEntry({ qtyNet: ' 12,345.6789 ' }))).toBe(
      12345.6789,
    )
  })
})
