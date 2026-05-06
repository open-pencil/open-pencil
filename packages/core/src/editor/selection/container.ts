import type { EditorContext } from '#core/editor/types'

export function createSelectionContainerActions(ctx: EditorContext) {
  function validateEnteredContainer() {
    if (ctx.state.enteredContainerId && !ctx.graph.getNode(ctx.state.enteredContainerId)) {
      ctx.state.enteredContainerId = null
    }
  }

  function enterContainer(id: string) {
    ctx.state.enteredContainerId = id
  }

  function exitContainer() {
    const entered = ctx.state.enteredContainerId
    if (!entered) return
    const node = ctx.graph.getNode(entered)
    const parentId = node?.parentId
    if (parentId && parentId !== ctx.state.currentPageId) {
      ctx.state.enteredContainerId = parentId
    } else {
      ctx.state.enteredContainerId = null
    }
    ctx.setSelectedIds(new Set(entered ? [entered] : []))
  }

  return { validateEnteredContainer, enterContainer, exitContainer }
}
