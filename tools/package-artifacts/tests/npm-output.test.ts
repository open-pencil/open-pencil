import { expect, test } from 'bun:test'

import { parsePackageManifest } from '../src/manifest/read'
import { parseNpmPack } from '../src/npm/pack'

test('npm pack parser validates archive names and paths', () => {
  expect(
    parseNpmPack(JSON.stringify([{ filename: 'pkg.tgz', files: [{ path: 'src/index.ts' }] }]))
  ).toEqual({ filename: 'pkg.tgz', files: ['src/index.ts'] })
  for (const value of [
    null,
    [],
    [
      { filename: 'a.tgz', files: [] },
      { filename: 'b.tgz', files: [] }
    ],
    [{ filename: 42, files: [] }],
    [{ filename: 'pkg.tgz', files: [{ path: '' }] }],
    [{ filename: 'pkg.tgz', files: [{ path: '/absolute' }] }],
    [{ filename: 'pkg.tgz', files: [{ path: 'src\\\\index.ts' }] }],
    [{ filename: '../pkg.tgz', files: [] }],
    [{ filename: 'pkg.tgz', files: [{ path: '../outside' }] }]
  ]) {
    expect(() => parseNpmPack(JSON.stringify(value))).toThrow('npm pack:')
  }
})

test('npm pack parser ignores unrelated npm fields', () => {
  expect(
    parseNpmPack(
      JSON.stringify([
        {
          filename: 'pkg.tgz',
          size: 123,
          integrity: 'sha512-example',
          files: [{ path: 'src/value.ts', size: 10, mode: 420 }]
        }
      ])
    )
  ).toEqual({ filename: 'pkg.tgz', files: ['src/value.ts'] })
})

test('tarball manifest identity errors include archive context', () => {
  expect(() => parsePackageManifest('{', 'archive.tgz')).toThrow('archive.tgz: invalid JSON')
  expect(() => parsePackageManifest('{"name":3}', 'archive.tgz')).toThrow(
    'archive.tgz: invalid package manifest'
  )
})
