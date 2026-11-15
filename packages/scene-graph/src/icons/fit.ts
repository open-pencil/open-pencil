import type { SceneNode } from '../types'

/** What centering an icon's glyph needs of a graph. */
interface GlyphGraph {
  getNode(id: string): SceneNode | undefined
  getChildren(id: string): SceneNode[]
  updateNode(id: string, changes: Partial<SceneNode>): void
}

/**
 * Moves a glyph drawn `size` square at its frame's origin to the middle of the frame, as SVG fits
 * a square view box into a box of another shape. An icon is drawn at its frame's shorter side, so
 * it keeps its shape in a frame that is not square, whether placed or swapped.
 */
export function centerGlyph(graph: GlyphGraph, frameId: string, size: number): void {
  const frame = graph.getNode(frameId)
  if (!frame) return
  const x = (frame.width - size) / 2
  const y = (frame.height - size) / 2
  if (x === 0 && y === 0) return
  for (const path of graph.getChildren(frameId)) {
    graph.updateNode(path.id, { x: path.x + x, y: path.y + y })
  }
}
