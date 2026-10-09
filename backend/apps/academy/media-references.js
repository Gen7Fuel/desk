// Pure helpers for deciding whether a stored video can be safely deleted.
// No Azure or network access here — see course.routes.js for the endpoint.

// Matches the master playlist of an HLS video in both the legacy flat layout
// (academy/videos/{id}/master.m3u8) and the per-course layout
// (academy/{courseFolder}/videos/{id}/master.m3u8).
const HLS_MASTER_RE = /^academy\/(?:[^/]+\/)?videos\/([^/]+)\/master\.m3u8$/

// Any blob inside an HLS video's directory (master, quality playlists, segments).
const HLS_DIR_RE = /^(academy\/(?:[^/]+\/)?videos\/[^/]+)\//

/**
 * The blob path inside the container for a storage URL (a SAS URL as saved on a
 * course item), or null when the string isn't a URL into this container.
 */
function blobPathFromUrl(url, containerName) {
  if (typeof url !== 'string' || !containerName) return null
  try {
    const pathname = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '')
    const prefix = `${containerName}/`
    return pathname.startsWith(prefix) ? pathname.slice(prefix.length) : null
  } catch {
    return null
  }
}

/**
 * Uploads are stored under academy/{courseId}-{slug}/ (see course-folder.js).
 * Match on the id prefix rather than the slug, which changes with the title.
 */
function isCourseOwnedPath(blobPath, courseId) {
  return !!courseId && blobPath.startsWith(`academy/${courseId}-`) && blobPath.includes('/', `academy/${courseId}-`.length)
}

/**
 * What identifies "the same media" across URLs (each SAS URL differs): the
 * whole video directory for HLS, otherwise the blob path itself.
 */
function mediaKey(blobPath) {
  const dir = HLS_DIR_RE.exec(blobPath)
  return dir ? dir[1] : blobPath
}

function collectStrings(value, out) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out))
}

/** True when any string anywhere in the course points at the same media. */
function courseReferencesMedia(course, key, containerName) {
  const strings = []
  collectStrings(course?.sections, strings)
  collectStrings(course?.thumbnail, strings)
  return strings.some((s) => {
    const path = blobPathFromUrl(s, containerName)
    return path !== null && mediaKey(path) === key
  })
}

module.exports = { HLS_MASTER_RE, blobPathFromUrl, isCourseOwnedPath, mediaKey, courseReferencesMedia }
