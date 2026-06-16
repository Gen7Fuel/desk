const path = require('path')
const fs = require('fs')
const express = require('express')
const multer = require('multer')
const ffmpeg = require('fluent-ffmpeg')
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob')
const { authenticate, requirePermission } = require('../../middleware/auth')
const { jobs } = require('./video-jobs')

const router = express.Router()

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || 'ffmpeg')

const UPLOADS_TMP = path.join('/app', 'uploads-tmp')

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(UPLOADS_TMP, { recursive: true })
      cb(null, UPLOADS_TMP)
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`)
    },
  }),
})

const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
  'video/ogg',
])

const RENDITIONS = [
  { height: 240, bitrate: 300 },
  { height: 480, bitrate: 800 },
  { height: 720, bitrate: 1500 },
]

const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

function getContainerClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  const containerName = process.env.AZURE_CONTAINER
  if (!connectionString || !containerName) throw new Error('Azure storage not configured.')
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  return blobServiceClient.getContainerClient(containerName)
}

function generateSasUrl(blockBlobClient, expiresInMs) {
  return blockBlobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse('r'),
    expiresOn: new Date(Date.now() + expiresInMs),
  })
}

function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const videoStream = metadata.streams.find((s) => s.codec_type === 'video')
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio')
      resolve({
        height: videoStream?.height ?? 0,
        hasAudio: !!audioStream,
      })
    })
  })
}

function transcodeRendition(inputPath, qualityDir, rendition, hasAudio) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(qualityDir, { recursive: true })
    const cmd = ffmpeg(inputPath)
      .videoCodec('libx264')
      .size(`?x${rendition.height}`)
      .videoBitrate(rendition.bitrate)
      .outputOptions([
        '-hls_time 6',
        '-hls_list_size 0',
        '-hls_segment_type mpegts',
        `-hls_segment_filename ${path.join(qualityDir, 'seg%03d.ts')}`,
        '-f hls',
      ])

    if (hasAudio) {
      cmd.audioCodec('aac')
    } else {
      cmd.outputOptions(['-an'])
    }

    cmd
      .output(path.join(qualityDir, 'index.m3u8'))
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
}

async function uploadInBatches(items, batchSize, fn) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn))
  }
}

async function transcodeToHls(jobId, videoId, tempFilePath, originalName) {
  const outputDir = path.join('/app', 'hls-tmp', jobId)
  try {
    fs.mkdirSync(outputDir, { recursive: true })

    const containerClient = getContainerClient()

    // Probe source video
    const { height: sourceHeight, hasAudio } = await probeVideo(tempFilePath)
    const renditions = RENDITIONS.filter((r) => r.height <= sourceHeight)
    if (renditions.length === 0) renditions.push(RENDITIONS[0])

    // Transcode each rendition sequentially (FFmpeg is multi-threaded internally)
    for (const rendition of renditions) {
      const qualityDir = path.join(outputDir, `${rendition.height}p`)
      await transcodeRendition(tempFilePath, qualityDir, rendition, hasAudio)
    }

    // Upload segments for each rendition and rewrite quality playlists
    const qualitySasUrls = {}

    for (const rendition of renditions) {
      const qualityLabel = `${rendition.height}p`
      const qualityDir = path.join(outputDir, qualityLabel)
      const blobPrefix = `academy/videos/${videoId}/${qualityLabel}`

      // Collect segment files
      const segFiles = fs
        .readdirSync(qualityDir)
        .filter((f) => f.endsWith('.ts'))
        .sort()

      // Upload segments in batches, collect SAS URLs keyed by filename
      const segSasMap = {}
      await uploadInBatches(segFiles, 10, async (segFile) => {
        const blobName = `${blobPrefix}/${segFile}`
        const blockBlobClient = containerClient.getBlockBlobClient(blobName)
        await blockBlobClient.uploadFile(path.join(qualityDir, segFile), {
          blobHTTPHeaders: { blobContentType: 'video/MP2T' },
          overwrite: true,
        })
        segSasMap[segFile] = await generateSasUrl(blockBlobClient, TEN_YEARS_MS)
      })

      // Rewrite quality playlist: replace segment filenames with absolute SAS URLs
      const playlistPath = path.join(qualityDir, 'index.m3u8')
      const lines = fs.readFileSync(playlistPath, 'utf8').split('\n')
      const rewritten = lines.map((line) => {
        const trimmed = line.trim()
        if (trimmed.endsWith('.ts') && segSasMap[trimmed]) {
          return segSasMap[trimmed]
        }
        return line
      })
      const rewrittenPlaylist = rewritten.join('\n')

      // Upload rewritten quality playlist
      const playlistBlobName = `${blobPrefix}/index.m3u8`
      const playlistBlobClient = containerClient.getBlockBlobClient(playlistBlobName)
      await playlistBlobClient.uploadData(Buffer.from(rewrittenPlaylist), {
        blobHTTPHeaders: { blobContentType: 'application/vnd.apple.mpegurl' },
        overwrite: true,
      })
      qualitySasUrls[qualityLabel] = await generateSasUrl(playlistBlobClient, TEN_YEARS_MS)
    }

    // Build and upload master playlist with absolute quality playlist SAS URLs
    const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3']
    for (const rendition of renditions) {
      const qualityLabel = `${rendition.height}p`
      const bandwidth = rendition.bitrate * 1000
      masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth}`)
      masterLines.push(qualitySasUrls[qualityLabel])
    }
    const masterContent = masterLines.join('\n') + '\n'

    const masterBlobName = `academy/videos/${videoId}/master.m3u8`
    const masterBlobClient = containerClient.getBlockBlobClient(masterBlobName)
    await masterBlobClient.uploadData(Buffer.from(masterContent), {
      blobHTTPHeaders: { blobContentType: 'application/vnd.apple.mpegurl' },
      overwrite: true,
    })
    const masterSasUrl = await generateSasUrl(masterBlobClient, TEN_YEARS_MS)

    jobs.set(videoId, {
      status: 'ready',
      file: {
        name: videoId,
        fullPath: masterBlobName,
        size: Buffer.byteLength(masterContent),
        lastModified: new Date().toISOString(),
        contentType: 'application/vnd.apple.mpegurl',
        url: masterSasUrl,
        isHls: true,
      },
    })
  } catch (err) {
    console.error(`[academy/hls] transcoding failed for ${videoId}:`, err)
    jobs.set(videoId, { status: 'error', message: err.message })
  } finally {
    fs.rm(outputDir, { recursive: true, force: true }, () => {})
    fs.unlink(tempFilePath, () => {})
  }
}

// ── GET /media ────────────────────────────────────────────────────────────────

const HLS_SUBPATH_RE = /^academy\/videos\/([^/]+)\//
const HLS_MASTER_RE = /^academy\/videos\/([^/]+)\/master\.m3u8$/

router.get('/media', authenticate, requirePermission('academy.courses', 'read'), async (req, res) => {
  try {
    const containerClient = getContainerClient()
    const expiresOn = new Date(Date.now() + TWO_HOURS_MS)
    const files = []

    for await (const blob of containerClient.listBlobsFlat({ prefix: 'academy/' })) {
      const blobName = blob.name

      // Skip HLS sub-files (segments and quality playlists) — only show master.m3u8
      if (HLS_SUBPATH_RE.test(blobName) && !HLS_MASTER_RE.test(blobName)) continue

      const blockBlobClient = containerClient.getBlockBlobClient(blobName)
      const url = await blockBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse('r'),
        expiresOn,
      })

      const isHls = HLS_MASTER_RE.test(blobName)
      const displayName = isHls
        ? blobName.match(HLS_MASTER_RE)[1]
        : blobName.slice('academy/'.length)

      files.push({
        name: displayName,
        fullPath: blobName,
        size: blob.properties.contentLength ?? 0,
        lastModified: blob.properties.lastModified?.toISOString() ?? null,
        contentType: blob.properties.contentType ?? '',
        url,
        isHls,
      })
    }

    res.json({ files })
  } catch (err) {
    console.error('[academy/media] error:', err)
    res.status(500).json({ message: 'Failed to list media', error: err.message })
  }
})

// ── GET /media/sas ────────────────────────────────────────────────────────────

router.get('/media/sas', authenticate, requirePermission('academy.courses', 'update'), async (req, res) => {
  const blobPath = String(req.query.path || '').trim()
  if (!blobPath) return res.status(400).json({ message: 'path is required' })

  try {
    const containerClient = getContainerClient()
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
    const url = await generateSasUrl(blockBlobClient, TEN_YEARS_MS)
    res.json({ url })
  } catch (err) {
    console.error('[academy/media/sas] error:', err)
    res.status(500).json({ message: 'Failed to generate URL', error: err.message })
  }
})

// ── POST /media/upload ────────────────────────────────────────────────────────

router.post(
  '/media/upload',
  authenticate,
  requirePermission('academy.courses', 'update'),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file provided.' })

    const tempFilePath = req.file.path
    const mime = req.file.mimetype

    if (VIDEO_MIMES.has(mime)) {
      // Async HLS transcoding path
      const baseName = path
        .parse(req.file.originalname)
        .name.replace(/[^a-zA-Z0-9_-]/g, '_')
      const videoId = `${Date.now()}-${baseName}`

      jobs.set(videoId, { status: 'processing' })
      res.json({ jobId: videoId, videoId, status: 'processing' })

      // Fire and forget — transcodeToHls handles all cleanup
      transcodeToHls(videoId, videoId, tempFilePath, req.file.originalname)
    } else {
      // Synchronous path for non-video files (images, PDFs, etc.)
      try {
        const containerClient = getContainerClient()
        const blobName = `academy/${req.file.originalname}`
        const blockBlobClient = containerClient.getBlockBlobClient(blobName)

        const buffer = await fs.promises.readFile(tempFilePath)
        await blockBlobClient.uploadData(buffer, {
          blobHTTPHeaders: { blobContentType: mime },
          overwrite: true,
        })

        const url = await generateSasUrl(blockBlobClient, TWO_HOURS_MS)

        res.json({
          name: req.file.originalname,
          fullPath: blobName,
          size: req.file.size,
          lastModified: new Date().toISOString(),
          contentType: mime,
          url,
          isHls: false,
        })
      } catch (err) {
        console.error('[academy/media/upload] error:', err)
        res.status(500).json({ message: 'Upload failed', error: err.message })
      } finally {
        fs.unlink(tempFilePath, () => {})
      }
    }
  },
)

module.exports = router
