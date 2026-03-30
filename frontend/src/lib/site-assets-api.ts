import { apiFetch } from './api'

export interface LocationOption {
  _id: string
  stationName: string
}

export interface SiteAsset {
  _id: string
  site: string
  category: Category
  deviceType: string
  label: string
  serialNumber: string
  photo: string
  createdAt: string
  updatedAt: string
}

export const CATEGORIES = [
  'Bulloch Paypoint',
  'Infonet Paypoint',
  'PetroSoft',
  'Tablet',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

export const DEVICE_TYPES: Record<
  Exclude<Category, 'Other' | 'Tablet'>,
  Array<string>
> = {
  'Bulloch Paypoint': [
    'Main Monitor',
    'Customer Monitor',
    'Tower',
    'Till Drawer',
    'Barcode Scanner',
    'Pinpad',
    'Printer',
  ],
  'Infonet Paypoint': ['Infonet Scanner', 'Signing Pad'],
  PetroSoft: ['Cipherlabs Scanner', 'DC Box'],
}

async function throwIfError(res: Response, fallback: string): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || fallback)
  }
}

export async function getLocations(): Promise<Array<LocationOption>> {
  const res = await fetch('https://app.gen7fuel.com/api/locations')
  if (!res.ok) throw new Error('Failed to fetch locations')
  return res.json()
}

export type SiteAssetInput = Omit<SiteAsset, '_id' | 'createdAt' | 'updatedAt'>

export async function getSiteAssets(site?: string): Promise<Array<SiteAsset>> {
  const url = site
    ? `/api/site-assets?site=${encodeURIComponent(site)}`
    : '/api/site-assets'
  const res = await apiFetch(url)
  if (!res.ok) throw new Error('Failed to fetch assets')
  return res.json()
}

export async function createSiteAsset(
  data: SiteAssetInput,
): Promise<SiteAsset> {
  const res = await apiFetch('/api/site-assets', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  await throwIfError(res, 'Failed to create asset')
  return res.json()
}

export async function updateSiteAsset(
  id: string,
  data: SiteAssetInput,
): Promise<SiteAsset> {
  const res = await apiFetch(`/api/site-assets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  await throwIfError(res, 'Failed to update asset')
  return res.json()
}

export async function deleteSiteAsset(id: string): Promise<void> {
  const res = await apiFetch(`/api/site-assets/${id}`, { method: 'DELETE' })
  await throwIfError(res, 'Failed to delete asset')
}
