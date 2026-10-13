const {
  blobPathFromUrl,
  isCourseOwnedPath,
  mediaKey,
  courseReferencesMedia,
} = require('./media-references')

const CONTAINER = 'media'
const master = (folder, id) => `academy/${folder}/videos/${id}/master.m3u8`
const sas = (blobPath, sig = 'abc') =>
  `https://acct.blob.core.windows.net/${CONTAINER}/${blobPath.split('/').map(encodeURIComponent).join('/')}?sv=1&sig=${sig}`

describe('blobPathFromUrl', () => {
  it('returns the blob path inside the container, decoding the URL', () => {
    expect(blobPathFromUrl(sas('academy/c1-safety basics/clip one.mp4'), CONTAINER)).toBe(
      'academy/c1-safety basics/clip one.mp4',
    )
  })

  it('returns null for other containers, other strings and bad input', () => {
    expect(blobPathFromUrl('https://acct.blob.core.windows.net/other/academy/x.mp4', CONTAINER)).toBeNull()
    expect(blobPathFromUrl('not a url', CONTAINER)).toBeNull()
    expect(blobPathFromUrl(undefined, CONTAINER)).toBeNull()
    expect(blobPathFromUrl(sas('academy/x.mp4'), '')).toBeNull()
  })
})

describe('isCourseOwnedPath', () => {
  it("accepts paths in the course's folder whatever its title slug", () => {
    expect(isCourseOwnedPath(master('c1-old-title', 'v1'), 'c1')).toBe(true)
  })

  it('rejects the shared library, legacy paths and other courses', () => {
    expect(isCourseOwnedPath(master('_library', 'v1'), 'c1')).toBe(false)
    expect(isCourseOwnedPath('academy/videos/v1/master.m3u8', 'c1')).toBe(false)
    expect(isCourseOwnedPath(master('c2-other', 'v1'), 'c1')).toBe(false)
    expect(isCourseOwnedPath('academy/c1-file-without-folder', 'c1')).toBe(false)
    expect(isCourseOwnedPath(master('c1-x', 'v1'), '')).toBe(false)
  })
})

describe('mediaKey', () => {
  it('is the whole video directory for any file inside an HLS video', () => {
    const dir = 'academy/c1-x/videos/v1'
    expect(mediaKey(`${dir}/master.m3u8`)).toBe(dir)
    expect(mediaKey(`${dir}/480p/seg001.ts`)).toBe(dir)
  })

  it('is the blob path for a plain file', () => {
    expect(mediaKey('academy/c1-x/clip.mp4')).toBe('academy/c1-x/clip.mp4')
  })
})

describe('courseReferencesMedia', () => {
  const key = mediaKey(master('c1-x', 'v1'))
  const courseWith = (url) => ({ sections: [{ items: [{ type: 'video', content: { url } }] }] })

  it('matches the same video even though every SAS URL differs', () => {
    expect(courseReferencesMedia(courseWith(sas(master('c1-x', 'v1'), 'other-sig')), key, CONTAINER)).toBe(true)
  })

  it('does not match a different video, or unrelated strings', () => {
    expect(courseReferencesMedia(courseWith(sas(master('c1-x', 'v2'))), key, CONTAINER)).toBe(false)
    expect(courseReferencesMedia(courseWith('hello'), key, CONTAINER)).toBe(false)
    expect(courseReferencesMedia({}, key, CONTAINER)).toBe(false)
  })

  it('finds the video nested anywhere in an item', () => {
    const course = { sections: [{ items: [{ content: { steps: [{ media: { src: sas(master('c1-x', 'v1')) } }] } }] }] }
    expect(courseReferencesMedia(course, key, CONTAINER)).toBe(true)
  })
})
