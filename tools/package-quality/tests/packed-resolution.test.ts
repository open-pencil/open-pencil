import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runCommand } from '@open-pencil/package-artifacts'
import { inspectTarball } from '@open-pencil/package-artifacts/tarball'

async function createPackageFixture(
  root: string,
  bunTarget: string,
  files = ['dist']
): Promise<string> {
  const packageDirectory = join(root, 'package')
  await mkdir(join(packageDirectory, 'dist'), { recursive: true })
  await mkdir(join(packageDirectory, 'src'), { recursive: true })
  await writeFile(join(packageDirectory, 'dist/index.js'), 'export const ready = true\n')
  await writeFile(join(packageDirectory, 'dist/index.d.ts'), 'export declare const ready: true\n')
  await writeFile(
    join(packageDirectory, 'src/index.ts'),
    "export { ready } from '#fixture/value'\n"
  )
  await writeFile(join(packageDirectory, 'src/value.ts'), 'export const ready = true\n')
  await writeFile(
    join(packageDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: '@fixture/resolution',
        version: '1.0.0',
        type: 'module',
        imports: { '#fixture/*': './src/*.ts' },
        files,
        exports: {
          '.': {
            types: './dist/index.d.ts',
            bun: bunTarget,
            import: './dist/index.js',
            default: './dist/index.js'
          }
        }
      },
      null,
      2
    )}\n`
  )
  return packageDirectory
}

import { evaluateRuntime } from '../src/smoke/runtime'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  )
})

async function packAndInstall(bunTarget: string, files = ['dist']) {
  const root = await mkdtemp(join(tmpdir(), 'open-pencil-package-resolution-'))
  temporaryDirectories.push(root)
  const packageDirectory = await createPackageFixture(root, bunTarget, files)
  const artifacts = join(root, 'artifacts')
  const consumer = join(root, 'consumer')
  await mkdir(artifacts)
  await mkdir(consumer)
  const packed = await runCommand({
    command: 'npm',
    args: ['pack', '--json', '--pack-destination', artifacts],
    cwd: packageDirectory
  })
  const filename = (JSON.parse(packed.stdout) as Array<{ filename: string }>)[0]?.filename
  if (!filename) throw new Error('Fixture pack did not produce a tarball')
  const tarball = join(artifacts, filename)
  await runCommand({ command: 'npm', args: ['init', '-y'], cwd: consumer })
  await runCommand({
    command: 'npm',
    args: ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball],
    cwd: consumer
  })
  return { consumer, tarball }
}

describe('packed runtime resolution', () => {
  test('imports the same packed artifact under Node and Bun', async () => {
    const { consumer, tarball } = await packAndInstall('./dist/index.js')
    expect((await inspectTarball(tarball)).diagnostics).toEqual([])
    for (const runtime of ['node', 'bun'] as const) {
      await evaluateRuntime(
        runtime,
        "const value = await import('@fixture/resolution'); if (!value.ready) throw new Error('not ready')",
        consumer
      )
    }
  })

  test('ships transitive source imports with the source directory', async () => {
    const { consumer, tarball } = await packAndInstall('./src/index.ts', ['dist', 'src'])
    expect((await inspectTarball(tarball)).diagnostics).toEqual([])
    for (const runtime of ['node', 'bun'] as const) {
      await evaluateRuntime(
        runtime,
        "const { ready } = await import('@fixture/resolution'); if (!ready) throw new Error('missing value')",
        consumer
      )
    }
  }, 120_000)

  test('an entrypoint-only file list does not satisfy transitive imports', async () => {
    const { consumer, tarball } = await packAndInstall('./src/index.ts', ['dist', 'src/index.ts'])
    expect((await inspectTarball(tarball)).diagnostics).toEqual([])
    await expect(
      evaluateRuntime('bun', "await import('@fixture/resolution')", consumer)
    ).rejects.toThrow()
  }, 120_000)

  test('detects the source-only Bun condition from issue 663', async () => {
    const { consumer, tarball } = await packAndInstall('./src/index.ts')
    expect((await inspectTarball(tarball)).diagnostics).toEqual([
      expect.objectContaining({
        field: 'exports["."].bun',
        message: 'target is missing (./src/index.ts)'
      })
    ])
    await evaluateRuntime('node', "await import('@fixture/resolution')", consumer)
    await expect(
      evaluateRuntime('bun', "await import('@fixture/resolution')", consumer)
    ).rejects.toThrow('failed: exit code 1')
  })
})
