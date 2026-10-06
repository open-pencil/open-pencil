import { expect, mock, test } from 'bun:test'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

test('graph replacement clears tiled state even when page IDs are reused', () => {
  const editor = createEditor()
  const invalidateStructure = mock()
  // Only the tiled-scene invalidation is exercised; the rest of the renderer stays absent.
  const tiledScene: Partial<SkiaRenderer['tiledScene']> = { invalidateStructure }
  const renderer: Partial<SkiaRenderer> = {
    tiledScene: tiledScene as SkiaRenderer['tiledScene'],
    measureTextNode: undefined
  }
  editor.setCanvasKit({} as Parameters<typeof editor.setCanvasKit>[0], renderer as SkiaRenderer)
  const replacement = new SceneGraph()

  editor.replaceGraph(replacement)

  expect(invalidateStructure).toHaveBeenCalledTimes(1)
  expect(editor.graph).toBe(replacement)
})
