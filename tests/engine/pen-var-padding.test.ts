import { describe, expect, test } from 'bun:test'

import { applyPadding, isVarRef, type VarContext } from '@open-pencil/core/io/formats/pen'
import type { SceneNode } from '@open-pencil/core'

/**
 * Regression test for open-pencil/open-pencil#201
 *
 * Design token variables ($--spacing-lg etc.) in padding and gap fields
 * must be resolved to numeric values before reaching yoga-layout.
 * Without the fix, yoga-layout crashes with:
 *   "Invalid value $--spacing-lg for setPadding"
 */

function makeNode(): SceneNode {
  return {
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    boundVariables: {},
  } as unknown as SceneNode
}

function makeVarContext(vars: Record<string, number>): VarContext {
  const byName = new Map<string, { id: string; variable: { valuesByMode: Record<string, number> } }>()
  for (const [name, value] of Object.entries(vars)) {
    byName.set(name, { id: name, variable: { valuesByMode: { default: value } } })
  }
  return {
    byName,
    activeModeId: 'default',
    collectionId: 'test',
    modeByThemeName: new Map(),
    resolveColor: () => ({ r: 0, g: 0, b: 0, a: 1 }),
    resolveNumber(ref: string): number {
      const entry = byName.get(ref.replace(/^\$/, ''))
      if (!entry) return 0
      const val = entry.variable.valuesByMode['default']
      return typeof val === 'number' ? val : 0
    },
    resolveString: () => '',
    setActiveTheme: () => {},
  } as unknown as VarContext
}

const ctx = makeVarContext({
  '--spacing-sm': 8,
  '--spacing-md': 16,
  '--spacing-lg': 24,
})

describe('applyPadding — variable resolution (#201)', () => {
  test('resolves $--spacing-lg variable as single padding value', () => {
    const node = makeNode()
    applyPadding(node, '$--spacing-lg', ctx)

    expect(node.paddingTop).toBe(24)
    expect(node.paddingRight).toBe(24)
    expect(node.paddingBottom).toBe(24)
    expect(node.paddingLeft).toBe(24)
  })

  test('resolves variable references in padding array', () => {
    const node = makeNode()
    applyPadding(node, ['$--spacing-sm', '$--spacing-lg', '$--spacing-sm', '$--spacing-lg'], ctx)

    expect(node.paddingTop).toBe(8)
    expect(node.paddingRight).toBe(24)
    expect(node.paddingBottom).toBe(8)
    expect(node.paddingLeft).toBe(24)
  })

  test('mixed numeric and variable padding array', () => {
    const node = makeNode()
    applyPadding(node, [10, '$--spacing-lg', 10, '$--spacing-sm'], ctx)

    expect(node.paddingTop).toBe(10)
    expect(node.paddingRight).toBe(24)
    expect(node.paddingBottom).toBe(10)
    expect(node.paddingLeft).toBe(8)
  })

  test('numeric padding still works (regression)', () => {
    const node = makeNode()
    applyPadding(node, [10, 20, 10, 20])

    expect(node.paddingTop).toBe(10)
    expect(node.paddingRight).toBe(20)
    expect(node.paddingBottom).toBe(10)
    expect(node.paddingLeft).toBe(20)
  })

  test('single numeric padding still works (regression)', () => {
    const node = makeNode()
    applyPadding(node, 16)

    expect(node.paddingTop).toBe(16)
    expect(node.paddingRight).toBe(16)
    expect(node.paddingBottom).toBe(16)
    expect(node.paddingLeft).toBe(16)
  })

  test('undefined padding is a no-op', () => {
    const node = makeNode()
    node.paddingTop = 99
    applyPadding(node, undefined, ctx)

    expect(node.paddingTop).toBe(99)
  })

  test('unresolvable variable falls back to 0', () => {
    const node = makeNode()
    applyPadding(node, '$--unknown-var', ctx)

    expect(node.paddingTop).toBe(0)
  })
})

describe('isVarRef', () => {
  test('recognizes $--xxx as variable reference', () => {
    expect(isVarRef('$--spacing-lg')).toBe(true)
    expect(isVarRef('$--color-primary')).toBe(true)
  })

  test('rejects non-variable strings', () => {
    expect(isVarRef('24')).toBe(false)
    expect(isVarRef('spacing-lg')).toBe(false)
    expect(isVarRef('')).toBe(false)
  })

  test('rejects non-string values', () => {
    expect(isVarRef(24)).toBe(false)
    expect(isVarRef(undefined)).toBe(false)
    expect(isVarRef(null)).toBe(false)
  })
})
