import type { SceneNode } from '../scene-graph'
import type { EditorContext } from './types'

export function createComponentActions(ctx: EditorContext) {
  function createComponentFromSelection(
    selectedNodes: SceneNode[],
    wrapSelectionInContainer: (
      type: 'GROUP' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET',
      nodes: SceneNode[],
      extra?: Partial<SceneNode>
    ) => string | null
  ) {
    if (selectedNodes.length === 0) return

    const prevSelection = new Set(ctx.state.selectedIds)

    if (selectedNodes.length === 1) {
      const node = selectedNodes[0]
      const prevType = node.type

      if (node.type === 'COMPONENT') return

      if (node.type === 'FRAME' || node.type === 'GROUP') {
        ctx.graph.updateNode(node.id, { type: 'COMPONENT' })
        ctx.state.selectedIds = new Set([node.id])
        ctx.undo.push({
          label: 'Create component',
          forward: () => {
            ctx.graph.updateNode(node.id, { type: 'COMPONENT' })
            ctx.state.selectedIds = new Set([node.id])
          },
          inverse: () => {
            ctx.graph.updateNode(node.id, { type: prevType })
            ctx.state.selectedIds = prevSelection
          }
        })
        return
      }
    }

    wrapSelectionInContainer('COMPONENT', selectedNodes)
  }

  function createComponentSetFromComponents(
    selectedNodes: SceneNode[],
    wrapSelectionInContainer: (
      type: 'GROUP' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET',
      nodes: SceneNode[],
      extra?: Partial<SceneNode>
    ) => string | null
  ) {
    if (selectedNodes.length < 2) return
    if (!selectedNodes.every((n) => n.type === 'COMPONENT')) return
    wrapSelectionInContainer('COMPONENT_SET', selectedNodes)
  }

  function createInstanceFromComponent(componentId: string, x?: number, y?: number) {
    const component = ctx.graph.getNode(componentId)
    if (component?.type !== 'COMPONENT') return null

    const parentId = component.parentId ?? ctx.state.currentPageId
    const instance = ctx.graph.createInstance(componentId, parentId, {
      x: x ?? component.x + component.width + 40,
      y: y ?? component.y
    })
    if (!instance) return null

    const instanceId = instance.id
    ctx.state.selectedIds = new Set([instanceId])

    ctx.undo.push({
      label: 'Create instance',
      forward: () => {
        ctx.graph.createInstance(componentId, parentId, { ...instance })
        ctx.state.selectedIds = new Set([instanceId])
      },
      inverse: () => {
        ctx.graph.deleteNode(instanceId)
        ctx.state.selectedIds = new Set([componentId])
      }
    })
    return instanceId
  }

  function detachInstance(selectedNode: SceneNode | undefined) {
    if (selectedNode?.type !== 'INSTANCE') return

    const prevComponentId = selectedNode.componentId

    ctx.graph.detachInstance(selectedNode.id)
    ctx.state.selectedIds = new Set([selectedNode.id])

    ctx.undo.push({
      label: 'Detach instance',
      forward: () => {
        ctx.graph.detachInstance(selectedNode.id)
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.updateNode(selectedNode.id, {
          type: 'INSTANCE',
          componentId: prevComponentId,
          overrides: {}
        })
      }
    })
  }

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

  return {
    createComponentFromSelection,
    createComponentSetFromComponents,
    createInstanceFromComponent,
    detachInstance,
    goToMainComponent
  }
}
