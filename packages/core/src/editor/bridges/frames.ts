import type { SceneNode, NodeType } from '@open-pencil/scene-graph'

import type { createSelectionActions } from '#core/editor/selection'
import type { EditorContext } from '#core/editor/types'
import type { createViewportActions } from '#core/editor/viewport'

type SelectionActions = ReturnType<typeof createSelectionActions>
type ViewportActions = ReturnType<typeof createViewportActions>

const FRAME_TYPES = new Set<NodeType>(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'])

/**
 * Figma's N and Shift+N: zoom to the next or previous top-level frame, including frames placed
 * in sections. Frames go left to right, then top to bottom, the order Figma documents for them.
 */
export function createFrameNavigationBridge(
  ctx: EditorContext,
  selection: SelectionActions,
  viewport: ViewportActions
) {
  function topLevelFrames(parentId: string): SceneNode[] {
    return ctx.graph.getChildren(parentId).flatMap((node) => {
      if (!node.visible) return []
      if (node.type === 'SECTION') return topLevelFrames(node.id)
      return FRAME_TYPES.has(node.type) ? [node] : []
    })
  }

  function zoomToAdjacentFrame(step: 1 | -1) {
    const frames = topLevelFrames(ctx.state.currentPageId)
      .map((node) => ({ node, position: ctx.graph.getAbsolutePosition(node.id) }))
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
      .map(({ node }) => node)
    if (frames.length === 0) return
    const ids = new Set(frames.map((frame) => frame.id))
    const [selectedId] = ctx.state.selectedIds
    const current = selectedId
      ? ctx.graph.closest(selectedId, (node) => ids.has(node.id))
      : undefined
    // Without a frame selected, next starts at the first frame and previous at the last.
    const start = step > 0 ? -1 : frames.length
    const index = current ? frames.findIndex((frame) => frame.id === current.id) : start
    const target = frames[(index + step + frames.length) % frames.length]
    selection.select([target.id])
    viewport.zoomToSelection()
  }

  return {
    zoomToNextFrame: () => zoomToAdjacentFrame(1),
    zoomToPreviousFrame: () => zoomToAdjacentFrame(-1)
  }
}
