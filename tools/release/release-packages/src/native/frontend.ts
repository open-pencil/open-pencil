import { existsSync } from 'node:fs'
import { appendFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { DESKTOP_RUST_NOTICES } from '#release/notices/artifacts'
import { msiVersion } from '#release/version'
import { isEmptyObject } from 'es-toolkit'

import { readPackageManifest, runCommand } from '@open-pencil/package-artifacts-tools'

import { releaseCommands } from './commands.ts'
import { createReleaseContext } from './context.ts'
import { digestFile } from './manifest.ts'

/** What every native build takes from the one frontend build: the app, its icons and its menu. */
export const SHARED_FRONTEND_INPUTS = ['dist', 'desktop/icons', 'desktop/generated']

/** A third-party notices file a desktop bundle carries, from the shared frontend. */
export interface DesktopNotices {
  /** Where the frontend build or the release writes it, from the repository root. */
  source: string
  /** Where the bundle carries it. */
  bundled: string
  /** What in a source tree writes it; a release from before it has none of these notices. */
  producer: string
}

export const DESKTOP_NOTICES: readonly DesktopNotices[] = [
  {
    source: 'dist/THIRD-PARTY-NOTICES.md',
    bundled: 'licenses/THIRD-PARTY-NOTICES-JAVASCRIPT.md',
    producer: 'vite/third-party-notices.ts'
  },
  {
    source: `desktop/${DESKTOP_RUST_NOTICES}`,
    bundled: 'licenses/THIRD-PARTY-NOTICES-RUST.md',
    producer: 'desktop/deny.toml'
  }
]

/** The notices a source tree's desktop bundles carry: those it has the producer of. */
export function expectedDesktopNotices(root: string): DesktopNotices[] {
  return DESKTOP_NOTICES.filter((notices) => existsSync(join(root, notices.producer)))
}

/**
 * Archives the shared frontend as `frontend.tar` in `root` and returns the archive's digest.
 * Refuses one without the notices its desktop bundles carry, which the build and the release
 * write first.
 */
export async function archiveSharedFrontend(root: string, execute = runCommand): Promise<string> {
  for (const { source } of expectedDesktopNotices(root)) {
    if (!existsSync(join(root, source))) throw new Error(`Missing ${source}; run notices first`)
  }
  await execute({
    command: 'tar',
    args: ['-cf', 'frontend.tar', ...SHARED_FRONTEND_INPUTS],
    cwd: root
  })
  return (await digestFile(join(root, 'frontend.tar'))).sha256
}

/** The bundle resources for a tree's notices, by their paths from `desktop/`, as Tauri takes them. */
export function desktopResources(root: string): Record<string, string> {
  return Object.fromEntries(
    expectedDesktopNotices(root).map(({ source, bundled }) => [
      relative(join(root, 'desktop'), join(root, source)),
      bundled
    ])
  )
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
  const resources = desktopResources(paths.root)
  await writeFile(
    join(paths.root, 'release-build-config.json'),
    JSON.stringify({
      build: { beforeBuildCommand: null },
      bundle: {
        ...(!isEmptyObject(resources) && { resources }),
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
