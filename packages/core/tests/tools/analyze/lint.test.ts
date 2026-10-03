import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

function tool(name: string) {
  const def = ALL_TOOLS.find((candidate) => candidate.name === name)
  if (!def) throw new Error(`Missing tool ${name}`)
  return def
}

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const pageId = graph.getPages()[0].id
  const card = graph.createNode('FRAME', pageId, {
    name: 'Card',
    x: 0.5,
    width: 200,
    height: 100,
    cornerRadius: 10
  })
  return { graph, figma, card }
}

describe('lint tool', () => {
  test('lists findings of the current page with their fixes, without changing it', () => {
    const { graph, figma, card } = setup()

    const result = tool('lint').execute(figma, { rules: ['pixel-perfect', 'consistent-radius'] })

    expect(result).toMatchObject({ info: 2, fixable: 1 })
    expect(result).toHaveProperty('issues', [
      expect.objectContaining({
        rule: 'pixel-perfect',
        node_id: card.id,
        fix: { kind: 'set', changes: { x: 1 } }
      }),
      expect.objectContaining({
        rule: 'consistent-radius',
        suggestions: [{ kind: 'set', changes: { cornerRadius: 12 } }]
      })
    ])
    expect(getNodeOrThrow(graph, card.id).x).toBe(0.5)
  })

  test('rejects unknown rules', () => {
    const { figma } = setup()
    expect(() => tool('lint').execute(figma, { rules: ['no-such-rule'] })).toThrow()
  })
})

describe('lint_fix tool', () => {
  test('applies safe fixes, and suggestions only when asked', () => {
    const { graph, figma, card } = setup()
    const rules = ['pixel-perfect', 'consistent-radius']

    expect(tool('lint_fix').execute(figma, { rules })).toEqual({
      applied: 1,
      remaining: { errors: 0, warnings: 0, info: 1 }
    })
    expect(getNodeOrThrow(graph, card.id)).toMatchObject({ x: 1, cornerRadius: 10 })

    expect(tool('lint_fix').execute(figma, { rules, suggestions: true })).toEqual({
      applied: 1,
      remaining: { errors: 0, warnings: 0, info: 0 }
    })
    expect(getNodeOrThrow(graph, card.id).cornerRadius).toBe(12)
  })
})
