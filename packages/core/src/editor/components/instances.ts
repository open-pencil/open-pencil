import { cloneInstanceOverrideState } from '@open-pencil/scene-graph'
import type { SceneNode, Vector } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import type { EditorContext } from '#core/editor/types'

type InstanceCreateSnapshot = Partial<SceneNode> & { id: string }

function createInstanceSnapshot(instance: SceneNode): InstanceCreateSnapshot {
  const { childIds: _childIds, parentId: _parentId, type: _type, ...snapshot } = instance
  return snapshot
}

type DefaultInstancePlacement = {
  local: Vector
  world: Vector
}

function defaultInstancePlacement(
  ctx: EditorContext,
  component: SceneNode,
  parentId: string
): DefaultInstancePlacement {
  const bounds = getAxisAlignedWorldBounds(component, ctx.graph)
  const world = { x: bounds.x + bounds.width + 40, y: bounds.y }
  const parent = ctx.graph.getNode(parentId)
  if (!parent) return { local: world, world }
  const inverse = Matrix.invert(getWorldMatrix(parent, ctx.graph))
  return { local: inverse ? Matrix.mapPoint(inverse, world) : world, world }
}

function alignInstanceWorldBounds(
  ctx: EditorContext,
  instance: SceneNode,
  parentId: string,
  target: Vector
): void {
  const bounds = getAxisAlignedWorldBounds(instance, ctx.graph)
  const worldDelta = { x: target.x - bounds.x, y: target.y - bounds.y }
  const parent = ctx.graph.getNode(parentId)
  const inverse = parent ? Matrix.invert(getWorldMatrix(parent, ctx.graph)) : null
  if (!inverse) {
    ctx.graph.updateNode(instance.id, {
      x: instance.x + worldDelta.x,
      y: instance.y + worldDelta.y
    })
    return
  }
  const origin = Matrix.mapPoint(inverse, { x: 0, y: 0 })
  const delta = Matrix.mapPoint(inverse, worldDelta)
  ctx.graph.updateNode(instance.id, {
    x: instance.x + delta.x - origin.x,
    y: instance.y + delta.y - origin.y
  })
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

    const previousSelection = new Set(ctx.state.selectedIds)
    const defaultPlacement = defaultInstancePlacement(ctx, component, parentId)
    const instance = ctx.graph.createInstance(componentId, parentId, {
      x: x ?? defaultPlacement.local.x,
      y: y ?? defaultPlacement.local.y
    })
    if (!instance) return null
    if (x === undefined && y === undefined) {
      alignInstanceWorldBounds(ctx, instance, parentId, defaultPlacement.world)
    }

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
        ctx.setSelectedIds(new Set(previousSelection))
      }
    })
    return instanceId
  }

  function detachInstance(selectedNode: SceneNode | undefined) {
    if (selectedNode?.type !== 'INSTANCE') return

    const prevComponentId = selectedNode.componentId
    const previousOverrides = cloneInstanceOverrideState(selectedNode.instanceOverrides)

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
          instanceOverrides: cloneInstanceOverrideState(previousOverrides)
        })
      }
    })
  }

  return { createInstanceFromComponent, detachInstance }
}
