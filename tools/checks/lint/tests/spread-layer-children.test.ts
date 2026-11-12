import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = '@open-pencil/editor/no-spread-layer-children'
const rules = { [rule]: 'error' }
const path = 'packages/core/src/canvas/walk.ts'

describe(rule, () => {
  test.each([
    'pending.push(...node.childIds)',
    'stack.push(...graph.getChildren(node.id))',
    'ids.push(...graph.getChildren(id).map((child) => child.id))',
    'Math.max(...parent.childIds.map(Number))'
  ])('rejects %s', async (call) => {
    expect(ruleDiagnostics(await lint(`${call}\n`, rules, path), rule)).toHaveLength(1)
  })

  test.each([
    'for (const childId of node.childIds) pending.push(childId)',
    'const ids = [...node.childIds]',
    'pending.push(...others)'
  ])('accepts %s', async (code) => {
    expect(ruleDiagnostics(await lint(`${code}\n`, rules, path), rule)).toHaveLength(0)
  })
})
