import { afterEach, describe, expect, test } from 'bun:test'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

import { inspectTarball, packageBinTargets, packageExportTargetPaths } from '../src/tarball'

const execFileAsync = promisify(execFile)

describe('tarball metadata', () => {
  test('normalizes string and named binaries', () => {
    expect(packageBinTargets({ name: 'example', version: '1', bin: './cli.js' })).toEqual({
      example: './cli.js'
    })
    expect(
      packageBinTargets({ name: 'example', version: '1', bin: { other: './other.js' } })
    ).toEqual({ other: './other.js' })
  })

  test('collects targets across multiple subpaths', () => {
    expect(
      packageExportTargetPaths({
        exports: {
          '.': { types: './dist/index.d.ts', import: './dist/index.js' },
          './feature': { import: './dist/feature.js' }
        }
      })
    ).toEqual(['./dist/index.d.ts', './dist/index.js', './dist/feature.js'])
  })

  test('collects nested and wildcard export targets', () => {
    expect(
      packageExportTargetPaths({
        exports: {
          './feature/*': { types: './dist/*.d.ts', import: ['./dist/*.js', null] }
        }
      })
    ).toEqual(['./dist/*.d.ts', './dist/*.js'])
  })
})

describe('inspectTarball', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))
    )
  })

  async function createTarball(files: Record<string, string>): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'open-pencil-tarball-'))
    temporaryDirectories.push(root)
    for (const [file, text] of Object.entries(files)) {
      const path = join(root, 'package', file)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, text)
    }
    const tarball = join(root, 'package.tgz')
    await execFileAsync('tar', ['-czf', tarball, '-C', root, 'package'])
    return tarball
  }

  const manifest = (bunTarget: string) =>
    JSON.stringify({
      name: '@fixture/resolution',
      version: '1.0.0',
      exports: { '.': { bun: bunTarget, import: './dist/index.js' } }
    })

  test('reads entries and the manifest without a tar executable', async () => {
    const tarball = await createTarball({
      'package.json': manifest('./dist/index.js'),
      'dist/index.js': 'export const ready = true\n'
    })
    const inspection = await inspectTarball(tarball)
    expect(inspection.manifest.name).toBe('@fixture/resolution')
    expect([...inspection.entries].sort()).toEqual([
      'package/dist/index.js',
      'package/package.json'
    ])
    expect(inspection.diagnostics).toEqual([])
  })

  test('reports export conditions whose targets were not packed', async () => {
    const tarball = await createTarball({
      'package.json': manifest('./src/index.ts'),
      'dist/index.js': 'export const ready = true\n'
    })
    expect((await inspectTarball(tarball)).diagnostics).toEqual([
      {
        field: 'exports["."].bun',
        message: 'target is missing (./src/index.ts)',
        packageName: '@fixture/resolution',
        tarballPath: tarball
      }
    ])
  })

  test('rejects archives without a package manifest', async () => {
    const tarball = await createTarball({ 'dist/index.js': 'export {}\n' })
    await expect(inspectTarball(tarball)).rejects.toThrow('package/package.json is missing')
  })
})
