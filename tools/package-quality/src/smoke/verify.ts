import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { discoverPublicPackages, orderPackagesByDependencies } from '@open-pencil/package-artifacts'

import { verifyArtifactConsumers } from './consumer'
import { packPublicPackages } from './pack'

export async function verifyPackedPackages(root: string): Promise<void> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'open-pencil-package-smoke-'))
  try {
    const packages = orderPackagesByDependencies(await discoverPublicPackages(root))
    // Raw npm packing retains workspace:* dependencies. Inspect it without claiming
    // installation compatibility; Bun packing normalizes those dependencies.
    await packPublicPackages(root, join(temporaryRoot, 'npm-tarballs'), packages, 'npm')
    const packageSet = await packPublicPackages(
      root,
      join(temporaryRoot, 'bun-tarballs'),
      packages,
      'bun'
    )
    await verifyArtifactConsumers(root, packageSet.tarballs)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
