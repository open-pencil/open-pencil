#!/usr/bin/env bun
/**
 * Builds the editor with `VITE_OPENPENCIL_CLOUD=off` and fails when any of OpenPencil Cloud's
 * modules made it into the bundle. The build is not written to disk.
 *
 *   bun tools/checks/cloud-off/src/index.ts
 */
import { resolve } from 'node:path'

import { build } from 'vite'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { cloudModulesIn } from './modules'

const repoRoot = await resolveWorkspaceRoot(process.cwd())
process.env.VITE_OPENPENCIL_CLOUD = 'off'

const moduleIds = new Set<string>()
await build({
  root: repoRoot,
  configFile: resolve(repoRoot, 'vite.config.ts'),
  // Vite's default loader cannot run the config under Bun.
  configLoader: 'native',
  logLevel: 'warn',
  build: { write: false },
  plugins: [
    {
      name: 'open-pencil-cloud-off-modules',
      buildEnd() {
        for (const id of this.getModuleIds()) moduleIds.add(id)
      }
    }
  ]
})

const cloud = cloudModulesIn(moduleIds, repoRoot)
if (cloud.length > 0) {
  console.error('The build without Cloud still bundles Cloud modules:')
  for (const path of cloud) console.error(`- ${path}`)
  console.error(
    'Reach Cloud only through @/app/cloud/integration or @/components/cloud/integration.'
  )
  process.exit(1)
}
console.log(`The build without Cloud bundles none of its modules (${moduleIds.size} modules).`)
