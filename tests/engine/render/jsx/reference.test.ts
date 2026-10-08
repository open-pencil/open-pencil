import { expect, test } from 'bun:test'

import { CODEGEN_PROMPT as BARREL_CODEGEN } from '@open-pencil/core'
import { renderJSX } from '@open-pencil/core/design-jsx'
import { CODEGEN_PROMPT } from '@open-pencil/core/tools'
import { AUTHORING_EXAMPLES, JSX_REFERENCE } from '@open-pencil/design-jsx'

import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

function exampleGraph() {
  const graph = makeSceneGraph()
  graph.addCollection({
    id: 'tokens',
    name: 'Tokens',
    modes: [
      { modeId: 'default', name: 'Default' },
      { modeId: 'compact', name: 'Compact' }
    ],
    defaultModeId: 'default',
    variableIds: []
  })
  for (const [name, value, compact] of [
    ['Space/small', 8, 4],
    ['Space/medium', 16, 12],
    ['Type/body', 12, 11],
    ['Type/body-leading', 20, 16],
    ['Type/body-tracking', 0.2, 0]
  ] as const) {
    graph.addVariable({
      id: name,
      name,
      type: 'FLOAT',
      collectionId: 'tokens',
      valuesByMode: { default: value, compact },
      description: '',
      hiddenFromPublishing: false
    })
  }
  return graph
}

for (const example of AUTHORING_EXAMPLES) {
  test(`shared authoring example: ${example.title}`, async () => {
    const graph = exampleGraph()
    const [result] = await renderJSX(graph, example.jsx)
    const frame = getNodeOrThrow(graph, result.id)
    expect(frame.width).toBe(280)
    expect(frame.height).toBeGreaterThan(32)
    expect(frame.layoutMode).toBe('VERTICAL')
    expect(graph.getChildren(frame.id).every((child) => child.type === 'TEXT')).toBe(true)
    expect(JSX_REFERENCE).toContain(example.jsx)
  })
}

test('shared bound example retains bindings and resolves the initial inherited mode', async () => {
  const graph = exampleGraph()
  const parent = graph.createNode('FRAME', graph.getPages()[0].id, {
    variableModes: { tokens: 'compact' }
  })
  for (const example of AUTHORING_EXAMPLES) {
    await renderJSX(graph, example.jsx, { parentId: parent.id })
  }
  const bound = graph.getChildren(parent.id).find((node) => node.boundVariables.itemSpacing)
  if (!bound) throw new Error('Expected a variable-bound authoring example')
  expect(bound.itemSpacing).toBe(4)
  expect(bound.paddingTop).toBe(12)
  expect(bound.boundVariables).toMatchObject({
    itemSpacing: 'Space/small',
    paddingTop: 'Space/medium',
    paddingRight: 'Space/medium',
    paddingBottom: 'Space/medium',
    paddingLeft: 'Space/medium'
  })
  const [text] = graph.getChildren(bound.id)
  expect(text.fontSize).toBe(11)
  expect(text.lineHeight).toBe(16)
  expect(text.letterSpacing).toBe(0)
  expect(text.boundVariables).toMatchObject({
    fontSize: 'Type/body',
    lineHeight: 'Type/body-leading',
    letterSpacing: 'Type/body-tracking'
  })
})

test('public exports and runtime prompts use the same authoring reference', () => {
  expect(BARREL_CODEGEN).toBe(CODEGEN_PROMPT)
  expect(CODEGEN_PROMPT).toContain(JSX_REFERENCE)
  expect(SYSTEM_PROMPT).toContain(JSX_REFERENCE)
  expect(CODEGEN_PROMPT.split(JSX_REFERENCE)).toHaveLength(2)
  expect(SYSTEM_PROMPT.split(JSX_REFERENCE)).toHaveLength(2)
})
