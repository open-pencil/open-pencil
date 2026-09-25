import {
  cloneInstanceOverrideState,
  findInstanceAncestor,
  variableBindingOwner,
  isNumericVariableBindingField,
  type SceneNode
} from '@open-pencil/scene-graph'

import { reconcileVariableLayouts } from '#core/layout/variables'

import type { EditorContext } from './types'

export function createVariableBindingActions(ctx: EditorContext) {
  function refreshBindings() {
    reconcileVariableLayouts(ctx.graph)
    ctx.requestRender()
  }

  function changeBinding(nodeId: string, path: string, variableId?: string) {
    const node = ctx.graph.getNode(nodeId)
    if (!node || (variableId === undefined && !(path in node.boundVariables))) return
    const previous = {
      boundVariables: { ...node.boundVariables },
      variableBindingScales: { ...node.variableBindingScales },
      ...(isNumericVariableBindingField(path) ? { [path]: node[path as keyof SceneNode] } : {})
    }
    const owner = variableBindingOwner(ctx.graph, node)
    const nearest = findInstanceAncestor(ctx.graph, nodeId)
    const owners = new Map(
      [owner, ...(nearest ? [nearest] : [])].map(
        (item) => [item.id, cloneInstanceOverrideState(item.instanceOverrides)] as const
      )
    )
    const apply = () => {
      if (variableId === undefined) ctx.graph.unbindVariable(nodeId, path)
      else ctx.graph.bindVariable(nodeId, path, variableId)
      refreshBindings()
    }
    apply()
    ctx.undo.push({
      label: variableId === undefined ? 'Unbind variable' : 'Bind variable',
      forward: () => {
        try {
          apply()
        } catch (error) {
          console.warn(
            'Redo variable binding failed:',
            error instanceof Error ? error.message : String(error)
          )
        }
      },
      inverse: () => {
        for (const [id, state] of owners) {
          ctx.graph.updateNode(id, { instanceOverrides: cloneInstanceOverrideState(state) })
        }
        const restored = structuredClone(previous)
        restored.boundVariables = Object.fromEntries(
          Object.entries(restored.boundVariables).filter(([, id]) => ctx.graph.variables.has(id))
        )
        restored.variableBindingScales = Object.fromEntries(
          Object.entries(restored.variableBindingScales).filter(
            ([field]) => field in restored.boundVariables
          )
        )
        ctx.graph.updateNode(nodeId, restored)
        refreshBindings()
      }
    })
  }

  return {
    bindVariable: (nodeId: string, path: string, variableId: string) =>
      changeBinding(nodeId, path, variableId),
    unbindVariable: (nodeId: string, path: string) => changeBinding(nodeId, path)
  }
}
