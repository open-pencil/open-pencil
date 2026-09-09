import { publicPackageDirs } from '../packages'
import { runPackageChecks } from './run'

export async function checkPublint(root: string): Promise<void> {
  await runPackageChecks(
    (await publicPackageDirs(root)).map((packageDir) => ({
      command: 'bun',
      args: ['publint', packageDir, '--strict'],
      cwd: root
    }))
  )
}
