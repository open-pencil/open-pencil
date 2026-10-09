import { canCreateInstance, resolveComponentPropertyValue } from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { pathTextEditChanges } from '#core/editor/text/path-edit'
import type { EditorContext } from '#core/editor/types'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'

import type { ExposableComponentField } from './context'

type Patch = (id: string, changes: Partial<SceneNode>, label: string) => void

export function acceptsComponentPropertyValue(
  graph: SceneGraph,
  node: SceneNode,
  field: ExposableComponentField,
  value: string
) {
  if (field === 'TEXT') return node.type === 'TEXT'
  if (field === 'VISIBLE') return value === 'true' || value === 'false'
  const target = resolveComponentPropertyValue(graph, value)
  return (
    node.type === 'INSTANCE' &&
    !!target &&
    !!node.parentId &&
    canCreateInstance(graph, target.id, node.parentId)
  )
}

export function componentPropertyTextChanges(node: SceneNode, value: string): Partial<SceneNode> {
  const changes = { text: value }
  return {
    ...changes,
    ...textAutoResizeChanges(node, changes),
    ...pathTextEditChanges(node, changes)
  }
}

export function createAuthoringValueActions(ctx: EditorContext, patch: Patch) {
  function accepts(node: SceneNode, field: ExposableComponentField, value: string) {
    return acceptsComponentPropertyValue(ctx.graph, node, field, value)
  }

  function apply(node: SceneNode, field: ExposableComponentField, value: string) {
    if (field === 'INSTANCE_SWAP') {
      const target = resolveComponentPropertyValue(ctx.graph, value)
      const previous = node.componentId
      if (!target || !previous || previous === target.id) return
      const swap = (componentId: string) => {
        ctx.graph.swapInstanceComponent(node.id, componentId)
        ctx.runLayoutForNode(node.id)
        ctx.requestRender()
      }
      ctx.undo.execute({
        label: 'Change property source',
        forward: () => swap(target.id),
        inverse: () => swap(previous)
      })
    } else if (field === 'TEXT') {
      patch(node.id, componentPropertyTextChanges(node, value), 'Change property source')
    } else {
      patch(node.id, { visible: value === 'true' }, 'Change property source')
    }
  }
  return { accepts, apply }
}
