import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { WorkspacePackage } from '../src/manifest/types'
import { discoverPublicPackages, orderPackagesByDependencies } from '../src/workspace/catalog'

function pkg(name: string, dependencies: Record<string, string> = {}): WorkspacePackage {
  return { directory: `packages/${name}`, manifest: { name, version: '1.0.0', dependencies } }
}

describe('discoverPublicPackages', () => {
  test('discovers public workspaces and excludes private tooling', async () => {
    const root = join(tmpdir(), `open-pencil-package-catalog-${crypto.randomUUID()}`)
    await mkdir(join(root, 'packages/public'), { recursive: true })
    await mkdir(join(root, 'tools/private'), { recursive: true })
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ workspaces: ['packages/public', 'tools/private'] })
    )
    await writeFile(
      join(root, 'packages/public/package.json'),
      JSON.stringify({ name: '@fixture/public', version: '1.0.0' })
    )
    await writeFile(
      join(root, 'tools/private/package.json'),
      JSON.stringify({ name: '@fixture/private', version: '1.0.0', private: true })
    )

    expect(await discoverPublicPackages(root)).toEqual([
      {
        directory: 'packages/public',
        manifest: { name: '@fixture/public', version: '1.0.0' }
      }
    ])
  })
})

describe('orderPackagesByDependencies', () => {
  test('orders internal dependencies before their consumers', () => {
    const ordered = orderPackagesByDependencies([
      pkg('app', { library: 'workspace:*' }),
      pkg('library')
    ])
    expect(ordered.map(({ manifest }) => manifest.name)).toEqual(['library', 'app'])
  })

  test('orders a diamond dependency graph once and stably', () => {
    const ordered = orderPackagesByDependencies([
      pkg('app', { left: 'workspace:*', right: 'workspace:*' }),
      pkg('left', { base: 'workspace:*' }),
      pkg('right', { base: 'workspace:*' }),
      pkg('base')
    ])
    expect(ordered.map(({ manifest }) => manifest.name)).toEqual(['base', 'left', 'right', 'app'])
  })

  test('reports dependency cycles', () => {
    expect(() =>
      orderPackagesByDependencies([
        pkg('one', { two: 'workspace:*' }),
        pkg('two', { one: 'workspace:*' })
      ])
    ).toThrow('Workspace dependency cycle: one -> two -> one')
  })
})
