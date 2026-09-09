import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { inspectTarball } from '@open-pencil/package-artifacts/tarball'

import { installPackedPackages } from './install'
import { verifyPackageBinaries, verifyPublicImports, verifyRuntimeScenarios } from './runtime'
import { runtimeScenarios } from './scenarios'
import { verifyTypeConsumer } from './type-consumer'

/** Verify an entire OpenPencil artifact set, without rebuilding or modifying its archives. */
export async function verifyArtifactConsumers(root: string, tarballs: string[]): Promise<void> {
  if (tarballs.length === 0) throw new Error('Cannot verify an empty artifact set')
  const inspections = await Promise.all(tarballs.map(inspectTarball))
  const diagnostics = inspections.flatMap(({ diagnostics }) => diagnostics)
  if (diagnostics.length > 0) {
    throw new Error(
      diagnostics
        .map(({ packageName, field, message }) => `${packageName}: ${field} ${message}`)
        .join('\n')
    )
  }
  const consumer = await mkdtemp(join(tmpdir(), 'open-pencil-artifact-consumer-'))
  try {
    await installPackedPackages(consumer, tarballs)
    await verifyPublicImports(
      inspections.map(({ manifest }) => manifest),
      consumer
    )
    await verifyRuntimeScenarios(runtimeScenarios, consumer)
    await verifyTypeConsumer(root, consumer)
    await verifyPackageBinaries(consumer)
  } finally {
    await rm(consumer, { recursive: true, force: true })
  }
}
