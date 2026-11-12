import { afterEach, expect, mock, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { SceneGraph } from '@open-pencil/scene-graph'

import { fontManager } from '#core/text/font/manager'

const editors: Array<ReturnType<typeof createEditor>> = []

afterEach(() => {
  for (const editor of editors.splice(0)) editor.dispose()
})

/** An editor drawing through a renderer that records which layers it is asked to redraw. */
function setup() {
  const editor = createEditor()
  editors.push(editor)
  const text = editor.graph.createNode('TEXT', editor.state.currentPageId, { text: 'Held' })
  const redrawNode = mock((_nodeId: string, _graph?: SceneGraph) => undefined)
  const renderer: Partial<SkiaRenderer> = { redrawNode, measureTextNode: undefined }
  editor.setCanvasKit({} as Parameters<typeof editor.setCanvasKit>[0], renderer as SkiaRenderer)
  return { editor, redrawNode, text }
}

test('text held back while its fonts were prepared is drawn again once the last hold ends', () => {
  const { editor, redrawNode, text } = setup()
  fontManager.blockNodesUntilFontsResolve(editor.graph, [text.id])
  fontManager.blockNodesUntilFontsResolve(editor.graph, [text.id])

  fontManager.unblockNodes(editor.graph, [text.id])
  expect(redrawNode).not.toHaveBeenCalled()

  fontManager.unblockNodes(editor.graph, [text.id])
  expect(redrawNode.mock.calls).toEqual([[text.id, editor.graph]])
})

test('text of another document is left to that document’s renderers', () => {
  const { redrawNode } = setup()
  const other = new SceneGraph()
  fontManager.blockNodesUntilFontsResolve(other, ['elsewhere'])
  fontManager.unblockNodes(other, ['elsewhere'])
  expect(redrawNode).not.toHaveBeenCalled()
})

test('a disposed editor no longer redraws', () => {
  const { editor, redrawNode, text } = setup()
  editors.splice(editors.indexOf(editor), 1)
  editor.dispose()
  fontManager.blockNodesUntilFontsResolve(editor.graph, [text.id])
  fontManager.unblockNodes(editor.graph, [text.id])
  expect(redrawNode).not.toHaveBeenCalled()
})
