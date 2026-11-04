#!/usr/bin/env bun
/**
 * Fails when the editor's startup code outgrows its budget. Reads the manifest of the last
 * `vite build`, so it runs after one.
 *
 *   bun tools/checks/bundle-budget/src/index.ts
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { STARTUP_BUDGET_KIB, STARTUP_ENTRY, parseManifest, staticFiles } from './budget'

const dist = resolve(await resolveWorkspaceRoot(process.cwd()), process.argv[2] ?? 'dist')
const manifest = parseManifest(await readFile(resolve(dist, '.vite/manifest.json'), 'utf8'))

const files = staticFiles(manifest, STARTUP_ENTRY)
const sizes = await Promise.all(
  files.map(async (file) => Bun.gzipSync(await readFile(resolve(dist, file))).length)
)
const bytes = sizes.reduce((total, size) => total + size, 0)
const kib = Math.round(bytes / 1024)

console.log(
  `Startup: ${kib} KiB gzipped in ${files.length} files, budget ${STARTUP_BUDGET_KIB} KiB.`
)
const onDemand = files.filter((file) => file.startsWith('assets/shiki/'))
if (onDemand.length > 0) {
  console.error(`Startup code is left out of the precache: ${onDemand.join(', ')}`)
  process.exit(1)
}
if (bytes > STARTUP_BUDGET_KIB * 1024) {
  console.error('Startup code is over budget: load the new code on demand with a dynamic import.')
  process.exit(1)
}
