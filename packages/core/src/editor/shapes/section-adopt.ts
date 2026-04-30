import type { EditorContext } from '#core/editor/types'

export function adoptNodesIntoSection(ctx: EditorContext, sectionId: string) {
  const section = ctx.graph.getNode(sectionId)
  if (section?.type !== 'SECTION') return

  const parentId = section.parentId ?? ctx.state.currentPageId
  const siblings = ctx.graph.getChildren(parentId)

  const sx = section.x
  const sy = section.y
  const sx2 = sx + section.width
  const sy2 = sy + section.height

  const toAdopt: string[] = []
  for (const sibling of siblings) {
    if (sibling.id === sectionId) continue
    const nx = sibling.x
    const ny = sibling.y
    const nx2 = nx + sibling.width
    const ny2 = ny + sibling.height
    if (nx >= sx && ny >= sy && nx2 <= sx2 && ny2 <= sy2) {
      toAdopt.push(sibling.id)
    }
  }

  if (toAdopt.length === 0) return

  const undoOps: Array<{
    id: string
    oldParent: string
    oldX: number
    oldY: number
    newX: number
    newY: number
  }> = []
  for (const id of toAdopt) {
    const node = ctx.graph.getNode(id)
    if (!node) continue
    const newX = node.x - sx
    const newY = node.y - sy
    undoOps.push({ id, oldParent: parentId, oldX: node.x, oldY: node.y, newX, newY })
    ctx.graph.reparentNode(id, sectionId)
    ctx.graph.updateNode(id, { x: newX, y: newY })
  }

  ctx.undo.push({
    label: 'Adopt into section',
    forward: () => {
      for (const op of undoOps) {
        ctx.graph.reparentNode(op.id, sectionId)
        ctx.graph.updateNode(op.id, { x: op.newX, y: op.newY })
      }
    },
    inverse: () => {
      for (const op of undoOps) {
        ctx.graph.reparentNode(op.id, op.oldParent)
        ctx.graph.updateNode(op.id, { x: op.oldX, y: op.oldY })
      }
    }
  })
}
