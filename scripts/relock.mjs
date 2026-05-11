#!/usr/bin/env node
// Regenerate package-lock.json inside a Linux node:22 container so the
// resulting lockfile matches what CI (Linux) produces. This avoids the
// recurring Windows->Linux lockfile drift for platform-specific optional
// deps (e.g. @emnapi/*, @rollup/*, @swc/*).
//
// Usage:
//   node scripts/relock.mjs            # regenerates both frontend + backend
//   node scripts/relock.mjs frontend   # only frontend
//   node scripts/relock.mjs backend    # only backend

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = process.argv[2]
const targets = arg ? [arg] : ['frontend', 'backend']

for (const target of targets) {
  const dir = resolve(repoRoot, target)
  if (!existsSync(resolve(dir, 'package.json'))) {
    console.error(`Skipping ${target}: no package.json`)
    continue
  }
  const mount = dir.replace(/\\/g, '/')
  const cmd = `docker run --rm -v "${mount}":/w -w /w node:22 npm install --package-lock-only --ignore-scripts`
  console.log(`> ${target}: ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}
