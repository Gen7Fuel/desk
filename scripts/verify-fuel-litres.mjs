// Read-only by default. --write creates ONE small AR draft in T010 only.
// Usage: node scripts/verify-fuel-litres.mjs [--write]
// Requires SAGE_CLIENT_ID and SAGE_CLIENT_SECRET (or backend/.env).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envFile = fileURLToPath(new URL("../backend/.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const base = "https://api.intacct.com/ia/api/v1/";
const entity = "T010";
const sourceKey = "137398";
const field = "nsp::FUEL_LITRES";

async function main() {
  if (!process.env.SAGE_CLIENT_ID || !process.env.SAGE_CLIENT_SECRET) {
    throw new Error("Sage credentials are unavailable. No requests sent.");
  }
  const tokenResponse = await fetch(`${base}oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SAGE_CLIENT_ID,
      client_secret: process.env.SAGE_CLIENT_SECRET,
      username: "skimWS@GPMC Management Services",
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!tokenResponse.ok)
    throw new Error(`Sage authentication failed (${tokenResponse.status}).`);
  const { access_token: token } = await tokenResponse.json();
  if (!token) throw new Error("Sage returned no access token.");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-IA-API-Param-Entity": entity,
  };
  const path = "objects/accounts-receivable/invoice";
  async function request(url, options = {}) {
    const response = await fetch(`${base}${url}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        `Sage ${options.method || "GET"} failed (${response.status}): ${JSON.stringify(data["ia::error"] || data)}. No automatic retry.`,
      );
    }
    return (await response.json())["ia::result"];
  }
  const source = await request(`${path}/${sourceKey}`);
  const sourceLine = source.lines?.find((line) => line[field] === 10000);
  if (
    !sourceLine ||
    source.customer?.id !== "C00058" ||
    sourceLine.dimensions?.location?.id !== entity
  ) {
    throw new Error(
      "The known T010 verification invoice no longer matches. No writes performed.",
    );
  }
  console.log(
    JSON.stringify({ entity, sourceKey, field, readValue: sourceLine[field] }),
  );
  if (!process.argv.includes("--write")) return;

  const stamp = new Date().toISOString();
  const body = {
    invoiceNumber: `DL-${stamp.replace(/\D/g, "")}`,
    customer: { id: "C00058" },
    referenceNumber: `Desk Litres test ${stamp}`,
    description: "Desk Litres API verification - TEST ONLY",
    invoiceDate: source.invoiceDate,
    dueDate: source.invoiceDate,
    currency: { txnCurrency: "CAD" },
    taxSolution: { key: source.taxSolution.key },
    state: "draft",
    lines: [
      {
        glAccount: { id: sourceLine.glAccount.id },
        dimensions: { location: { id: entity }, customer: { id: "C00058" } },
        txnAmount: "0.01",
        taxEntries: sourceLine.taxEntries.map((tax) => ({
          orderEntryTaxDetail: { key: tax.orderEntryTaxDetail.key },
          taxRate: 0,
          txnTaxAmount: "0",
          baseTaxAmount: "0",
        })),
        memo: "Desk Litres write verification - TEST ONLY",
        [field]: 10000,
      },
    ],
  };
  // Never retry this POST: an ambiguous failure may still have created a draft.
  const created = await request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log(
    JSON.stringify({
      entity,
      createdDraftKey: created.key,
      reference: body.referenceNumber,
    }),
  );
  const saved = await request(`${path}/${created.key}`);
  if (
    saved.state !== "draft" ||
    saved.lines?.[0]?.[field] !== 10000 ||
    saved.lines[0].dimensions?.location?.id !== entity
  ) {
    throw new Error(
      `Draft ${created.key} was created but did not pass GET verification.`,
    );
  }
  console.log(
    JSON.stringify({
      entity,
      verifiedDraftKey: created.key,
      state: saved.state,
      litres: saved.lines[0][field],
    }),
  );
  console.log(
    "Whole-litre write verified. Fractional precision and printed layout still require Intacct setup.",
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
