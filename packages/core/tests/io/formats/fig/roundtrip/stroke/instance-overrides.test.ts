import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, Stroke } from '@open-pencil/scene-graph'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'
import { collectAllNodes } from '@open-pencil/test-support/fig/traversal'

const BLUE = { r: 0, g: 0, b: 1, a: 1 }
const RED = { r: 1, g: 0, b: 0, a: 1 }

const editors: Editor[] = []
afterEach(() => {
  for (const editor of editors.splice(0)) editor.dispose()
})

function instanceLayer() {
  const editor = createEditor()
  editors.push(editor)
  const graph = editor.graph
  const page = graph.getPages()[0]
  const main = graph.createNode('COMPONENT', page.id, { name: 'Main', width: 100, height: 100 })
  const shape = graph.createNode('VECTOR', main.id, {
    name: 'Shape',
    width: 50,
    height: 50,
    strokes: [
      {
        type: 'SOLID',
        color: BLUE,
        opacity: 1,
        visible: true,
        weight: 1,
        align: 'CENTER',
        cap: 'NONE',
        join: 'MITER',
        dashPattern: []
      }
    ]
  })
  const instance = expectDefined(graph.createInstance(main.id, page.id, { name: 'Copy' }), 'copy')
  const layer = getNodeOrThrow(graph, expectDefined(instance.childIds[0], 'copy layer'))
  return { editor, graph, main, shape, layer }
}

async function reopenedCopyLayer(graph: SceneGraph) {
  const bytes = await exportFigFile(graph)
  const reopened = await parseFigFile(bytes.buffer as ArrayBuffer)
  const copy = expectDefined(
    collectAllNodes(reopened).find((node) => node.type === 'INSTANCE' && node.name === 'Copy'),
    'reopened copy'
  )
  return getNodeOrThrow(reopened, expectDefined(copy.childIds[0], 'reopened copy layer'))
}

const EDITS: [string, Partial<Stroke>][] = [
  ['A weight', { weight: 5 }],
  ['An alignment', { align: 'OUTSIDE' }],
  ['A cap', { cap: 'ROUND' }],
  ['A join', { join: 'BEVEL' }],
  ['A dash', { dashPattern: [6, 4] }]
]

describe('roundtrip: stroke settings an instance overrides', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test.each(EDITS)('%s the stroke panel sets on a copy’s stroke is saved', async (_, edit) => {
    const { editor, graph, layer } = instanceLayer()
    // The panel's stroke fields patch the stroke itself.
    editor.updateNodeWithUndo(layer.id, {
      strokes: layer.strokes.map((stroke) => ({ ...stroke, ...edit }))
    })

    const reopened = await reopenedCopyLayer(graph)

    expect(reopened.strokes[0]).toMatchObject(edit)
  })

  test('a copy that takes a weight keeps taking the component’s stroke color, saved and reopened', async () => {
    const { editor, graph, main, shape, layer } = instanceLayer()
    editor.updateNodeWithUndo(layer.id, {
      strokes: layer.strokes.map((stroke) => ({ ...stroke, weight: 5 }))
    })
    graph.updateNode(shape.id, {
      strokes: shape.strokes.map((stroke) => ({ ...stroke, color: RED }))
    })
    graph.syncInstances(main.id)

    expect(layer.strokes[0]).toMatchObject({ weight: 5, color: RED })
    expect((await reopenedCopyLayer(graph)).strokes[0]).toMatchObject({ weight: 5, color: RED })
  })

  test('undo takes a stroke weight back from the stroke and the layer', () => {
    const { editor, layer } = instanceLayer()
    editor.updateNodeWithUndo(layer.id, {
      strokes: layer.strokes.map((stroke) => ({ ...stroke, weight: 5 }))
    })
    expect(layer.strokeWeight).toBe(5)

    editor.undo.undo()

    expect(layer.strokes[0]?.weight).toBe(1)
    expect(layer.strokeWeight).toBe(1)
  })
})
