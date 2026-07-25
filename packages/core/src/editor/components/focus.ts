import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'

export function createComponentFocusActions(ctx: EditorContext) {
  async function focusComponent(
    componentId: string,
    switchPage: (pageId: string) => Promise<void>
  ) {
    const component = ctx.graph.getNode(componentId)
    if (component?.type !== 'COMPONENT' && component?.type !== 'COMPONENT_SET') return

    let page: SceneNode | undefined = component
    while (page && page.type !== 'CANVAS') {
      page = page.parentId ? ctx.graph.getNode(page.parentId) : undefined
    }
    if (page && page.id !== ctx.state.currentPageId) await switchPage(page.id)

    ctx.setSelectedIds(new Set([component.id]))

    const abs = ctx.graph.getAbsolutePosition(component.id)
    const { width: viewW, height: viewH } = ctx.getViewportSize()
    ctx.state.panX = viewW / 2 - (abs.x + component.width / 2) * ctx.state.zoom
    ctx.state.panY = viewH / 2 - (abs.y + component.height / 2) * ctx.state.zoom
    ctx.requestRender()
  }

  async function goToMainComponent(
    selectedNode: SceneNode | undefined,
    switchPage: (pageId: string) => Promise<void>
  ) {
    if (!selectedNode?.componentId) return
    const main = ctx.graph.getMainComponent(selectedNode.id)
    if (!main) return
    await focusComponent(main.id, switchPage)
  }

  return { focusComponent, goToMainComponent }
}
