import type { EditorContext } from '#core/editor/types'
import { resolveEditorProfile } from '#core/editor/views'

export function createSelectionContainerActions(ctx: EditorContext) {
  function validateEnteredContainer() {
    if (ctx.state.enteredContainerId && !ctx.graph.getNode(ctx.state.enteredContainerId)) {
      ctx.state.enteredContainerId = null
    }
  }

  function enterContainer(id: string) {
    ctx.state.enteredContainerId = id
  }

  /**
   * Enters the container a click reached the layer through, as a double-click would have: its
   * parent, unless that is the page or a container a click looks into by itself (a top-level
   * frame in a design, a section, a component set), which is never entered.
   */
  function enterContainerOf(nodeId: string) {
    const parentId = ctx.graph.getNode(nodeId)?.parentId ?? null
    const { framesOpen } = resolveEditorProfile(ctx.state)
    const entered =
      parentId &&
      parentId !== ctx.state.currentPageId &&
      !ctx.graph.isOpenContainer(parentId, framesOpen)
    ctx.state.enteredContainerId = entered ? parentId : null
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

  /** Leaves every entered container; a press on nothing lands on the page, as in Figma. */
  function exitContainers() {
    ctx.state.enteredContainerId = null
  }

  return {
    validateEnteredContainer,
    enterContainer,
    enterContainerOf,
    exitContainer,
    exitContainers
  }
}
