import { pick } from 'es-toolkit/object'

import type { SceneNode } from '@open-pencil/scene-graph'

import { createLayoutModeActions } from './layout-mode'
import { createNudgeActions } from './nudge'
import { textAutoResizeChanges } from './text/auto-resize'
import { pathTextEditChanges } from './text/path-edit'
import type { EditorContext } from './types'
import { createVariableBindingActions } from './variable-bindings'

export function createNodeActions(ctx: EditorContext) {
  const layoutModeActions = createLayoutModeActions(ctx)
  const nudgeActions = createNudgeActions(ctx)
  const variableBindingActions = createVariableBindingActions(ctx)

  function updateNode(id: string, changes: Partial<SceneNode>) {
    const node = ctx.graph.getNode(id)
    // Path-edit last so its reflowed glyphs win over auto-resize's glyph clear
    // (path text is textAutoResize NONE so they don't collide today).
    const nextChanges = {
      ...changes,
      ...textAutoResizeChanges(node, changes),
      ...pathTextEditChanges(node, changes)
    }
    ctx.graph.updateNode(id, nextChanges)
    ctx.runLayoutForNode(id)
  }

  function updateNodeWithUndo(id: string, changes: Partial<SceneNode>, label = 'Update') {
    const node = ctx.graph.getNode(id)
    if (!node) return
    // Same ordering rationale as updateNode: reflowed path-text glyphs win.
    const nextChanges = {
      ...changes,
      ...textAutoResizeChanges(node, changes),
      ...pathTextEditChanges(node, changes)
    }
    const previous = pick(
      node,
      Object.keys(nextChanges) as (keyof SceneNode)[]
    ) as Partial<SceneNode>
    ctx.graph.updateNode(id, nextChanges)
    ctx.runLayoutForNode(id)
    ctx.undo.push({
      label,
      forward: () => {
        ctx.graph.updateNode(id, nextChanges)
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
