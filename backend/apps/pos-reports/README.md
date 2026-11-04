# POS daily reports

Desk -> The Hub -> POS Daily Reports. Uses existing `hub.shifts.read` for
viewing and `hub.shifts.update` for scans, site settings, and acceptance.
The existing Hub Shifts page is unchanged.

## Server setup

1. In Desk's **root** `.env`, set `POS_FTP_DATA_DIR` to the FTP deployment's
   absolute `data` path and `POS_FTP_ARCHIVE_DIR` to its sibling `archive` path.
   See the root `.env.pos.example`. Do not put these Compose host variables only
   in `backend/.env`. The two existing Compose files mount both directories.
   Their defaults, `./pos/data` and `./pos/archive`, are for local development.
2. On Ubuntu, create the archive and give Desk's backend user (UID 1001 in
   `backend/Dockerfile`) read/write/traverse access. For example, with your real
   paths substituted:

   ```sh
   sudo mkdir -p /opt/ftp/archive
   sudo chown 1001:1001 /opt/ftp/archive
   sudo chmod 750 /opt/ftp/archive
   sudo apt-get install -y acl
   sudo setfacl -R -m u:1001:rwX /opt/ftp/data
   sudo find /opt/ftp/data -type d -exec setfacl -m d:u:1001:rwx {} +
   ```

   Reapply/check the data ACL after recreating FTP users or adding a site:
   the FTP startup script sets home-directory permissions and ownership.
   Verify new uploads can be read and removed by UID 1001. FTP itself should
   mount only `./data:/ftp`, keeping `archive` inaccessible to FTP accounts.
3. The backend reads locations from `https://app.gen7fuel.com/api/locations`,
   the same public read endpoint used by Desk's SitePicker. No Hub MongoDB
   credentials, extra environment variable, or deployment secret is required.
   Only `_id`, names, and `timezone` are retained. Reads have a 10-second timeout
   and a one-minute in-memory cache, with concurrent requests sharing one fetch.
   Failed/invalid responses are not cached and expired values are not used to
   import or accept reports. Burlington always uses `America/Toronto` and works
   independently of Hub. Other sites need a Hub location with a valid IANA timezone.
   If you previously configured `POS_LOCATIONS_MONGO_URI`, it can be removed.
4. Rebuild/deploy Desk and recreate the API container with the updated Compose.
   Add future site's FTP credentials separately, then add its site ID, directory,
   location, and StoreLocationIDs in the report page's Site configuration.
   Site configuration maps folders; it does not provision FTP accounts.

Do not upload directly over existing XML filenames. Prefer uploading with a
temporary non-XML extension and renaming after completion. The importer waits
30 seconds after modification and checks file metadata while reading. A stable
file age alone cannot establish that an arbitrary FTP writer has closed a file.

## Import and date rules

The backend scans configured site directories recursively every 60 seconds,
with a manual Refresh files button. No live FTP credentials are needed by Desk:
it reads the shared filesystem. Unknown directories, unmapped StoreLocationIDs,
malformed XML, unsupported line content, and conflicting versions of a
transaction remain in place and are surfaced as import issues. Young uploads
wait for a later scan. A site's unresolved import errors block acceptance.

Reports use event **completion date**, never `BusinessDate` or filename time.
SmartPOS's offset-free timestamps are interpreted as local wall time in the
site's timezone. Explicit offsets, if present, are converted to that timezone.
A transaction crossing midnight belongs entirely to the completion day.
Events deduplicate by store/register/till/business-date/transaction/type/sequence.
A second version of the same event with different data is flagged, not silently
substituted. Voids, training/suspended sales, and corrected lines are excluded
from sales totals. Operational events remain visible.

All money uses integer cents; quantities remain numeric. Transaction summary
tax is authoritative. Item tax mismatches are nonblocking reconciliation notes;
per-unit tax is suggested only when quantity multiplication explains the total.
Item tax is never silently rewritten. Sales are labeled by presence/absence of
item tax records, rather than asserting tax exemption. Promotions/discounts keep
their raw POS signs, are already included in sales, and are not subtracted twice.
Summary, active-item sales, or tender reconciliation failures block acceptance.

## Acceptance and recovery

The client submits the reviewed content hash and accepted revision. Acceptance
rescans first; new events cause 409 and require reviewing the new totals. A
Mongo lease serializes import/settings/accept operations. Accepted totals,
source manifest, event hashes, actor, time, and revision are persisted before
any source deletion. Each imported event also remains stored in MongoDB.

Files archive to `<POS_ARCHIVE_DIR>/<site-id>/<completion-day>/<sha256>.xml`.
The original path and archive location remain in the source-file collection.
Files covering multiple days use the earliest completion day and stay in FTP
until **all** their events are covered by accepted reports. Safe drops and
cashier close events are preserved with their day's other events.

Archive writes publish a completed temporary file without overwriting another
archive. Its content hash is checked, and the source is rechecked before
removal. A source changed after import is left in place with an error. Archive
failures leave the accepted report intact, show errors, and allow Retry archive.
If a process stops after removal but before updating MongoDB, the next retry
verifies the archived copy and completes the bookkeeping. Interrupted acceptance
history writes are likewise recovered before the next acceptance.

Late new events change an accepted report to `needs-review`; only explicitly
accepting the revised totals creates the next acceptance revision and archives
those files. Identical retransmissions do not change totals or revisions.

The filesystem and MongoDB should both be included in normal server backups.
No deployment, live data acceptance, or production archiving is performed by
the local development/test commands.

## Locations HTTP verification

The consumer contract and a synthetic local mock are in
`postman/contracts/hub-locations.openapi.yaml` and `postman/mocks/hub-locations`.
From the repository root, start the simulation and run the real caller:

```sh
postman simulation run postman/simulations/pos-locations.sim.yaml --port 4187 --no-history
# In another terminal:
node scripts/verify-pos-locations.cjs http://127.0.0.1:4187
```

If the local Postman runtime is unavailable, a self-contained HTTP fixture
exercises the same success, HTTP error, and timeout caller paths:

```sh
node scripts/verify-pos-locations.cjs --local-fixture
```

This checks the real HTTP client and site timezone resolver with a synthetic
site model read. It does not establish live Hub connectivity or Mongo durability.
The simulation context records the evidence and local runner limitation.
