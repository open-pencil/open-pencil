import { createLayoutModeActions } from './layout-mode'
import { createNudgeActions } from './nudge'
import { createVariableBindingActions } from './variable-bindings'

import type { SceneNode } from '#core/scene-graph'
import type { EditorContext } from './types'

export function createNodeActions(ctx: EditorContext) {
  const layoutModeActions = createLayoutModeActions(ctx)
  const nudgeActions = createNudgeActions(ctx)
  const variableBindingActions = createVariableBindingActions(ctx)

  function updateNode(id: string, changes: Partial<SceneNode>) {
    ctx.graph.updateNode(id, changes)
    ctx.runLayoutForNode(id)
  }

  function updateNodeWithUndo(id: string, changes: Partial<SceneNode>, label = 'Update') {
    const node = ctx.graph.getNode(id)
    if (!node) return
    const previous = Object.fromEntries(
      (Object.keys(changes) as (keyof SceneNode)[]).map((key) => [key, node[key]])
    ) as Partial<SceneNode>
    ctx.graph.updateNode(id, changes)
    ctx.runLayoutForNode(id)
    ctx.undo.push({
      label,
      forward: () => {
        ctx.graph.updateNode(id, changes)
        ctx.runLayoutForNode(id)
      },
      inverse: () => {
        ctx.graph.updateNode(id, previous)
        ctx.runLayoutForNode(id)
      }
    })
    ctx.requestRender()
  }

  return {
    updateNode,
    updateNodeWithUndo,
    ...layoutModeActions,
    ...variableBindingActions,
    ...nudgeActions
  }
}
