import { fileURLToPath } from 'node:url'

import { publicPackageDirs } from '../packages'

const rootDir = fileURLToPath(new URL('../../../..', import.meta.url))

for (const packageDir of publicPackageDirs) {
  const proc = Bun.spawnSync(['bun', 'publint', packageDir, '--strict'], {
    cwd: rootDir,
    stdout: 'pipe',
    stderr: 'pipe'
  })

  const stdout = proc.stdout.toString()
  const stderr = proc.stderr.toString()
  if (!proc.success) {
    console.error(`publint failed for ${packageDir}`)
    if (stdout) console.error(stdout)
    if (stderr) console.error(stderr)
    process.exit(proc.exitCode || 1)
  }
}

console.log('Publint package checks passed.')
