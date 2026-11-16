// Separate process: never starts Desk's API, POS importer, or other schedulers.
const { tick } = require('./cdn.backup')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function main() {
  console.log('[cdn-backup] Worker started; daily 02:00 America/Toronto; checking manual requests every 30 seconds')
  do {
    try {
      const result = await tick()
      if (!result.idle && !result.busy) console.log('[cdn-backup] Verified backup completed', JSON.stringify(result))
    } catch (err) {
      // Avoid logging Azure URLs, credentials or provider request objects.
      console.error('[cdn-backup] Backup failed', err.name, err.code || '', 'Will retry; inspect Desk CDN Panel for status')
      if (process.argv.includes('--once')) process.exitCode = 1
    }
    if (process.argv.includes('--once')) break
    await sleep(30000)
  } while (true)
}
main().catch(() => { console.error('[cdn-backup] Worker stopped unexpectedly'); process.exitCode = 1 })
