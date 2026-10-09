import { describe, expect, it } from 'vitest'
import { replacedVideoUrls, videoUrlsByItem } from './academy-video-cleanup'
import type { AcademySection } from './academy-api'

const section = (
  items: Array<{ _id?: string; type?: string; url?: unknown }>,
): AcademySection => ({
  title: 's',
  order: 0,
  type: 'lesson',
  items: items.map((i, n) => ({
    _id: i._id,
    type: (i.type ?? 'video') as AcademySection['items'][number]['type'],
    order: n,
    content: { url: i.url },
  })),
})

describe('videoUrlsByItem', () => {
  it('maps saved video items to their URL, skipping others', () => {
    const map = videoUrlsByItem([
      section([
        { _id: 'a', url: 'https://x/a' },
        { _id: 'b', type: 'mcq', url: 'https://x/ignored' },
        { _id: 'c', url: '' },
        { url: 'https://x/unsaved' },
      ]),
    ])
    expect([...map]).toEqual([['a', 'https://x/a']])
  })
})

describe('replacedVideoUrls', () => {
  const before = new Map([
    ['a', 'https://x/old-a'],
    ['b', 'https://x/old-b'],
    ['c', 'https://x/old-c'],
  ])

  it('returns the old URL of an item whose video changed', () => {
    const after = [section([{ _id: 'a', url: 'https://x/new-a' }])]
    expect(replacedVideoUrls(before, after)).toEqual(['https://x/old-a'])
  })

  it('returns the old URL of an item whose video was cleared', () => {
    const after = [section([{ _id: 'b', url: '' }])]
    expect(replacedVideoUrls(before, after)).toEqual(['https://x/old-b'])
  })

  it('ignores unchanged items, deleted items, new items and other types', () => {
    const after = [
      section([
        { _id: 'a', url: 'https://x/old-a' },
        { _id: 'new', url: 'https://x/brand-new' },
        { _id: 'c', type: 'mcq', url: 'whatever' },
      ]),
    ]
    // 'b' is absent (item deleted) so its video is intentionally not touched.
    expect(replacedVideoUrls(before, after)).toEqual([])
  })

  it('lists a URL once even if several items replaced it', () => {
    const dup = new Map([
      ['a', 'https://x/same'],
      ['b', 'https://x/same'],
    ])
    const after = [
      section([
        { _id: 'a', url: '' },
        { _id: 'b', url: '' },
      ]),
    ]
    expect(replacedVideoUrls(dup, after)).toEqual(['https://x/same'])
  })
})
