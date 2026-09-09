import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  discoverPublishPackages,
  preparePublishDirectories,
  publishPackageJSON
} from '../src/publish-dirs'

async function fixtureRoot() {
  const root = join(tmpdir(), `open-pencil-release-packages-${crypto.randomUUID()}`)
  await mkdir(join(root, 'packages/example/dist'), { recursive: true })
  await writeFile(join(root, 'packages/example/dist/index.js'), 'export {}\n')
  await writeFile(join(root, 'packages/example/README.md'), '# Example\n')
  await writeFile(join(root, 'packages/example/LICENSE'), 'fixture license\n')
  await writeFile(join(root, 'package.json'), JSON.stringify({ workspaces: ['packages/example'] }))
  await writeFile(
    join(root, 'packages/example/package.json'),
    JSON.stringify(
      {
        name: '@open-pencil/example',
        version: '1.0.0',
        files: ['dist', 'README.md'],
        scripts: { build: 'tsdown' },
        dependencies: { '@open-pencil/core': 'workspace:*', zod: '^4.0.0' },
        exports: {
          '.': { bun: './dist/index.js', import: './dist/index.js' }
        },
        devDependencies: { typescript: '^5.0.0' },
        main: './dist/index.js',
        types: './dist/index.d.ts',
        publishConfig: { access: 'public' }
      },
      null,
      2
    )
  )
  return root
}

describe('publishPackageJSON', () => {
  test('rejects conflicting publication settings', () => {
    for (const publishConfig of [
      { access: 'restricted' },
      { provenance: false },
      { registry: 'https://other.invalid/' }
    ]) {
      expect(() =>
        publishPackageJSON({ name: 'fixture', version: '1.0.0', publishConfig }, '1.0.0')
      ).toThrow('conflicts with the public npm release policy')
    }
  })

  test('rejects resolution rewrites even when injected through publishConfig', () => {
    expect(() =>
      publishPackageJSON(
        {
          name: '@fixture/example',
          version: '1.0.0',
          exports: { '.': './dist/index.js' },
          publishConfig: { exports: { '.': './missing.js' } }
        },
        '1.0.0'
      )
    ).toThrow('publishConfig must not rewrite exports')
  })

  test('rewrites workspace dependencies without changing runtime exports', () => {
    const exports = { '.': { bun: './dist/index.js', import: './dist/index.js' } }
    const json = publishPackageJSON(
      {
        name: '@open-pencil/example',
        version: '1.0.0',
        scripts: { build: 'tsdown' },
        dependencies: { '@open-pencil/core': 'workspace:*', zod: '^4.0.0' },
        exports,
        devDependencies: { typescript: '^5.0.0' },
        main: './dist/index.js',
        publishConfig: { access: 'public' }
      },
      '0.13.2'
    )

    expect(json).toEqual({
      name: '@open-pencil/example',
      version: '1.0.0',
      dependencies: { '@open-pencil/core': '^0.13.2', zod: '^4.0.0' },
      exports,
      main: './dist/index.js'
    })
  })
})

describe('discoverPublishPackages', () => {
  test('derives release contents from public workspace manifests', async () => {
    const root = await fixtureRoot()
    expect(await discoverPublishPackages(root)).toEqual([{ directory: 'packages/example' }])
  })
})

describe('preparePublishDirectories', () => {
  test('copies declared artifacts and writes transformed package metadata', async () => {
    const root = await fixtureRoot()
    const outRoot = join(root, '.publish')

    await preparePublishDirectories({
      coreVersion: '0.13.2',
      outRoot,
      packages: await discoverPublishPackages(root),
      root
    })

    expect(await readFile(join(outRoot, 'example/dist/index.js'), 'utf8')).toBe('export {}\n')
    expect(await readFile(join(outRoot, 'example/LICENSE'), 'utf8')).toBe('fixture license\n')
    expect(await readFile(join(outRoot, 'example/README.md'), 'utf8')).toBe('# Example\n')
    expect(JSON.parse(await readFile(join(outRoot, 'example/package.json'), 'utf8'))).toEqual({
      name: '@open-pencil/example',
      version: '1.0.0',
      files: ['dist', 'README.md'],
      dependencies: { '@open-pencil/core': '^0.13.2', zod: '^4.0.0' },
      exports: { '.': { bun: './dist/index.js', import: './dist/index.js' } },
      main: './dist/index.js',
      types: './dist/index.d.ts'
    })
  })
})
