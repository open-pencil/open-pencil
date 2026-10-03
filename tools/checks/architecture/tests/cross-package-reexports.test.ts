import { describe, expect, test } from 'bun:test'

import { isCrossPackageReexportShim } from '../src/steiger-rules/cross-package-reexport-shims'

describe('cross-package re-export shims', () => {
  test('rejects star and named forwarding-only modules', () => {
    expect(
      isCrossPackageReexportShim(
        'packages/core/src/kiwi/fig/instance-overrides/index.ts',
        "export * from '@open-pencil/fig/instance-overrides'\n"
      )
    ).toBe(true)
    expect(
      isCrossPackageReexportShim(
        'packages/core/src/io/formats/fig/compress.ts',
        "export { compressFigDataSync } from '@open-pencil/fig'\n"
      )
    ).toBe(true)
  })

  test('allows package barrels with owned exports or implementation', () => {
    expect(
      isCrossPackageReexportShim(
        'packages/core/src/index.ts',
        "export { parsePenFile } from '@open-pencil/pen'\nexport { createEditor } from './editor'\n"
      )
    ).toBe(false)
    expect(
      isCrossPackageReexportShim(
        'packages/core/src/io/formats.ts',
        "import { parsePenFile } from '@open-pencil/pen'\nexport const pen = parsePenFile\n"
      )
    ).toBe(false)
  })
})
