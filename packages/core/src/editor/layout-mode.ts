import type { LayoutMode, SceneNode } from '@open-pencil/scene-graph'

import type { NodePreview } from './node-preview'
import type { EditorContext } from './types'

export function createLayoutModeActions(
  ctx: EditorContext,
  beginNodePreview: (label: string) => NodePreview
) {
  /**
   * Adding, switching, or removing auto layout moves and resizes children, nested layouts, and
   * Hug ancestors. A node preview records every layer it changes, so one undo puts them all back
   * where they were; setting the mode a frame already has records nothing.
   */
  function setLayoutMode(id: string, mode: LayoutMode) {
    const node = ctx.graph.getNode(id)
    if (!node || node.layoutMode === mode) return
    const preview = beginNodePreview(mode === 'NONE' ? 'Remove auto layout' : 'Add auto layout')
    preview.update(id, layoutModeUpdates(ctx, node, id, mode))
    preview.commit()
  }

  return { setLayoutMode }
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
