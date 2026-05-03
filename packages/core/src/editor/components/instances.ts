import type { EditorContext } from '#core/editor/types'
import type { SceneNode } from '#core/scene-graph'

export function createComponentInstanceActions(ctx: EditorContext) {
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

  return { createInstanceFromComponent, detachInstance }
}
