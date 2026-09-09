import { describe, expect, test } from 'bun:test'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildReleasePackages,
  createPublicationPlan,
  packReleasePackages,
  prepareReleasePackages,
  releasePaths,
  validatePublicationArtifacts
} from '../src/workflow'

async function createWorkspace() {
  const root = join(tmpdir(), `open-pencil-release-workflow-${crypto.randomUUID()}`)
  await mkdir(join(root, 'packages/library'), { recursive: true })
  await mkdir(join(root, 'packages/app'), { recursive: true })
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ workspaces: ['packages/app', 'packages/library'] })
  )
  await writeFile(
    join(root, 'packages/library/package.json'),
    JSON.stringify({
      name: '@fixture/library',
      version: '1.0.0',
      scripts: { build: "bun -e \"await Bun.write('../../order.txt', 'library')\"" }
    })
  )
  await writeFile(
    join(root, 'packages/app/package.json'),
    JSON.stringify({
      name: '@fixture/app',
      version: '1.0.0',
      dependencies: { '@fixture/library': 'workspace:*' },
      scripts: {
        build:
          "bun -e \"const previous = await Bun.file('../../order.txt').text(); await Bun.write('../../order.txt', previous + ',app')\""
      }
    })
  )
  return root
}

describe('release workflow', () => {
  test('uses conventional release artifact locations', () => {
    expect(releasePaths('/repo')).toEqual({
      root: '/repo',
      artifacts: '/repo/.npm-packages',
      prepared: '/repo/.publish'
    })
  })

  test('creates a dependency-ordered publication plan from registry results', async () => {
    const root = await createWorkspace()
    const plan = await createPublicationPlan(
      root,
      async ({ manifest }) => manifest.name === '@fixture/library'
    )
    expect(plan.map(({ package: pkg, status }) => ({ name: pkg.manifest.name, status }))).toEqual([
      { name: '@fixture/library', status: 'published' },
      { name: '@fixture/app', status: 'unpublished' }
    ])
  })

  test('rejects incomplete or stale artifact sets before publication', () => {
    const packageEntry = {
      directory: 'packages/example',
      manifest: { name: '@fixture/example', version: '1.0.0' }
    }
    expect(() =>
      validatePublicationArtifacts([{ package: packageEntry, status: 'unpublished' }], new Map())
    ).toThrow('Missing verified package artifact for @fixture/example@1.0.0')
    expect(() =>
      validatePublicationArtifacts(
        [{ package: packageEntry, status: 'published' }],
        new Map([['@fixture/example@1.0.0', '/artifact.tgz']])
      )
    ).not.toThrow()
    expect(() =>
      validatePublicationArtifacts([], new Map([['@fixture/unknown@1.0.0', '/artifact.tgz']]))
    ).toThrow('Unexpected package artifact for @fixture/unknown@1.0.0')
  })

  test('packs and validates an unpublished release artifact', async () => {
    const root = join(tmpdir(), `open-pencil-release-pack-${crypto.randomUUID()}`)
    await mkdir(join(root, 'packages/example/dist'), { recursive: true })
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '1.0.0', workspaces: ['packages/example'] })
    )
    await writeFile(join(root, 'packages/example/dist/index.js'), 'export const ready = true\n')
    await writeFile(
      join(root, 'packages/example/dist/index.d.ts'),
      'export declare const ready: true\n'
    )
    await writeFile(
      join(root, 'packages/example/package.json'),
      JSON.stringify({
        name: '@fixture/release-package',
        version: '1.0.0',
        files: ['dist'],
        exports: {
          '.': {
            types: './dist/index.d.ts',
            import: './dist/index.js',
            default: './dist/index.js'
          }
        },
        publishConfig: { access: 'public' }
      })
    )

    await prepareReleasePackages(root)
    const plan = await packReleasePackages(root, async () => false)
    expect(plan.map(({ package: pkg, status }) => [pkg.manifest.name, status])).toEqual([
      ['@fixture/release-package', 'unpublished']
    ])
    expect(
      (await readdir(releasePaths(root).artifacts)).filter((name) => name.endsWith('.tgz'))
    ).toHaveLength(1)
  })

  test('builds discovered packages in dependency order', async () => {
    const root = await createWorkspace()
    const packages = await buildReleasePackages(root, { output: 'capture' })
    expect(packages.map(({ manifest }) => manifest.name)).toEqual([
      '@fixture/library',
      '@fixture/app'
    ])
    expect(await Bun.file(join(root, 'order.txt')).text()).toBe('library,app')
  })
})
