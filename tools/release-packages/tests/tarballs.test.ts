import { describe, expect, test } from 'bun:test'

import { packageBinTargets } from '../src/tarballs'

describe('packageBinTargets', () => {
  test('normalizes string bin fields', () => {
    expect(packageBinTargets({ name: '@open-pencil/cli', bin: './bin/openpencil.js' })).toEqual({
      '@open-pencil/cli': './bin/openpencil.js'
    })
  })

  test('keeps named bin fields', () => {
    expect(
      packageBinTargets({ name: '@open-pencil/cli', bin: { openpencil: './bin/openpencil.js' } })
    ).toEqual({
      openpencil: './bin/openpencil.js'
    })
  })
})
