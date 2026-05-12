import type { EditorContext } from '#core/editor/types'
import type { SceneNode } from '#core/scene-graph'

type InstanceCreateSnapshot = Partial<SceneNode> & { id: string }

function createInstanceSnapshot(instance: SceneNode): InstanceCreateSnapshot {
  const { childIds: _childIds, parentId: _parentId, type: _type, ...snapshot } = instance
  return snapshot
}

export function createComponentInstanceActions(ctx: EditorContext) {
  function createInstanceFromComponent(
    componentId: string,
    x?: number,
    y?: number,
    parentId = ctx.state.currentPageId
  ) {
    const component = ctx.graph.getNode(componentId)
    if (component?.type !== 'COMPONENT') return null

    const instance = ctx.graph.createInstance(componentId, parentId, {
      x: x ?? component.x + component.width + 40,
      y: y ?? component.y
    })
    if (!instance) return null

    const instanceId = instance.id
    const snapshot = createInstanceSnapshot(instance)
    ctx.setSelectedIds(new Set([instanceId]))

    ctx.undo.push({
      label: 'Create instance',
      forward: () => {
        ctx.graph.createInstance(componentId, parentId, { ...snapshot })
        ctx.setSelectedIds(new Set([instanceId]))
      },
      inverse: () => {
        ctx.graph.deleteNode(instanceId)
        ctx.setSelectedIds(new Set([componentId]))
      }
    })
    return instanceId
  }

  function detachInstance(selectedNode: SceneNode | undefined) {
    if (selectedNode?.type !== 'INSTANCE') return

    const prevComponentId = selectedNode.componentId

    ctx.graph.detachInstance(selectedNode.id)
    ctx.setSelectedIds(new Set([selectedNode.id]))

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
