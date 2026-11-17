# CDN backup source migration

Prepared 17 November 2026. Local code only; no deployment, credential change,
source switch, backup interruption or production media writes performed.

Live reader follow-up on 17 November passed with the existing VPS principal:
client `8dec8f37-a249-4fd6-98e6-9643c7f87f5a`, tenant
`21634e14-74fa-410a-8886-4c3f808b58cb`. It already has Blob Data Contributor on
the new hub container for rollback; this is broader than a dedicated Reader
role. Reusing it couples backup access to that identity's credential rotation.
No new role, principal or credential was created. For the future five source
secrets, use these IDs and the existing Hub backend service principal secret
through the normal secure GitHub settings path; never paste it into chat.
Do not set those secrets until explicitly instructed during coordinated cutover.

The actual prepared reader/archiver ran inside the existing Linux Desk backup
image with credentials inherited only by the probe child process. New source
inventory listed 10,402 files / 34,253,603,616 bytes. A bounded real object read
passed its inventory ETag, size and copied SHA-256 checks. Archive construction,
source dates/provenance and readback passed against an in-memory destination.
Original backup status remained readable and succeeded. All production container
IDs/start times/environments stayed unchanged. Zero Azure writes occurred.
This verifies live source access and runtime compatibility, not an actual
cross-account archive upload or a full new-source recovery point. Full backup
coverage still requires the coordinated frozen delta and verified archive.

The backup worker can read live `cdn/` objects from a separate Entra-authenticated
account. Archives, completion markers, requests, renewable lease/status and
retention remain in the original `AZURE_STORAGE_CONNECTION_STRING` /
`AZURE_CONTAINER` destination. Academy, fuel invoices and other shared storage
callers keep those original settings. Do not globally repoint them.

All five **Desk repository GitHub Secrets** are optional as a group:

| Secret | Future value |
| --- | --- |
| `CDN_BACKUP_SOURCE_ACCOUNT` | `gen7erpmedia29b24248` |
| `CDN_BACKUP_SOURCE_CONTAINER` | `hub` |
| `CDN_BACKUP_SOURCE_TENANT_ID` | Tenant of the approved reader identity |
| `CDN_BACKUP_SOURCE_CLIENT_ID` | Approved reader application's client ID |
| `CDN_BACKUP_SOURCE_CLIENT_SECRET` | Approved reader application's secret |

Leave all five absent until coordinated cutover. Existing behavior uses the
original storage client for both source and destination. Partially configured
settings fail closed; a new source failure never falls back to old media.
Deployment writes the secrets to Desk's backend environment; both API and the
separate backup worker load that environment. Changing GitHub Secrets alone
does not alter a running container. Do not redeploy/recreate the backup worker
mid-archive: its durable retry starts an interrupted archive again.

The reader requires `Storage Blob Data Reader` at the **new hub container** (or
an explicitly reviewed existing identity with sufficient access). Provision or
select the identity, store its secret using the normal secure deployment path,
and verify list/read access before switching. No new reader principal, role,
secret was provisioned by this code preparation. The follow-up above verified
the existing rollback identity's live read access. Existing destination permissions remain necessary for archive
upload/readback, status leases, request handling and retention deletion.

Coordinate enablement with Hub's final frozen delta and public routing. Confirm
the worker is idle, then explicitly tell the user when to set these five secrets
and when to deploy. Do not trigger a general Desk deployment merely to set them
before the source is ready. `CDN_BASE` separately controls Desk's CDN admin HTTP
proxy and is not this direct-storage backup source. Hub's `CDN_SERVICE_URL` is a
separate secret in a separate repository.

Source container URLs (without SAS queries), source ETags, SHA-256 and original
modification dates are recorded in new archive manifests/completion receipts.
Existing receipts stay intact. When the source changes, the next eligible
scheduled tick after 02:00 Toronto runs even if today's old-source backup already
succeeded, and re-finalizes the previous month for the new source. Failure
preserves the old `lastSuccess` with a failed current state and a 15-minute retry.
Inspect `lastSuccess.source` / `lastScheduledSource` in authenticated status;
an earlier old-source success is not proof of new-source coverage. Existing
legacy receipts do not acquire provenance retroactively. A source switch before
02:00 waits for the normal schedule unless a manual month request is queued.

For a host rollback that continues using the same new media account, **keep the
backup source unchanged**. Backups read Blob storage directly, independent of
Azure/VPS CDN hosting. Archive storage remains original, providing account
separation from the new live media; both accounts still require availability.

Validation completed:

- `node --test backend/apps/cdn/cdn.backup.checks.cjs`: 12 pass, including split
  source/destination, source provenance, same-day switch, failure/retry and
  unchanged source data. Existing archive restore/readback checks still pass.
- `cd backend; npm test`: 29 files, 241 tests pass.
- Postman local simulation plus actual Azure SDK: lock PUT 503 and migrated
  source inventory GET 503 both reject; prior success retained, no archive
  published. Destination in the source-outage test is an in-memory fixture.
- Dependency audit reports four existing advisories (fast-xml-parser,
  minimatch/nodemon, xlsx). The added direct identity dependency uses the same
  version already present in the baseline lockfile; package versions unchanged.

Run outage checks against the existing simulation on localhost:

```powershell
postman simulation run postman/simulations/cdn-backup.sim.yaml --port 4198 --output ndjson --no-history
# In another terminal:
$env:CDN_BACKUP_SIMULATION_URL='http://localhost:4198'
node scripts/verify-cdn-backup-outage.cjs
node scripts/verify-cdn-backup-source-outage.cjs
```

The installed CLI does not support `postman status`; owner mock discovery was
not available through that command. Reused the existing local outage mock.
The outage checks establish caller behavior under simulated failure; the live
follow-up above separately verifies successful source access. Neither creates
a full new-source production recovery point. Complete the frozen backup and
readback before treating the new source as backed up.
