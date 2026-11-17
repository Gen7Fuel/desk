# CDN backup operations

Desk's dedicated cdn-backup Compose worker backs up the current UTC file month daily after 02:00 America/Toronto. It catches up after downtime, uses the Toronto calendar (including daylight saving), and verifies/finalizes the preceding month once per month. The worker does not start the Desk API or POS importer. No Hub maintenance is required.

Manual POST /api/cdn/backup?month=YYYY-MM now returns 202 with a durable request ID, rather than holding the HTTP connection for the archive. Existing Desk UI reads the message; the panel polls authenticated GET /api/cdn/backup/status every 15 seconds. Both routes retain hub.cdn/read authorization. Requests survive API/worker restarts and share the same renewable, 60-second Azure blob lease with scheduled work. Writes to status are fenced by the lease ID. Manual failures retry up to three attempts, 15 minutes apart. Scheduled failures retry after 15 minutes; duplicate success on a Toronto calendar day is suppressed by durable status.

By default, storage uses Desk's existing AZURE_STORAGE_CONNECTION_STRING and AZURE_CONTAINER. The optional CDN_BACKUP_SOURCE settings can select a separate read-only live source while archives and control remain here; see cdn-backup-source-migration.md. Without those settings, source is the live cdn/ prefix in the same private container; it does not use the old VPS uploads volume. Live CDN objects are read only. Archives live under cdn_backup/automated/daily/YYYY-MM-DD/UUID/ and permanent manual/completed-month archives under cdn_backup/automated/monthly/YYYY-MM-DD/UUID/. Existing cdn_backup/cdn-YYYY-MM.tar archives are never overwritten or expired by this job.

Each archive preserves originalmtime, includes .cdn-backup-manifest.json, and has a JSON completion sidecar with original filename, size, content type, ETag, SHA-256, and date for every file. Each source GET is pinned to its inventory ETag. Missing/changed/download-failed files abort the backup. The full uploaded TAR is downloaded under its upload ETag and SHA-256 checked before publishing the completion marker and lastSuccess. This is a start-of-run inventory, not an atomic snapshot: new uploads after enumeration are covered by the next run. No maintenance window is needed.

Only verified daily TAR/sidecar pairs older than 30 days are expired, following a successful scheduled backup. Monthly copies remain permanently. Failed partial TARs are not counted as backups and are retained for investigation; periodic orphan cleanup is not implemented. Failed runs keep lastSuccess. Status exposes failure, age, and worker check-in; worker logs are in docker logs desk-cdn-backup. No email recipient was configured, so alerts are visible in Desk and server logs, not email. The Azure account is shared with source files: these archives protect against file-level loss but not account compromise/deletion. Independent-account/offsite backup and soft delete remain separate recovery improvements.

Deployment: the normal Desk pipeline starts cdn-backup using the same backend image after the API passes its health check. docker compose stop cdn-backup disables automation without changing Hub traffic. On restart the worker retries an unfinished request/date after the prior lease expires (up to 60 seconds). The daily worker's first run also establishes a verified previous-month archive, which can take longer than normal daily runs. Temporary TARs use unique system-temp directories and are removed after success or failure; provision free disk greater than the largest source month.

Restore: select a sidecar with verifiedAt, verify archive byte length and SHA-256, extract in an isolated directory with path validation, and check each manifest file's SHA-256. Upload into an isolated restore prefix, setting originalmtime and sha256 metadata and content type from the manifest. Verify downloads before any authorized live restore. Never blindly extract into the running application or overwrite the live cdn/ prefix.

Validation: npm run test:cdn-backup in backend checks restored bytes and dates, corrupt readback, missing source, overlap, retry, Toronto DST schedule, month finalization, and retention boundaries. scripts/verify-cdn-backup-outage.cjs runs the real Azure SDK against postman/simulations/cdn-backup.sim.yaml. Start with postman simulation run postman/simulations/cdn-backup.sim.yaml --port 4198 --output ndjson --no-history, then set CDN_BACKUP_SIMULATION_URL=http://127.0.0.1:4198 for the check.
# Separate live source preparation

See [CDN backup source migration](cdn-backup-source-migration.md) for the optional
Entra reader and unchanged archive/control destination. This is prepared code;
the running worker remains on its original source until coordinated cutover.


## Interrupted archive readback

The worker verifies uploaded archives with sequential ranges of at most 8 MiB,
each pinned to the upload ETag. A transient abort, reset, timeout, 408, 429 or 5xx
retries only the unfinished range, up to four attempts. A partially downloaded
range is discarded before hashing. All bytes must still produce the original
SHA-256 before a completion receipt is published. Changed ETags, access denial,
corruption and lease loss fail without claiming success.

Failures expose only a fixed backup stage (source-read, archive-upload,
archive-readback, completion-receipt, or control), exception type and code.
Provider URLs and private file inventories are not logged. Existing durable
requests and previous successful archives remain in place after failure.
