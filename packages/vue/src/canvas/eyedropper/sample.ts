import { sampleScenePixels } from '@open-pencil/core'
import type { Editor, ScenePixels } from '@open-pencil/core'

/** The screen pixels around a world point at the view's zoom, the centre one sampled. */
export function sampleEyedropperPixels(
  editor: Editor,
  cx: number,
  cy: number,
  size: number
): ScenePixels | null {
  const renderer = editor.renderer
  if (!renderer) return null
  const { currentPageId, zoom } = editor.state
  return sampleScenePixels(renderer.ck, renderer, editor.graph, currentPageId, cx, cy, size, zoom)
}
