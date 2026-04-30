import type { EditorContext } from '#core/editor/types'

export function createStructureStateActions(ctx: EditorContext) {
  function toggleNodeVisibility(id: string) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    ctx.graph.updateNode(id, { visible: !node.visible })
  }

  function toggleNodeLock(id: string) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    ctx.graph.updateNode(id, { locked: !node.locked })
  }

  function toggleVisibility() {
    for (const id of ctx.state.selectedIds) toggleNodeVisibility(id)
  }

  function toggleLock() {
    for (const id of ctx.state.selectedIds) toggleNodeLock(id)
  }

  return { toggleNodeVisibility, toggleNodeLock, toggleVisibility, toggleLock }
}
