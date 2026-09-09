import { describe, expect, test } from 'bun:test'

import {
  collectExportTargets,
  concreteImportSpecifiers,
  validateManifest
} from '../src/manifest/exports'
import type { PackageManifest } from '../src/manifest/types'

const validManifest: PackageManifest = {
  name: '@open-pencil/example',
  version: '1.0.0',
  files: ['dist'],
  exports: {
    '.': {
      types: './dist/index.d.ts',
      bun: './dist/index.js',
      import: './dist/index.js'
    },
    './feature': { import: './dist/feature.js' },
    './pattern/*': { import: './dist/*.js' },
    './package.json': './package.json'
  }
}

describe('export metadata', () => {
  test('collects conditional targets with their fields', () => {
    expect(collectExportTargets(validManifest.exports, ['exports'])).toContainEqual({
      condition: 'bun',
      field: 'exports["."].bun',
      target: './dist/index.js'
    })
  })

  test('derives only concrete public import specifiers', () => {
    expect(concreteImportSpecifiers(validManifest)).toEqual([
      '@open-pencil/example',
      '@open-pencil/example/feature'
    ])
  })

  test('accepts pack-safe runtime targets', () => {
    expect(validateManifest(validManifest)).toEqual([])
  })

  test('rejects source bun targets and runtime declarations', () => {
    const diagnostics = validateManifest({
      ...validManifest,
      exports: {
        '.': {
          bun: './src/index.ts',
          import: './dist/index.d.ts'
        }
      }
    })
    expect(diagnostics.map(({ message }) => message)).toEqual([
      'target is excluded by files (./src/index.ts)',
      'runtime target is a declaration file (./dist/index.d.ts)'
    ])
  })
})
