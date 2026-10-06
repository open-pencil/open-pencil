import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { EditorContext } from '#core/editor/types'

function covers(outer: Rect, inner: Rect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

function adoptable(container: SceneNode, sibling: SceneNode) {
  if (sibling.id === container.id || sibling.locked) return false
  // Sections only go into pages and other sections.
  return sibling.type !== 'SECTION' || container.type === 'SECTION'
}

/**
 * Moves the unlocked siblings a frame or section fully covers into it, as Figma does when one is
 * drawn over layers or a section is moved or resized over them. Layers keep their places on the
 * canvas.
 */
export function adoptCoveredLayers(ctx: EditorContext, containerId: string) {
  const container = ctx.graph.getNode(containerId)
  if (container?.type !== 'SECTION' && container?.type !== 'FRAME') return

  const parentId = container.parentId ?? ctx.state.currentPageId
  const area = getAxisAlignedBoundsInParent([container], parentId, ctx.graph)
  const adopted = ctx.graph
    .getChildren(parentId)
    .filter(
      (sibling) =>
        adoptable(container, sibling) &&
        covers(area, getAxisAlignedBoundsInParent([sibling], parentId, ctx.graph))
    )
  if (adopted.length === 0) return

  const before = adopted.map((node) => ({ id: node.id, x: node.x, y: node.y }))
  for (const node of adopted) ctx.graph.reparentNode(node.id, containerId)
  const after = adopted.map((node) => {
    const moved = ctx.graph.getNode(node.id)
    return { id: node.id, x: moved?.x ?? node.x, y: moved?.y ?? node.y }
  })

  ctx.undo.push({
    label: 'Adopt covered layers',
    forward: () => {
      for (const op of after) {
        ctx.graph.reparentNode(op.id, containerId)
        ctx.graph.updateNode(op.id, { x: op.x, y: op.y })
      }
    },
    inverse: () => {
      for (const op of before) {
        ctx.graph.reparentNode(op.id, parentId)
        ctx.graph.updateNode(op.id, { x: op.x, y: op.y })
      }
    }
  })
}
