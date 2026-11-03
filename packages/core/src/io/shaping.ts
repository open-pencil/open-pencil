import type { CanvasKit } from 'canvaskit-wasm'

import type { ShapedText } from '@open-pencil/fig/node-change'
import type { SceneNode } from '@open-pencil/scene-graph'

import { shapeText } from '#core/canvas/text/shape'
import { fontManager } from '#core/text/font/manager'

/**
 * Run `use` with text shaped as the canvas lays it out, from the font provider the canvas of
 * `canvasKit` draws from, or one made for it that the last call to finish deletes.
 */
export async function withTextShaper<T>(
  canvasKit: CanvasKit,
  use: (shape: (node: SceneNode) => ShapedText | null) => Promise<T>
): Promise<T> {
  const provider = fontManager.acquireProvider(canvasKit)
  try {
    return await use((node) => shapeText(canvasKit, provider, node))
  } finally {
    fontManager.releaseProvider(provider)
  }
}
