import { describe, expect, test } from 'bun:test'

import { packagingGuardMismatches, packagingGuards } from '#package-quality/smoke/guards'

const BUN_MISSING_TARGET =
  "error: Cannot find module '@fixture/resolution' from '/tmp/consumer/[eval]'\n\nBun v1.4.2"
const BUN_UNRELATED = "error: Unexpected token '}' in /tmp/consumer/[eval]"

const sourceOnlyGuard = packagingGuards.find(({ name }) =>
  name.startsWith('a source-only Bun condition')
)

function requireSourceOnlyGuard() {
  if (!sourceOnlyGuard) throw new Error('Expected the source-only Bun condition guard')
  return sourceOnlyGuard
}

describe('packaging guards', () => {
  test('cover a source-only Bun condition', () => {
    const guard = requireSourceOnlyGuard()
    expect(guard).toMatchObject({
      files: ['dist'],
      bunTarget: './src/index.ts',
      diagnostics: [{ field: 'exports["."].bun', message: 'target is missing (./src/index.ts)' }]
    })
    expect(guard.runtimes.node).toBe('imports')
    const bun = guard.runtimes.bun
    if (bun === 'imports') throw new Error('Expected Bun to fail')
    expect(bun.failsWith.test(BUN_MISSING_TARGET)).toBe(true)
    expect(bun.failsWith.test(BUN_UNRELATED)).toBe(false)
  })

  test('accept an observation that matches the guard', () => {
    const guard = requireSourceOnlyGuard()
    expect(
      packagingGuardMismatches(guard, {
        diagnostics: guard.diagnostics,
        runtimes: { node: 'imports', bun: { failed: BUN_MISSING_TARGET } }
      })
    ).toEqual([])
  })

  test('report a silent inspector and an unexpected import separately', () => {
    const guard = requireSourceOnlyGuard()
    const mismatches = packagingGuardMismatches(guard, {
      diagnostics: [],
      runtimes: { node: 'imports', bun: 'imports' }
    })
    expect(mismatches).toHaveLength(2)
    expect(mismatches[0]).toContain('expected diagnostics [exports["."].bun target is missing')
    expect(mismatches[0]).toContain('reported []')
    expect(mismatches[1]).toContain('bun should fail with')
    expect(mismatches[1]).toContain('but imported')
  })

  test('reject a Bun failure that is not the expected resolution failure', () => {
    const guard = requireSourceOnlyGuard()
    const bun = guard.runtimes.bun
    if (bun === 'imports') throw new Error('Expected Bun to fail')
    expect(
      packagingGuardMismatches(guard, {
        diagnostics: guard.diagnostics,
        runtimes: { node: 'imports', bun: { failed: BUN_UNRELATED } }
      })
    ).toEqual([
      `${guard.name}: bun should fail with ${bun.failsWith} but failed with: ${BUN_UNRELATED}`
    ])
  })

  test('report a runtime that should import but failed', () => {
    const [cleanGuard] = packagingGuards
    if (!cleanGuard) throw new Error('Expected at least one guard')
    expect(
      packagingGuardMismatches(cleanGuard, {
        diagnostics: [],
        runtimes: {
          node: { failed: 'Error: fixture export missing\n    at [eval]' },
          bun: 'imports'
        }
      })
    ).toEqual([`${cleanGuard.name}: node should import but failed: Error: fixture export missing`])
  })

  test('report diagnostics that appear when none are expected', () => {
    const [cleanGuard] = packagingGuards
    if (!cleanGuard) throw new Error('Expected at least one guard')
    expect(
      packagingGuardMismatches(cleanGuard, {
        diagnostics: [{ field: 'main', message: 'target is missing (./index.js)' }],
        runtimes: { node: 'imports', bun: 'imports' }
      })
    ).toEqual([
      `${cleanGuard.name}: expected diagnostics [] but the inspector reported [main target is missing (./index.js)]`
    ])
  })
})
