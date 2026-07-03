import { publicPackageDirs } from '../packages'

let failed = false

for (const packageDir of publicPackageDirs) {
  const proc = Bun.spawnSync(
    ['bun', 'attw', '--pack', packageDir, '--profile', 'esm-only', '--format', 'ascii'],
    {
      stdout: 'pipe',
      stderr: 'pipe'
    }
  )

  const stdout = proc.stdout.toString()
  const stderr = proc.stderr.toString()
  if (!proc.success) {
    console.error(`ATTW failed for ${packageDir}`)
    if (stdout) console.error(stdout)
    if (stderr) console.error(stderr)
    failed = true
  }
}

if (failed) process.exit(1)

console.log('ATTW package type-resolution checks passed.')
