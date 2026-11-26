import { availableParallelism } from 'node:os'

import { discoverPublicPackages, runCommand } from '@open-pencil/package-artifacts-tools'

import { runPackageChecks } from './run'

// ATTW packs distinct package directories, and each analysis keeps one core busy.
const TYPE_CHECK_CONCURRENCY = availableParallelism()

export async function checkTypes(root: string): Promise<void> {
  await runPackageChecks(
    (await discoverPublicPackages(root)).map(({ directory, manifest }) => {
      // A stylesheet export, such as a theme's tokens, has no types to check.
      const stylesheets =
        typeof manifest.exports === 'object' && manifest.exports !== null
          ? Object.keys(manifest.exports).filter((entrypoint) => entrypoint.endsWith('.css'))
          : []
      return {
        command: 'bun',
        args: [
          'attw',
          '--pack',
          directory,
          '--profile',
          'esm-only',
          '--format',
          'ascii',
          ...(stylesheets.length > 0 ? ['--exclude-entrypoints', ...stylesheets] : [])
        ],
        cwd: root
      }
    }),
    runCommand,
    TYPE_CHECK_CONCURRENCY
  )
}
