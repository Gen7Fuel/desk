import { apiFetch } from '@/lib/api'
import { getExternalToken } from '@/lib/permissions'
import { getSageToken } from '@/lib/sage-site'

const HUB = 'https://app.gen7fuel.com'

/** A Hub payable vendor name linked to its Sage Intacct vendor. */
export interface VendorTag {
  nameKey: string
  vendorName: string
  sageVendorId: string
  sageVendorName: string
}

export interface SageVendor {
  id: string
  name: string
}

/** Must match PayableVendorTag.normalizeName in the Hub backend. */
export function vendorNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function hubHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getExternalToken()}`,
  }
}

export async function fetchVendorTags(): Promise<Array<VendorTag>> {
  const res = await fetch(`${HUB}/api/payables/vendor-tags`, {
    headers: hubHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to load vendor tags (${res.status})`)
  return (await res.json()) as Array<VendorTag>
}

export async function saveVendorTag(
  vendorName: string,
  vendor: SageVendor,
): Promise<VendorTag> {
  const res = await fetch(`${HUB}/api/payables/vendor-tags`, {
    method: 'PUT',
    headers: hubHeaders(),
    body: JSON.stringify({
      vendorName,
      sageVendorId: vendor.id,
      sageVendorName: vendor.name,
    }),
  })
  if (!res.ok) throw new Error(`Failed to save the tag (${res.status})`)
  return (await res.json()) as VendorTag
}

/** All active, open-item Intacct AP vendors (the backend pages through Sage). */
export async function fetchSageApVendors(): Promise<Array<SageVendor>> {
  const sageToken = await getSageToken()
  const res = await apiFetch('/api/sage/ap-vendors', {
    headers: { 'X-Sage-Token': sageToken },
  })
  if (!res.ok) throw new Error(`Failed to load Intacct vendors (${res.status})`)
  const data = (await res.json()) as { vendors: Array<SageVendor> }
  return data.vendors
}
