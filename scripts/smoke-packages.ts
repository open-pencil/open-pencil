import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const packageDirs = [
  'packages/core',
  'packages/vue',
  'packages/mcp',
  'packages/cli',
  'packages/api'
]

function run(command: string[], cwd = rootDir): string {
  const proc = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const stdout = proc.stdout.toString()
  const stderr = proc.stderr.toString()
  if (!proc.success) {
    console.error(`$ ${command.join(' ')}`)
    if (stdout) console.error(stdout)
    if (stderr) console.error(stderr)
    process.exit(proc.exitCode || 1)
  }
  return stdout.trim()
}

function nodeEval(code: string, cwd: string): void {
  run(['node', '--input-type=module', '--eval', code], cwd)
}

const tempDir = mkdtempSync(join(tmpdir(), 'inkly-package-smoke-'))

try {
  run(['bun', 'run', 'build:packages'])

  const tarballs: string[] = []
  for (const packageDir of packageDirs) {
    const output = run(
      ['bun', 'pm', 'pack', '--destination', tempDir, '--quiet'],
      join(rootDir, packageDir)
    )
    const filename = output
      .split('\n')
      .map((line) => line.trim())
      .findLast((line) => line.length > 0)
    if (!filename) throw new Error(`No tarball produced for ${packageDir}`)
    const tarball = filename.startsWith('/') ? filename : join(tempDir, filename)
    tarballs.push(tarball)

    const contents = run(['tar', '-tf', tarball])
    const runtimeTs = contents
      .split('\n')
      .filter((entry) => /package\/src\/.*\.ts$/.test(entry) && !entry.endsWith('.d.ts'))
    if (runtimeTs.length > 0) {
      console.error(`${basename(tarball)} includes runtime TypeScript:\n${runtimeTs.join('\n')}`)
      process.exit(1)
    }
  }

  run(['npm', 'init', '-y'], tempDir)
  run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs], tempDir)

  nodeEval("await import('@inkly/core')", tempDir)
  nodeEval("await import('@inkly/core/scene-graph')", tempDir)
  nodeEval("await import('@inkly/vue')", tempDir)
  nodeEval("await import('@inkly/mcp')", tempDir)
  nodeEval("await import('@inkly/api')", tempDir)

  run(['node', 'node_modules/.bin/inkly', '--help'], tempDir)
  run(['node', 'node_modules/.bin/inkly-mcp', '--help'], tempDir)
  run(['node', 'node_modules/.bin/inkly-mcp-http', '--help'], tempDir)

  console.log('Packed package smoke tests passed.')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
