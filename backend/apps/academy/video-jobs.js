// Shared in-memory job store for async video transcoding jobs.
// Scoped to the process — lost on restart. The status endpoint falls back
// to checking Azure Blob Storage if a jobId isn't found here.
const jobs = new Map()

module.exports = { jobs }
