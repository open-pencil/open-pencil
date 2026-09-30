import { runCommand } from '@open-pencil/package-artifacts-tools'

import { publicPackageDirs } from '../packages'
import { runPackageChecks } from './run'

// ATTW packs distinct package directories; bound concurrent TypeScript analyses.
const TYPE_CHECK_CONCURRENCY = 2

export async function checkTypes(root: string): Promise<void> {
  await runPackageChecks(
    (await publicPackageDirs(root)).map((packageDir) => ({
      command: 'bun',
      args: ['attw', '--pack', packageDir, '--profile', 'esm-only', '--format', 'ascii'],
      cwd: root
    })),
    runCommand,
    TYPE_CHECK_CONCURRENCY
  )
}
