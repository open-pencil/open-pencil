import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { inspectTarball } from '@open-pencil/package-artifacts-tools/tarball'

import { measurePhase } from '../timing'
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
    await measurePhase('consumer install', () => installPackedPackages(consumer, tarballs))
    await measurePhase('public imports', () =>
      verifyPublicImports(
        inspections.map(({ manifest }) => manifest),
        consumer
      )
    )
    await measurePhase('runtime scenarios', () =>
      verifyRuntimeScenarios(runtimeScenarios, consumer)
    )
    await measurePhase('consumer types', () => verifyTypeConsumer(root, consumer))
    await measurePhase('package binaries', () => verifyPackageBinaries(consumer))
  } finally {
    await rm(consumer, { recursive: true, force: true })
  }
}
