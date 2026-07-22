import type { SceneNode } from '@open-pencil/scene-graph'
import {
  collectResizeDescendants,
  computeConstrainedResizeChanges,
  type ResizeSnapshot
} from '@open-pencil/scene-graph/resize'

import type { EditorContext } from '#core/editor/types'

export interface FramePresetDimensions {
  name: string
  width: number
  height: number
}

type FrameResizePatch = Pick<
  SceneNode,
  'width' | 'height' | 'primaryAxisSizing' | 'counterAxisSizing' | 'layoutGrow' | 'layoutAlignSelf'
>

type CreateShape = (
  type: 'FRAME',
  x: number,
  y: number,
  width: number,
  height: number,
  parentId: string | undefined,
  name: string
) => string

function fixedSizePatch(
  ctx: EditorContext,
  node: SceneNode,
  preset: FramePresetDimensions
): FrameResizePatch {
  const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
  const inheritsStretch =
    node.layoutPositioning !== 'ABSOLUTE' &&
    parent?.layoutMode !== 'NONE' &&
    (parent?.layoutMode === 'GRID' || parent?.counterAxisAlign === 'STRETCH')

  return {
    width: preset.width,
    height: preset.height,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    layoutGrow: 0,
    layoutAlignSelf:
      node.layoutAlignSelf === 'STRETCH' || (node.layoutAlignSelf === 'AUTO' && inheritsStretch)
        ? 'MIN'
        : node.layoutAlignSelf
  }
}

export function createFramePresetActions(ctx: EditorContext, createShape: CreateShape) {
  function createFrameFromPreset(preset: FramePresetDimensions): string {
    const { width: viewportWidth, height: viewportHeight } = ctx.getViewportSize()
    const centerX = (viewportWidth / 2 - ctx.state.panX) / ctx.state.zoom
    const centerY = (viewportHeight / 2 - ctx.state.panY) / ctx.state.zoom
    const previousSelection = new Set(ctx.state.selectedIds)
    const id = ctx.undo.runBatch('Create frame', () => {
      const createdId = createShape(
        'FRAME',
        centerX - preset.width / 2,
        centerY - preset.height / 2,
        preset.width,
        preset.height,
        undefined,
        preset.name
      )
      const createdSelection = new Set([createdId])
      ctx.setSelectedIds(createdSelection)
      ctx.undo.push({
        label: 'Select created frame',
        forward: () => ctx.setSelectedIds(new Set(createdSelection)),
        inverse: () => ctx.setSelectedIds(new Set(previousSelection))
      })
      return createdId
    })

    ctx.setActiveTool('SELECT')
    ctx.requestRender()
    return id
  }

  function applyResize(
    id: string,
    root: Partial<SceneNode>,
    descendants: ReadonlyMap<string, Partial<SceneNode> | ResizeSnapshot>
  ) {
    ctx.graph.updateNode(id, root)
    for (const [childId, changes] of descendants) {
      ctx.graph.updateNode(childId, changes)
      if ('vectorNetwork' in changes) ctx.getRenderer()?.invalidateVectorPath(childId)
    }
    ctx.runLayoutForNode(id)
  }

  function applyInitialResize(
    id: string,
    previous: FrameResizePatch,
    next: FrameResizePatch,
    originals: ReadonlyMap<string, ResizeSnapshot>
  ): Map<string, Partial<SceneNode>> {
    ctx.graph.updateNode(id, next)
    const provisional = computeConstrainedResizeChanges(ctx.graph, id, previous, next, originals)
    for (const [childId, changes] of provisional) ctx.graph.updateNode(childId, changes)
    ctx.runLayoutForNode(id)

    const final = computeConstrainedResizeChanges(ctx.graph, id, previous, next, originals)
    applyResize(id, next, final)
    return final
  }

  function resizeFrameToPreset(id: string, preset: FramePresetDimensions) {
    const node = ctx.graph.getNode(id)
    if (node?.type !== 'FRAME') return

    const previous = {
      width: node.width,
      height: node.height,
      primaryAxisSizing: node.primaryAxisSizing,
      counterAxisSizing: node.counterAxisSizing,
      layoutGrow: node.layoutGrow,
      layoutAlignSelf: node.layoutAlignSelf
    }
    const next = fixedSizePatch(ctx, node, preset)
    if (
      previous.width === next.width &&
      previous.height === next.height &&
      previous.primaryAxisSizing === next.primaryAxisSizing &&
      previous.counterAxisSizing === next.counterAxisSizing &&
      previous.layoutGrow === next.layoutGrow &&
      previous.layoutAlignSelf === next.layoutAlignSelf
    ) {
      return
    }

    const originalDescendants = collectResizeDescendants(ctx.graph, id) ?? new Map()
    const nextDescendants = applyInitialResize(id, previous, next, originalDescendants)
    ctx.undo.push({
      label: 'Resize frame to preset',
      forward: () => applyResize(id, next, nextDescendants),
      inverse: () => applyResize(id, previous, originalDescendants)
    })
    ctx.requestRender()
  }

  return { createFrameFromPreset, resizeFrameToPreset }
}
