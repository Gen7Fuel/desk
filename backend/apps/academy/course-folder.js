// Computes the Azure Blob folder a course's uploaded media (videos, images)
// is stored under, so everything for a given course lives together and is
// easy to find in the Azure portal.
//
// Uploads made without course context (e.g. from the standalone Academy
// Media library page, or before a new course has been saved) fall back to
// a shared "_library" folder.
//
// The folder is always derived server-side from courseId + courseTitle —
// never trust a pre-built folder string from the client — so it stays
// consistent between the upload call and later status polls.

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function courseFolder(courseId, courseTitle) {
  if (!courseId) return '_library'
  const slug = slugify(courseTitle) || 'untitled'
  return `${courseId}-${slug}`
}

module.exports = { courseFolder }
