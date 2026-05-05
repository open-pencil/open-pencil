import { computeLayout } from '#core/layout'
import type { LayoutMode, SceneNode } from '#core/scene-graph'

import type { EditorContext } from './types'

export function createLayoutModeActions(ctx: EditorContext) {
  function setLayoutMode(id: string, mode: LayoutMode) {
    const node = ctx.graph.getNode(id)
    if (!node) return

    const previous = captureLayoutState(node)
    const updates = layoutModeUpdates(ctx, node, id, mode)

    ctx.graph.updateNode(id, updates)
    if (mode !== 'NONE') computeLayout(ctx.graph, id)
    ctx.runLayoutForNode(id)

    const updated = ctx.graph.getNode(id)
    if (!updated) return
    const finalState = pickState(updated, Object.keys(previous) as (keyof SceneNode)[])

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

  return { setLayoutMode }
}

function captureLayoutState(node: SceneNode): Partial<SceneNode> {
  return {
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
}

function pickState(node: SceneNode, keys: (keyof SceneNode)[]): Partial<SceneNode> {
  return Object.fromEntries(keys.map((key) => [key, node[key]])) as Partial<SceneNode>
}

function layoutModeUpdates(
  ctx: EditorContext,
  node: SceneNode,
  id: string,
  mode: LayoutMode
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = { layoutMode: mode }
  if (mode === 'GRID' && node.layoutMode !== 'GRID') {
    applyGridDefaults(ctx, node, id, updates)
  } else if (mode !== 'NONE' && node.layoutMode === 'NONE') {
    Object.assign(updates, autoLayoutDefaults())
  }
  return updates
}

function applyGridDefaults(
  ctx: EditorContext,
  node: SceneNode,
  id: string,
  updates: Partial<SceneNode>
) {
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
    const maxChildW = Math.max(...children.map((child) => child.width), 100)
    const maxChildH = Math.max(...children.map((child) => child.height), 100)
    updates.width = maxChildW * cols
    updates.height = maxChildH * rows
  }
  updates.paddingTop = 0
  updates.paddingRight = 0
  updates.paddingBottom = 0
  updates.paddingLeft = 0
}

function autoLayoutDefaults(): Partial<SceneNode> {
  return {
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'MIN'
  }
}
