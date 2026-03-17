const express = require('express')
const fs = require('node:fs')
const path = require('node:path')
const { pipeline } = require('node:stream/promises')
const tar = require('tar-stream')
const { BlobServiceClient } = require('@azure/storage-blob')
const { authenticate, requirePermission } = require('../../middleware/auth')

const router = express.Router()

/** Fetch all CDN files across all pages */
async function fetchAllCdnFiles(cdnBase, cdnToken) {
  let allFiles = []
  let page = 1
  while (true) {
    const r = await fetch(`${cdnBase}/cdn/files?page=${page}`, {
      headers: { Authorization: `Bearer ${cdnToken}` },
    })
    if (!r.ok) throw new Error(`Failed to list CDN files (page ${page})`)
    const data = await r.json()
    allFiles = allFiles.concat(data.files)
    if (page >= data.totalPages) break
    page++
  }
  return allFiles
}

/** Create a tar archive of the given files and return the filepath */
async function buildMonthTar(month, files, cdnBase, cdnToken) {
  const filepath = path.join('/app', `cdn-${month}.tar`)
  const pack = tar.pack()
  const output = fs.createWriteStream(filepath)
  pack.pipe(output)

  for (const file of files) {
    const fileRes = await fetch(
      `${cdnBase}/cdn/download/${encodeURIComponent(file.filename)}`,
      { headers: { Authorization: `Bearer ${cdnToken}` } },
    )
    if (!fileRes.ok || fileRes.status === 204) continue

    const buffer = Buffer.from(await fileRes.arrayBuffer())
    await new Promise((resolve, reject) => {
      pack.entry({ name: file.filename, size: buffer.length }, buffer, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  pack.finalize()
  await new Promise((resolve, reject) => {
    output.on('finish', resolve)
    output.on('error', reject)
  })

  return filepath
}

/** GET /cdn/search?q= — search across all CDN files by filename */
router.get('/cdn/search', authenticate, requirePermission('hub.cdn', 'read'), async (req, res) => {
  const CDN_BASE = process.env.CDN_BASE
  const CDN_TOKEN = process.env.CDN_ADMIN_TOKEN
  const q = (req.query.q ?? '').toLowerCase().trim()

  if (!CDN_BASE || !CDN_TOKEN) {
    return res.status(500).json({ message: 'CDN not configured on server.' })
  }

  try {
    const allFiles = await fetchAllCdnFiles(CDN_BASE, CDN_TOKEN)
    const filtered = q ? allFiles.filter((f) => f.filename.toLowerCase().includes(q)) : allFiles
    res.json({ files: filtered, totalFiles: filtered.length })
  } catch (err) {
    console.error('[cdn/search] error:', err)
    res.status(500).json({ message: 'Search failed', error: err.message })
  }
})

/** GET /cdn/export/months — list available months with file counts */
router.get('/cdn/export/months', authenticate, requirePermission('hub.cdn', 'read'), async (req, res) => {
  const CDN_BASE = process.env.CDN_BASE
  const CDN_TOKEN = process.env.CDN_ADMIN_TOKEN

  if (!CDN_BASE || !CDN_TOKEN) {
    return res.status(500).json({ message: 'CDN not configured on server.' })
  }

  try {
    const allFiles = await fetchAllCdnFiles(CDN_BASE, CDN_TOKEN)

    const monthMap = {}
    for (const file of allFiles) {
      const month = file.lastModified.slice(0, 7) // "YYYY-MM"
      if (!monthMap[month]) monthMap[month] = { month, fileCount: 0, totalSize: 0 }
      monthMap[month].fileCount++
      monthMap[month].totalSize += file.size
    }

    const months = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month))
    res.json({ months })
  } catch (err) {
    console.error('[cdn/export/months] error:', err)
    res.status(500).json({ message: 'Failed to list months', error: err.message })
  }
})

/** GET /cdn/export?month=YYYY-MM — download a tar of that month's files */
router.get('/cdn/export', authenticate, requirePermission('hub.cdn', 'read'), async (req, res) => {
  const CDN_BASE = process.env.CDN_BASE
  const CDN_TOKEN = process.env.CDN_ADMIN_TOKEN
  const { month } = req.query

  if (!CDN_BASE || !CDN_TOKEN) {
    return res.status(500).json({ message: 'CDN not configured on server.' })
  }
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: 'month query param required (YYYY-MM)' })
  }

  let filepath
  try {
    const allFiles = await fetchAllCdnFiles(CDN_BASE, CDN_TOKEN)
    const monthFiles = allFiles.filter((f) => f.lastModified.startsWith(month))

    if (monthFiles.length === 0) {
      return res.status(404).json({ message: `No files found for ${month}` })
    }

    console.log(`[cdn/export] Archiving ${monthFiles.length} files for ${month}…`)
    filepath = await buildMonthTar(month, monthFiles, CDN_BASE, CDN_TOKEN)

    const stat = fs.statSync(filepath)
    console.log(`[cdn/export] Tar for ${month} ready (${(stat.size / 1_000_000).toFixed(1)} MB), streaming…`)
    res.setHeader('Content-Disposition', `attachment; filename="cdn-${month}.tar"`)
    res.setHeader('Content-Type', 'application/x-tar')
    res.setHeader('Content-Length', stat.size)
    await pipeline(fs.createReadStream(filepath), res)
  } catch (err) {
    console.error('[cdn/export] error:', err)
    if (!res.headersSent) {
      res.status(500).json({ message: 'Export failed', error: err.message })
    }
  } finally {
    if (filepath) fs.unlink(filepath, () => {})
  }
})

/** POST /cdn/backup?month=YYYY-MM — create tar and upload to Azure Blob Storage */
router.post('/cdn/backup', authenticate, requirePermission('hub.cdn', 'read'), async (req, res) => {
  const CDN_BASE = process.env.CDN_BASE
  const CDN_TOKEN = process.env.CDN_ADMIN_TOKEN
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  const containerName = process.env.AZURE_CONTAINER
  const { month } = req.query

  if (!CDN_BASE || !CDN_TOKEN) {
    return res.status(500).json({ message: 'CDN not configured on server.' })
  }
  if (!connectionString || !containerName) {
    return res.status(500).json({ message: 'Azure storage not configured.' })
  }
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: 'month query param required (YYYY-MM)' })
  }

  let filepath
  try {
    const allFiles = await fetchAllCdnFiles(CDN_BASE, CDN_TOKEN)
    const monthFiles = allFiles.filter((f) => f.lastModified.startsWith(month))

    if (monthFiles.length === 0) {
      return res.status(404).json({ message: `No files found for ${month}` })
    }

    console.log(`[cdn/backup] Archiving ${monthFiles.length} files for ${month}…`)
    filepath = await buildMonthTar(month, monthFiles, CDN_BASE, CDN_TOKEN)

    const stat = fs.statSync(filepath)
    console.log(`[cdn/backup] Tar ready (${(stat.size / 1_000_000).toFixed(1)} MB), uploading to Azure…`)

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blobName = `cdn_backup/cdn-${month}.tar`
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.uploadFile(filepath, {
      blobHTTPHeaders: { blobContentType: 'application/x-tar' },
      overwrite: true,
    })

    console.log(`[cdn/backup] Uploaded ${blobName} (${(stat.size / 1_000_000).toFixed(1)} MB)`)
    res.json({ message: `Backed up ${month} (${monthFiles.length} files, ${(stat.size / 1_000_000).toFixed(1)} MB)` })
  } catch (err) {
    console.error('[cdn/backup] error:', err)
    if (!res.headersSent) {
      res.status(500).json({ message: 'Backup failed', error: err.message })
    }
  } finally {
    if (filepath) fs.unlink(filepath, () => {})
  }
})

module.exports = router
