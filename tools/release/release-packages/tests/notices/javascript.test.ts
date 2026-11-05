import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { bundledPackages, javascriptNotices, packageDirectoryOf } from '#release/notices/javascript'

test('finds the package a module comes from after the last node_modules', () => {
  expect(packageDirectoryOf('/r/node_modules/vue/dist/vue.js')).toBe('/r/node_modules/vue')
  expect(
    packageDirectoryOf('/r/node_modules/.bun/@vue+shared@3.5.0/node_modules/@vue/shared/x.js?v=1')
  ).toBe('/r/node_modules/.bun/@vue+shared@3.5.0/node_modules/@vue/shared')
  expect(packageDirectoryOf('/r/packages/core/src/index.ts')).toBeNull()
  expect(packageDirectoryOf('\0vite/preload-helper.js')).toBeNull()
})

async function writePackage(root: string, name: string, files: Record<string, string>) {
  const directory = join(root, 'node_modules', name)
  await mkdir(directory, { recursive: true })
  for (const [file, text] of Object.entries(files)) await writeFile(join(directory, file), text)
  return directory
}

test("lists each bundled package once with its license files' texts", async () => {
  const root = await mkdtemp(join(tmpdir(), 'notices-js-'))
  try {
    const vue = await writePackage(root, 'vue', {
      'package.json': JSON.stringify({ name: 'vue', version: '3.5.0', license: 'MIT' }),
      LICENSE: 'MIT License\nCopyright (c) Evan You',
      'README.md': 'not a license'
    })
    const bare = await writePackage(root, '@scope/bare', {
      'package.json': JSON.stringify({ name: '@scope/bare', version: '1.0.0' })
    })
    const packages = await bundledPackages([
      join(vue, 'dist/a.js'),
      join(vue, 'dist/b.js'),
      join(bare, 'index.js'),
      join(root, 'src/main.ts')
    ])
    expect(packages).toEqual([
      { name: '@scope/bare', version: '1.0.0', license: 'UNKNOWN', texts: [] },
      {
        name: 'vue',
        version: '3.5.0',
        license: 'MIT',
        texts: ['MIT License\nCopyright (c) Evan You']
      }
    ])
    const notices = javascriptNotices(packages)
    expect(notices).toContain('## vue 3.5.0')
    expect(notices).toContain('Copyright (c) Evan You')
    expect(notices).toContain('The package carries no license file.')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('fences a license text longer than any backtick run inside it', () => {
  const notices = javascriptNotices([
    { name: 'a', version: '1.0.0', license: 'MIT', texts: ['uses ``` fences'] }
  ])
  expect(notices).toContain('````text\nuses ``` fences\n````')
})
