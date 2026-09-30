import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { readPackageManifest } from '@open-pencil/package-artifacts-tools'

import { releaseCommands } from './commands.ts'
import { createReleaseContext } from './context.ts'
import { digestFile } from './manifest.ts'

/** CI-only override; the checked-in local Tauri build remains self-contained. */
export async function prepareSharedFrontend(
  context: ReturnType<typeof createReleaseContext>,
  commands = releaseCommands(context.paths.root)
): Promise<void> {
  const { identity, version, paths } = context
  const source = await commands.git('rev-parse', 'HEAD')
  const manifest = await readPackageManifest(join(paths.root, 'package.json'))
  const archive = await digestFile(join(paths.root, 'frontend.tar'))

  if (source !== identity.sourceCommit) throw new Error('Unexpected source checkout')
  if (manifest.version !== version) throw new Error('Source version does not match release tag')
  if (archive.sha256 !== identity.frontendSha256) throw new Error('Shared frontend digest mismatch')

  await writeFile(
    join(paths.root, 'release-build-config.json'),
    JSON.stringify({ build: { beforeBuildCommand: null } })
  )
}

if (import.meta.main) {
  await prepareSharedFrontend(createReleaseContext())
}
