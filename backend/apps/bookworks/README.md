# Bookworks AP invoice lookup

The Hub > Intacct > Bookworks searches by **exact vendor invoice number**.
Users select a result to inspect vendor details, dates, posting status, amount,
and GL distributions. Different vendors can use the same invoice number.
Users with hub.intacct.update can also create draft AP bills in Intacct; Bookworks remains read-only.

Set these variables in the backend environment (local `backend/.env`, or the
server's existing backend environment file):

```dotenv
BOOKWORKS_API_URL=https://your-bookworks-server.example
BOOKWORKS_PUBLIC_KEY=your-public-key
BOOKWORKS_PRIVATE_KEY=your-private-key
```

These are server-only settings. Never use frontend/VITE variables for either key.
Restart/recreate the backend after changing its environment. Production requires
HTTPS; HTTP is allowed only by an explicit internal client option used in tests.

`GET /api/bookworks/invoices?invoiceNumber=TEST-100&offset=0` requires a Desk
Bearer token and `hub.intacct.read`, enforced on the server. Blank/oversized
invoice numbers and invalid offsets are rejected before upstream requests.
Pages contain up to 25 invoices; `hasMore` means a full page was returned and
the next page may be empty. Responses have `Cache-Control: no-store`.
Bookworks provides no currency field on this object, so amounts are displayed
without an invented currency code. Accounting dates retain their source day.

Bookworks calls use GET **with a JSON body**, via Node's HTTP client. Each call
generates a new APIKey: AES-256-CBC/PKCS7 of public key + UTC `yyyyMMddHHmmss`.
The UTF-8 private key is truncated/zero-padded to 32 bytes; its first 16 bytes
are the IV. Only Base64 ciphertext is sent in the APIKey header. Requests are
bounded to 15 seconds and responses to 2 MiB, with no automatic retry or redirect.
Timeouts return 504; other upstream failures return sanitized 502/503 responses.
Vendor lookup failures retain the invoice with a warning and vendor-code fallback.

Provider references:
- https://bookworks.keyinfotech.com/api/openapi/v1.json
- https://documenter.getpostman.com/view/7461782/2sAYJAdxLW

Verification: `cd backend && npx vitest run apps/bookworks/bookworks.routes.test.js`
uses the real HTTP client against the synthetic mock in
`postman/mocks/bookworks/default.js`, including dependency failures. The same mock
can run using `postman simulation run postman/simulations/bookworks.sim.yaml --port 4188`.
Synthetic keys are fixture-only, never real environment values. No hosted Postman
resources are needed. The installed CLI lacks `postman status`, so authenticated
owner-mock discovery was unavailable.

## Draft AP bills

Only posted Bookworks invoices are eligible. Select and save an active Intacct vendor mapping, scoped to the Bookworks server and entity A210 (Gen7 LP). The backend needs the existing SAGE_CLIENT_ID, SAGE_CLIENT_SECRET and optional SAGE_USERNAME settings.

Fuel (50200) is the default; Freight uses 51050. Optional PDFs are inspected locally for invoice-number matching and the word litre: matching readable text suggests Fuel when present, Freight otherwise. Scanned PDFs retain Fuel with a manual-review notice. This is text extraction, not OCR, and the PDF is not attached to Intacct. Users can override the suggested account.

Drafts use CAD, invoice/posting dates from Bookworks invoiceDate, and its dueDate. Bookworks GL 22000 supplies HST, debited to Intacct GL 22000. The remaining total, including provincial tax, is debited to the selected COGS account. Intacct credits the vendor default AP control account automatically. Distribution totals must reconcile exactly in cents. The existing Canadian tax solution 3 / zero-tax detail 69 prevents automatic additional tax; confirm these configured IDs before using another company.

Preview and creation reload the source invoice and validate the active vendor. A preview hash blocks stale submissions. A unique MongoDB index reserves each source/entity/invoice before sending. Existing vendor/invoice-number bills are checked in Intacct. Explicit validation failures permit retry; timeouts or ambiguous results block further writes until manually reconciled. A crash during creation also requires manual review. No automatic creation retry is performed.

Read routes: GET /intacct/vendors?q= and GET /invoices/:invoiceId/intacct-context. Update routes: PUT /invoices/:invoiceId/vendor-mapping with vendorId; POST /invoices/:invoiceId/draft-preview with cogsType; POST /invoices/:invoiceId/intacct-draft with cogsType and previewHash. All paths start /api/bookworks. Read requires hub.intacct.read; updates additionally require hub.intacct.update. Source amounts, entity, currency and draft state are controlled by the server.

Run both bookworks.routes.test.js and bookworks.drafts.test.js. Draft tests exercise real HTTP clients against synthetic Bookworks/Intacct mocks and an in-memory repository, including rejection, concurrency, timeout and local-persistence failure. They do not create real bills or validate a live MongoDB connection.
