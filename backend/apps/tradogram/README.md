# Tradogram delivery preparation and Intacct drafts

Open Hub > Intacct > Tradogram. The backend defaults to entity A210 / Gen7 LP;
the deployment workflow explicitly sets A210. An explicit backend
TRADOGRAM_SAGE_ENTITY_ID=T010 remains available for isolated testing.
Construction site names are separate from the integration company.

Required server configuration: TRADOGRAM_API_KEY, SAGE_CLIENT_ID,
SAGE_CLIENT_SECRET, the existing Mongo connection, and optionally SAGE_USERNAME.
No credentials belong in frontend settings. Apply the existing deployment
workflow and restart/recreate the backend to activate configuration changes.

## Workflow

1. Book a received delivery in Tradogram. Its PO must be In Delivery,
   Fully Received or Closed. Set the supplier Account Number to the Intacct
   vendor ID in the configured company.
2. Save site account mappings in Desk. Review each received line's active
   Loan or Inventory account and save/mark the delivery Ready for Intacct.
3. In Create Intacct draft bill, review the bill number, invoice date and due
   date. Initial dates use the receipt date and must be checked against the
   supplier invoice; posting date equals invoice date. The bill number defaults
   to the supplier reference plus delivery code to distinguish partial receipts.
4. Select Preview Intacct draft. Review the company, vendor, site, received
   quantities, GL accounts and amounts. Only CAD and positive reconciled
   received subtotals are supported. Source amounts cannot be edited here.
5. Confirm that tax, fees and discounts will be reviewed in Intacct, then
   select Create Intacct draft bill. The bill is sent with state=draft, never
   submitted or posted. No payment is created. Tradogram remains read-only.
6. Desk displays the Intacct reference and marks the delivery Intacct draft
   created. Review the draft's full accounting/tax details in Intacct before
   posting it there. This implementation omits tax solution/details instead of
   guessing the allocation of full-PO tax to partial deliveries. A210's acceptance
   of these incomplete tax details still requires a live draft smoke test.

The API extension is documented in tradogram.openapi.yaml. Both POST routes
require hub.intacct.read and hub.intacct.update. Creation requires a saved ready
delivery, a current preview hash and explicit subtotal acknowledgment. Changes
to the source, vendor, company, saved revision, GL mapping or bill fields require
a fresh review/preview. Existing successful submissions return the saved key.

## Duplicate prevention and reconciliation

An atomic Mongo update locks the delivery revision before sending. A unique
partial index reserves entity/vendor/case-normalized bill number across
deliveries; model initialization must succeed before any bill write. An Intacct
vendor/bill-number lookup checks bills created outside this module. Concurrent
external integrations can still race that lookup; there is no assumed provider
idempotency guarantee. Use distinct numbers for separate receipts.

Saving delivery preparation is blocked while creation is in progress, uncertain
or successful. Explicit Intacct validation rejection allows a new preview and
retry. No request is automatically retried. A timeout, malformed successful
response, or failed local persistence after creation leaves a blocked attempt.
A process crash while creating also remains blocked; it is never reset by age.

For a blocked attempt, an administrator must check A210 using the bill number,
vendor and Tradogram delivery reference. If a bill exists, verify it and record
its key/entity/state in the corresponding TradogramDeliveryDraft. Only after
confirming no bill exists should the administrator move intacctCreationState
to failed, keeping the reservation fields for the audit trail. Do not clear
the lock solely because the original request timed out. No automatic unlock
or user-facing reconciliation endpoint is provided.

## Verification

Run `npx vitest run apps/tradogram` from backend and
`npx vitest run src/lib/tradogram-draft-bill.test.tsx src/lib/tradogram-workflow.test.tsx src/lib/tradogram-accounts.test.ts`
from frontend. Draft tests use the real Intacct HTTP client against the local
synthetic handler, with an in-memory repository and normalized Tradogram
fixtures. They exercise authorization, stale reviews, duplicate/concurrent
submission, validation rejection, timeout-after-write and persistence failures.
They do not establish live Mongo index behavior or live A210 tax/account setup.

For the Postman simulation, run
`postman simulation run postman/simulations/tradogram.sim.yaml --port 4191 --output ndjson --no-history`
from the repo root. Set TRADOGRAM_SIM_URL to http://127.0.0.1:4191/sage/ when
running backend/apps/tradogram/tradogram.drafts.test.js to include the simulation
smoke test. All credentials there are synthetic. No production bills are
created by these tests. See postman/simulations/tradogram.context.yaml for limits.
