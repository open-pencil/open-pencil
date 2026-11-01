import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

function cardsWithBoundSpacing() {
  const graph = new SceneGraph()
  const tokens = graph.createCollection('Tokens')
  const compact = graph.createMode(tokens.id, 'Compact') ?? ''
  const gap = graph.createVariable('Gap', 'FLOAT', tokens.id, 12)
  gap.valuesByMode[compact] = 2
  const hug = { primaryAxisSizing: 'HUG', counterAxisSizing: 'HUG' } as const
  const list = graph.createNode('FRAME', graph.getPages()[0].id, {
    layoutMode: 'VERTICAL',
    ...hug
  })
  const card = graph.createNode('FRAME', list.id, {
    layoutMode: 'HORIZONTAL',
    ...hug,
    boundVariables: { itemSpacing: gap.id }
  })
  graph.createNode('RECTANGLE', card.id, { width: 20, height: 10 })
  graph.createNode('RECTANGLE', card.id, { width: 20, height: 10 })
  const editor = createEditor({ graph })
  editor.runLayoutForNode(list.id)
  return { editor, tokens, compact, list, card }
}

test('a mode set on a frame reflows the auto layouts it reaches, and undo restores them', () => {
  const { editor, tokens, compact, list, card } = cardsWithBoundSpacing()

  editor.updateNodeWithUndo(list.id, { variableModes: { [tokens.id]: compact } }, 'Set mode')
  expect(card.width).toBe(42)
  expect(list.width).toBe(42)

  editor.undo.undo()
  expect(card.width).toBe(52)
  expect(list.width).toBe(52)
})

test('a mode set together with another change still lays out that change', () => {
  const { editor, tokens, compact, list } = cardsWithBoundSpacing()
  const unbound = editor.graph.createNode('FRAME', list.id, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG'
  })
  editor.graph.createNode('RECTANGLE', unbound.id, { width: 20, height: 10 })
  editor.runLayoutForNode(unbound.id)

  editor.updateNode(unbound.id, { variableModes: { [tokens.id]: compact }, paddingLeft: 8 })

  expect(unbound.width).toBe(28)
})
