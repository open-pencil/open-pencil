import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { discoverPublicPackages, orderPackagesByDependencies } from '@open-pencil/package-artifacts'

import { measurePhase } from '../timing'
import { verifyArtifactConsumers } from './consumer'
import { verifyPackagingGuards } from './guards'
import { packPublicPackages } from './pack'

export async function verifyPackedPackages(root: string): Promise<void> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'open-pencil-package-smoke-'))
  try {
    // Broken fixture manifests must fail before the same checks vouch for real packages.
    await measurePhase('packaging guards', () => verifyPackagingGuards())
    const packages = orderPackagesByDependencies(await discoverPublicPackages(root))
    // Raw npm packing retains workspace:* dependencies. Inspect it without claiming
    // installation compatibility; Bun packing normalizes those dependencies.
    await measurePhase('npm packing', () =>
      packPublicPackages(root, join(temporaryRoot, 'npm-tarballs'), packages, 'npm')
    )
    const packageSet = await measurePhase('Bun packing', () =>
      packPublicPackages(root, join(temporaryRoot, 'bun-tarballs'), packages, 'bun')
    )
    await verifyArtifactConsumers(root, packageSet.tarballs)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
