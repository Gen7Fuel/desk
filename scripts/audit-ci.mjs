#!/usr/bin/env node
// Shared `npm audit` gate for CI and local use.
//
// Fails on any high/critical advisory that is not explicitly allowlisted below.
// Every allowlist entry needs a reason — if you cannot write one, fix the
// dependency instead of adding an entry.
//
// Usage:
//   node scripts/audit-ci.mjs             # audits frontend + backend
//   node scripts/audit-ci.mjs frontend    # only frontend
//
// Why this exists instead of a bare `npm audit --audit-level=high`:
// a plain audit fails the build on advisories we have already triaged and
// cannot act on, so CI goes red on every unrelated PR. See CLAUDE.md
// ("Dependency audits") for the triage procedure.

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = process.argv[2]
const targets = arg ? [arg] : ['frontend', 'backend']

// ---------------------------------------------------------------------------
// Allowlist: high/critical advisories that must NOT fail the build.
// Keyed by GHSA id so a *new* advisory against the same package still fails.
// ---------------------------------------------------------------------------
const ALLOWLIST = [
  {
    ghsa: 'GHSA-mh99-v99m-4gvg',
    package: 'brace-expansion',
    reason:
      'False positive. The advisory range is `<=5.0.7`, which sweeps in the ' +
      'entire 1.x and 2.x lines — but the versions we resolve (1.1.18 and ' +
      '2.1.4) are the maintenance backports that already contain the ' +
      'CVE-2026-14257 fix (verified: both ship EXPANSION_MAX_LENGTH). ' +
      'There is no 1.x/2.x release above 5.0.7 to upgrade to, and forcing ' +
      '5.x breaks the tree: 5.x changed the CommonJS export from a callable ' +
      '`module.exports = expandTop` to a named `exports.expand`, so ' +
      'minimatch 3.x/5.x (pulled in by exceljs -> archiver) dies with ' +
      '"expand is not a function". Floors are pinned via `overrides` in ' +
      'frontend/package.json. Revisit if the advisory range is corrected ' +
      'upstream or exceljs moves off archiver 5.',
  },
  {
    ghsa: 'GHSA-4r6h-8v6p-xvw6',
    package: 'xlsx',
    reason:
      'Prototype pollution in SheetJS. No fixed version published on npm ' +
      '(range is `*`). Backend only parses spreadsheets uploaded by ' +
      'authenticated internal staff. Revisit if SheetJS publishes a fix or ' +
      'the parsing path becomes externally reachable.',
  },
  {
    ghsa: 'GHSA-5pgg-2g8v-p4x9',
    package: 'xlsx',
    reason:
      'ReDoS in SheetJS. Same situation as GHSA-4r6h-8v6p-xvw6 above — no ' +
      'fixed version published on npm.',
  },
]

const allowed = new Map(ALLOWLIST.map((e) => [e.ghsa, e]))
const seen = new Set()
const blocking = []

for (const target of targets) {
  const dir = resolve(repoRoot, target)
  if (!existsSync(resolve(dir, 'package.json'))) {
    console.error(`Skipping ${target}: no package.json`)
    continue
  }

  let raw
  try {
    // npm audit exits non-zero when it finds anything, so ignore the status
    // and rely on the JSON body instead.
    raw = execSync('npm audit --json', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (err) {
    raw = err.stdout
  }

  let report
  try {
    report = JSON.parse(raw)
  } catch {
    console.error(`${target}: could not parse \`npm audit --json\` output.`)
    console.error(String(raw).slice(0, 2000))
    process.exit(1)
  }

  // A registry/network failure must fail loudly, never silently pass.
  if (report.error) {
    console.error(`${target}: npm audit failed — ${report.error.summary ?? 'unknown error'}`)
    process.exit(1)
  }

  const vulns = report.vulnerabilities ?? {}
  const ignored = []

  for (const [name, vuln] of Object.entries(vulns)) {
    if (vuln.severity !== 'high' && vuln.severity !== 'critical') continue

    for (const via of vuln.via) {
      if (typeof via !== 'object') continue // string entries are just parent packages
      const ghsa = via.url?.split('/').pop() ?? `source-${via.source}`
      const entry = allowed.get(ghsa)
      if (entry) {
        seen.add(ghsa)
        ignored.push({ name, ghsa, title: via.title })
      } else {
        blocking.push({ target, name, ghsa, severity: via.severity, title: via.title, url: via.url })
      }
    }
  }

  const counts = report.metadata?.vulnerabilities ?? {}
  console.log(
    `${target}: ${counts.critical ?? 0} critical, ${counts.high ?? 0} high ` +
      `(${ignored.length} allowlisted, ${blocking.filter((b) => b.target === target).length} blocking)`,
  )
  for (const i of ignored) {
    console.log(`  - ignored ${i.ghsa} (${i.name}): ${i.title}`)
  }
}

// Flag allowlist entries that no longer match anything, so the list does not
// silently rot and keep suppressing advisories after the dependency is fixed.
if (!arg) {
  const stale = ALLOWLIST.filter((e) => !seen.has(e.ghsa))
  for (const e of stale) {
    console.log(`\nNote: allowlist entry ${e.ghsa} (${e.package}) no longer matches — remove it.`)
  }
}

if (blocking.length > 0) {
  console.error(`\n${blocking.length} high/critical advisory(ies) not allowlisted:\n`)
  for (const b of blocking) {
    console.error(`  [${b.target}] ${b.name} — ${b.severity}`)
    console.error(`    ${b.title}`)
    console.error(`    ${b.url}`)
  }
  console.error(
    '\nFix the dependency (preferred), or — if it is genuinely not actionable —\n' +
      'add the GHSA id to ALLOWLIST in scripts/audit-ci.mjs with a written reason.\n' +
      'See CLAUDE.md ("Dependency audits").',
  )
  process.exit(1)
}

console.log('\nAudit passed.')
