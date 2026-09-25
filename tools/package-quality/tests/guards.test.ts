import { describe, expect, test } from 'bun:test'

import { packagingGuardMismatches, packagingGuards } from '../src/smoke/guards'

const sourceOnlyGuard = packagingGuards.find(({ name }) =>
  name.startsWith('a source-only Bun condition')
)

describe('packaging guards', () => {
  test('cover a source-only Bun condition', () => {
    expect(sourceOnlyGuard).toMatchObject({
      files: ['dist'],
      bunTarget: './src/index.ts',
      diagnostics: [{ field: 'exports["."].bun', message: 'target is missing (./src/index.ts)' }],
      runtimes: { node: 'imports', bun: 'fails' }
    })
  })

  test('accept an observation that matches the guard', () => {
    if (!sourceOnlyGuard) throw new Error('Expected the source-only Bun condition guard')
    expect(
      packagingGuardMismatches(sourceOnlyGuard, {
        diagnostics: sourceOnlyGuard.diagnostics,
        runtimes: { node: 'imports', bun: 'fails' }
      })
    ).toEqual([])
  })

  test('report a silent inspector and an unexpected runtime outcome separately', () => {
    if (!sourceOnlyGuard) throw new Error('Expected the source-only Bun condition guard')
    const mismatches = packagingGuardMismatches(sourceOnlyGuard, {
      diagnostics: [],
      runtimes: { node: 'imports', bun: 'imports' }
    })
    expect(mismatches).toHaveLength(2)
    expect(mismatches[0]).toContain('expected diagnostics [exports["."].bun target is missing')
    expect(mismatches[0]).toContain('reported []')
    expect(mismatches[1]).toContain('expected bun to fail but it imported')
  })

  test('report diagnostics that appear when none are expected', () => {
    const [cleanGuard] = packagingGuards
    if (!cleanGuard) throw new Error('Expected at least one guard')
    expect(
      packagingGuardMismatches(cleanGuard, {
        diagnostics: [{ field: 'main', message: 'target is missing (./index.js)' }],
        runtimes: cleanGuard.runtimes
      })
    ).toEqual([
      `${cleanGuard.name}: expected diagnostics [] but the inspector reported [main target is missing (./index.js)]`
    ])
  })
})
