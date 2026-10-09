import type { AcademySection } from '@/lib/academy-api'

/** Video URL of every saved video item, keyed by item id. */
export function videoUrlsByItem(
  sections: Array<AcademySection>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const section of sections) {
    for (const item of section.items) {
      if (item.type !== 'video' || !item._id) continue
      const url = item.content.url
      if (typeof url === 'string' && url) map.set(item._id, url)
    }
  }
  return map
}

/**
 * Video URLs that a save just replaced or cleared: items present before and
 * after whose URL changed or went empty. Items that were deleted outright are
 * deliberately not included. A URL changing doesn't prove a different video
 * (re-picking the same one yields a fresh SAS URL), so the server makes the
 * final call before deleting anything.
 */
export function replacedVideoUrls(
  before: Map<string, string>,
  savedSections: Array<AcademySection>,
): Array<string> {
  const replaced = new Set<string>()
  for (const section of savedSections) {
    for (const item of section.items) {
      if (item.type !== 'video' || !item._id) continue
      const oldUrl = before.get(item._id)
      if (!oldUrl) continue
      const newUrl =
        typeof item.content.url === 'string' ? item.content.url : ''
      if (newUrl !== oldUrl) replaced.add(oldUrl)
    }
  }
  return [...replaced]
}
