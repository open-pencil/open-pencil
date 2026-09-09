import { expect, test } from 'bun:test'

import { parsePackageManifest } from '../src/manifest'
import { parseNpmPack } from '../src/npm-output'

test('npm pack parser validates archive names and paths', () => {
  expect(
    parseNpmPack(JSON.stringify([{ filename: 'pkg.tgz', files: [{ path: 'src/index.ts' }] }]))
  ).toEqual({ filename: 'pkg.tgz', files: ['src/index.ts'] })
  for (const value of [
    null,
    [],
    [{ filename: '../pkg.tgz', files: [] }],
    [{ filename: 'pkg.tgz', files: [{ path: '../outside' }] }]
  ]) {
    expect(() => parseNpmPack(JSON.stringify(value))).toThrow('npm pack:')
  }
})

test('tarball manifest identity errors include archive context', () => {
  expect(() => parsePackageManifest('{', 'archive.tgz')).toThrow('archive.tgz: invalid JSON')
  expect(() => parsePackageManifest('{"name":3}', 'archive.tgz')).toThrow(
    'archive.tgz: package name and version'
  )
})
