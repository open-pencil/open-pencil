import { computeLayout } from '../layout'

import type { LayoutMode, SceneNode } from '../scene-graph'
import type { EditorContext } from './types'

export function createNodeActions(ctx: EditorContext) {
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

  function setLayoutMode(id: string, mode: LayoutMode) {
    const node = ctx.graph.getNode(id)
    if (!node) return

    const previous: Partial<SceneNode> = {
      layoutMode: node.layoutMode,
      itemSpacing: node.itemSpacing,
      paddingTop: node.paddingTop,
      paddingRight: node.paddingRight,
      paddingBottom: node.paddingBottom,
      paddingLeft: node.paddingLeft,
      primaryAxisSizing: node.primaryAxisSizing,
      counterAxisSizing: node.counterAxisSizing,
      primaryAxisAlign: node.primaryAxisAlign,
      counterAxisAlign: node.counterAxisAlign,
      gridTemplateColumns: node.gridTemplateColumns,
      gridTemplateRows: node.gridTemplateRows,
      gridColumnGap: node.gridColumnGap,
      gridRowGap: node.gridRowGap,
      width: node.width,
      height: node.height
    }

    const updates: Partial<SceneNode> = { layoutMode: mode }
    if (mode === 'GRID' && node.layoutMode !== 'GRID') {
      const children = ctx.graph.getChildren(id)
      const cols = Math.max(2, Math.ceil(Math.sqrt(children.length)))
      const rows = Math.max(1, Math.ceil(children.length / cols))
      updates.gridTemplateColumns = Array.from({ length: cols }, () => ({
        sizing: 'FR' as const,
        value: 1
      }))
      updates.gridTemplateRows = Array.from({ length: rows }, () => ({
        sizing: 'FR' as const,
        value: 1
      }))
      updates.gridColumnGap = 0
      updates.gridRowGap = 0
      updates.primaryAxisSizing = 'FIXED'
      updates.counterAxisSizing = 'FIXED'
      if (node.primaryAxisSizing === 'HUG' || node.counterAxisSizing === 'HUG') {
        const maxChildW = Math.max(...children.map((c) => c.width), 100)
        const maxChildH = Math.max(...children.map((c) => c.height), 100)
        updates.width = maxChildW * cols
        updates.height = maxChildH * rows
      }
      updates.paddingTop = 0
      updates.paddingRight = 0
      updates.paddingBottom = 0
      updates.paddingLeft = 0
    } else if (mode !== 'NONE' && node.layoutMode === 'NONE') {
      updates.itemSpacing = 0
      updates.paddingTop = 0
      updates.paddingRight = 0
      updates.paddingBottom = 0
      updates.paddingLeft = 0
      updates.primaryAxisSizing = 'HUG'
      updates.counterAxisSizing = 'HUG'
      updates.primaryAxisAlign = 'MIN'
      updates.counterAxisAlign = 'MIN'
    }

    ctx.graph.updateNode(id, updates)
    if (mode !== 'NONE') computeLayout(ctx.graph, id)
    ctx.runLayoutForNode(id)

    const updated = ctx.graph.getNode(id)
    if (!updated) return
    const finalState = Object.fromEntries(
      (Object.keys(previous) as (keyof SceneNode)[]).map((key) => [key, updated[key]])
    ) as Partial<SceneNode>

    ctx.undo.push({
      label: mode === 'NONE' ? 'Remove auto layout' : 'Add auto layout',
      forward: () => {
        ctx.graph.updateNode(id, finalState)
        if (mode !== 'NONE') computeLayout(ctx.graph, id)
        ctx.runLayoutForNode(id)
      },
      inverse: () => {
        ctx.graph.updateNode(id, previous)
        ctx.runLayoutForNode(id)
      }
    })
  }

  function bindVariable(nodeId: string, path: string, variableId: string) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const prevVarId = node.boundVariables[path]
    ctx.graph.bindVariable(nodeId, path, variableId)
    ctx.undo.push({
      label: 'Bind variable',
      forward: () => {
        ctx.graph.bindVariable(nodeId, path, variableId)
        ctx.requestRender()
      },
      inverse: () => {
        if (prevVarId) ctx.graph.bindVariable(nodeId, path, prevVarId)
        else ctx.graph.unbindVariable(nodeId, path)
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  function unbindVariable(nodeId: string, path: string) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const prevVarId = node.boundVariables[path]
    if (!prevVarId) return
    ctx.graph.unbindVariable(nodeId, path)
    ctx.undo.push({
      label: 'Unbind variable',
      forward: () => {
        ctx.graph.unbindVariable(nodeId, path)
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.bindVariable(nodeId, path, prevVarId)
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  return { updateNode, updateNodeWithUndo, setLayoutMode, bindVariable, unbindVariable }
}
