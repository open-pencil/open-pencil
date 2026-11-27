import { afterEach } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import type { SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

/**
 * Editors editing "Hello world" with "world" selected, each with a renderer that has its fonts,
 * disposed after the test that made it. `props` gives the text layer its own properties.
 */
export function editingWorldFixture() {
  const cleanups: (() => void)[] = []
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup()
  })
  return async (props: Partial<SceneNode> = {}) => {
    const ck = await getCanvasKit()
    const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(200, 200), 'surface'))
    const editor = createEditor()
    editor.setCanvasKit(ck, renderer)
    await renderer.loadFonts()
    cleanups.push(() => {
      editor.dispose()
      renderer.destroy()
    })
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello world',
      width: 200,
      height: 20,
      ...props
    })
    editor.startTextEditing(text.id)
    const state = expectDefined(editor.textEditor?.state, 'text editor state')
    state.selectionAnchor = 6
    state.cursor = 11
    const node = () => expectDefined(editor.graph.getNode(text.id), 'text')
    return { editor, graph: editor.graph, id: text.id, node, state }
  }
}
