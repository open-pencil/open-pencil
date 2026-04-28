import type { SceneNode } from '#core/scene-graph'
import type { EditorContext } from '#core/editor/types'

export function createComponentFocusActions(ctx: EditorContext) {
  function goToMainComponent(
    selectedNode: SceneNode | undefined,
    switchPage: (pageId: string) => Promise<void>
  ) {
    if (!selectedNode?.componentId) return
    const main = ctx.graph.getMainComponent(selectedNode.id)
    if (!main) return

    let current: SceneNode | undefined = main
    while (current && current.type !== 'CANVAS') {
      current = current.parentId ? ctx.graph.getNode(current.parentId) : undefined
    }
    if (current && current.id !== ctx.state.currentPageId) {
      void switchPage(current.id)
    }

    ctx.state.selectedIds = new Set([main.id])

    const abs = ctx.graph.getAbsolutePosition(main.id)
    const { width: viewW, height: viewH } = ctx.getViewportSize()
    ctx.state.panX = viewW / 2 - (abs.x + main.width / 2) * ctx.state.zoom
    ctx.state.panY = viewH / 2 - (abs.y + main.height / 2) * ctx.state.zoom
    ctx.requestRender()
  }

  return { goToMainComponent }
}
