import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { Color, Fill } from '@open-pencil/scene-graph'

import { createAndBindColorVariable } from '#vue/controls/binding-provider/color'
import { prepareModeEdit } from '#vue/controls/binding-provider/mode-edit'

const fill: Fill = {
  type: 'SOLID',
  color: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
  opacity: 1,
  visible: true
}

function setup() {
  const editor = createEditor()
  const page = editor.graph.getPages()[0]
  if (!page) throw new Error('Expected initial page')
  const node = editor.graph.createNode('RECTANGLE', page.id, {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fills: [structuredClone(fill)]
  })
  return { editor, node }
}

describe('color binding provider helpers', () => {
  test('creates a color collection, variable, and indexed binding', () => {
    const { editor, node } = setup()
    createAndBindColorVariable(
      editor,
      { nodeId: node.id, path: 'fills/0/color' },
      fill.color,
      'Brand/accent'
    )

    const variableId = editor.getNode(node.id)?.boundVariables['fills/0/color']
    expect(variableId).toBeString()
    const variable = variableId ? editor.getVariable(variableId) : undefined
    expect(variable?.name).toBe('Brand/accent')
    expect(variable?.type).toBe('COLOR')
    expect(variableId ? editor.resolveColorVariable(variableId) : undefined).toEqual(fill.color)
  })

  test('reuses a color collection and edits only the captured mode', () => {
    const { editor, node } = setup()
    const collection = editor.graph.createCollection('Product colors')
    editor.graph.addMode(collection.id, 'dark', 'Dark')
    editor.graph.createVariable('Existing', 'COLOR', collection.id, fill.color)

    createAndBindColorVariable(
      editor,
      { nodeId: node.id, path: 'fills/0/color' },
      fill.color,
      'Brand/accent'
    )

    expect(editor.getCollections()).toHaveLength(1)
    const variableId = editor.getNode(node.id)?.boundVariables['fills/0/color']
    if (!variableId) throw new Error('Expected color binding')
    const next: Color = { r: 0.9, g: 0.1, b: 0.3, a: 0.75 }
    const edit = prepareModeEdit(
      editor,
      variableId,
      { nodeId: node.id, path: 'fills/0/color' },
      () => editor.graph.resolveColorVariableForNode(node.id, variableId)
    )
    if (!edit) throw new Error('No edit')
    edit.set(next)

    const variable = editor.getVariable(variableId)
    expect(variable).toBeDefined()
    expect(variable?.valuesByMode[collection.defaultModeId]).toEqual(next)
    expect(variable?.valuesByMode.dark).toEqual(fill.color)
  })
})
