const { BlobServiceClient } = require('@azure/storage-blob')
const { jobs } = require('./video-jobs')
const { HLS_MASTER_RE } = require('./media-references')

function getContainerClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  const containerName = process.env.AZURE_CONTAINER
  if (!connectionString || !containerName) throw new Error('Azure storage not configured.')
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  return blobServiceClient.getContainerClient(containerName)
}

/**
 * Deletes a media item. `blobPath` is the fullPath shown in the media list.
 * For a plain file that's a single blob delete. For an HLS video it's the
 * master.m3u8 blob — deleting it alone would orphan every per-rendition
 * index.m3u8 and .ts segment, so instead we delete every blob under that
 * video's shared prefix (academy/{folder}/videos/{videoId}/), i.e. the whole
 * transcoded group.
 */
async function deleteMediaAtPath(blobPath) {
  const containerClient = getContainerClient()
  const masterMatch = blobPath.match(HLS_MASTER_RE)

  if (masterMatch) {
    const videoId = masterMatch[1]
    // blobPath is ".../videos/{videoId}/master.m3u8" — videoDir is the
    // directory one level up, whose contents (master + quality dirs +
    // playlists + segments) all share this prefix.
    const videoDir = blobPath.slice(0, -'/master.m3u8'.length)
    const childPrefix = `${videoDir}/`

    const childNames = []
    for await (const blob of containerClient.listBlobsFlat({ prefix: childPrefix })) {
      childNames.push(blob.name)
    }
    // On a Hierarchical Namespace account, each quality-dir (e.g. .../240p)
    // is itself a real, zero-length blob alongside its segment files, and
    // the delete API refuses to remove a directory that still has
    // children. listBlobsFlat returns them in lexicographic order, which
    // puts a directory *before* its contents (a prefix sorts first), so
    // delete deepest paths first to guarantee children are gone before
    // their containing directory placeholder is attempted.
    childNames.sort((a, b) => b.length - a.length)
    for (const name of childNames) {
      await containerClient.getBlockBlobClient(name).deleteIfExists()
    }
    // Finally the videoId directory placeholder itself, if this account
    // has Hierarchical Namespace enabled — harmless no-op otherwise.
    await containerClient.getBlockBlobClient(videoDir).deleteIfExists()
    jobs.delete(videoId)
  } else {
    await containerClient.getBlockBlobClient(blobPath).deleteIfExists()
  }
}

module.exports = { HLS_MASTER_RE, getContainerClient, deleteMediaAtPath }
