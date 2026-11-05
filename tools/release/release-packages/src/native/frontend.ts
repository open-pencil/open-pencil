import { existsSync } from 'node:fs'
import { appendFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { DESKTOP_RUST_NOTICES } from '#release/notices/artifacts'
import { msiVersion } from '#release/version'

import { readPackageManifest, runCommand } from '@open-pencil/package-artifacts-tools'

import { releaseCommands } from './commands.ts'
import { createReleaseContext } from './context.ts'
import { digestFile } from './manifest.ts'

/** What every native build takes from the one frontend build: the app, its icons and its menu. */
export const SHARED_FRONTEND_INPUTS = ['dist', 'desktop/icons', 'desktop/generated']

/** The third-party notices the editor's build writes for the JavaScript it bundles. */
export const JAVASCRIPT_NOTICES = 'dist/THIRD-PARTY-NOTICES.md'

/**
 * The files every desktop bundle carries beside the app, by their paths from `desktop/`: the
 * notices of the JavaScript and the Rust crates compiled into it.
 */
export const DESKTOP_RESOURCES = {
  [`../${JAVASCRIPT_NOTICES}`]: 'licenses/THIRD-PARTY-NOTICES-JAVASCRIPT.md',
  [DESKTOP_RUST_NOTICES]: 'licenses/THIRD-PARTY-NOTICES-RUST.md'
}

/**
 * Archives the shared frontend as `frontend.tar` in `root` and returns the archive's digest.
 * Refuses one without the notices the desktop bundles carry, which the release writes first.
 */
export async function archiveSharedFrontend(root: string, execute = runCommand): Promise<string> {
  for (const notices of [JAVASCRIPT_NOTICES, `desktop/${DESKTOP_RUST_NOTICES}`]) {
    if (!existsSync(join(root, notices))) throw new Error(`Missing ${notices}; run notices first`)
  }
  await execute({
    command: 'tar',
    args: ['-cf', 'frontend.tar', ...SHARED_FRONTEND_INPUTS],
    cwd: root
  })
  return (await digestFile(join(root, 'frontend.tar'))).sha256
}

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

  const wixVersion = msiVersion(version)
  await writeFile(
    join(paths.root, 'release-build-config.json'),
    JSON.stringify({
      build: { beforeBuildCommand: null },
      bundle: {
        resources: DESKTOP_RESOURCES,
        ...(wixVersion && { windows: { wix: { version: wixVersion } } })
      }
    })
  )
}

if (import.meta.main) {
  if (process.argv[2] === 'archive') {
    const output = process.env.GITHUB_OUTPUT
    if (!output) throw new Error('Missing GITHUB_OUTPUT')
    await appendFile(output, `sha256=${await archiveSharedFrontend(process.cwd())}\n`)
  } else {
    await prepareSharedFrontend(createReleaseContext())
  }
}
