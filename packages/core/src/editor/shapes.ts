import type { NodeType, SceneNode } from '@open-pencil/scene-graph'
import { createShapeWithText } from '@open-pencil/scene-graph/generated'

import { prepareSlotEdits } from './components/slots'
import { restoreSubtree, snapshotSubtree } from './history/subtree'
import { adoptCoveredLayers } from './shapes/adopt'
import { layerTheme, newLayerDefaults } from './shapes/defaults'
import { createFramePresetActions } from './shapes/frame-presets'
import { createPenActions, type UpdateNodeWithUndo } from './shapes/pen'
import { createPencilActions } from './shapes/pencil'
import { defaultNodeName, nextNumberedName } from './structure/rename'
import type { EditorContext } from './types'
export type { PenDragOptions } from './shapes/pen'

/** Layers Figma numbers when drawn, as "Rectangle 1"; others keep their type's name. */
const NUMBERED_WHEN_DRAWN: ReadonlySet<NodeType> = new Set([
  'FRAME',
  'SECTION',
  'RECTANGLE',
  'ELLIPSE',
  'LINE',
  'POLYGON',
  'STAR'
])

export function createShapeActions(ctx: EditorContext, updateNodeWithUndo: UpdateNodeWithUndo) {
  function drawnLayerName(type: NodeType, parentId: string): string {
    const base = defaultNodeName(type)
    return NUMBERED_WHEN_DRAWN.has(type) ? nextNumberedName(ctx.graph, parentId, base) : base
  }

  function createShape(
    type: NodeType,
    x: number,
    y: number,
    w: number,
    h: number,
    parentId?: string,
    name?: string
  ): string {
    const pid = parentId ?? ctx.state.currentPageId
    // Inside an instance only a slot takes new layers, and the instance claims it first.
    if (!prepareSlotEdits(ctx, [pid])) {
      throw new Error('Cannot add a layer to the locked part of an instance')
    }
    const overrides: Partial<SceneNode> = {
      ...newLayerDefaults(type, layerTheme(ctx.state)),
      x,
      y,
      width: w,
      height: h,
      name: name ?? drawnLayerName(type, pid)
    }
    const node =
      type === 'SHAPE_WITH_TEXT'
        ? createShapeWithText(ctx.graph, pid, {
            ...overrides,
            shapeWithTextType: ctx.state.shapeWithTextKind
          })
        : ctx.graph.createNode(type, pid, overrides)
    const id = node.id
    // Callers finish the layer after this returns (the pen writes its path, fills and strokes),
    // so redo restores the layer as it was when undone, not as first created. A shape with text
    // brings its label, so the layer is kept with its sublayers.
    let snapshots = snapshotSubtree(ctx.graph, id)
    ctx.undo.push({
      label: `Create ${type.toLowerCase()}`,
      forward: () => {
        const snapshot = snapshots.get(id)
        if (snapshot) restoreSubtree(ctx.graph, snapshot, pid, snapshots)
      },
      inverse: () => {
        if (ctx.graph.getNode(id)) snapshots = snapshotSubtree(ctx.graph, id)
        ctx.graph.deleteNode(id)
        const next = new Set(ctx.state.selectedIds)
        next.delete(id)
        ctx.setSelectedIds(next)
      }
    })
    return id
  }

  const penActions = createPenActions(ctx, createShape, updateNodeWithUndo)
  const pencilActions = createPencilActions(ctx, createShape)
  const framePresetActions = createFramePresetActions(ctx, createShape)

  function setTool(tool: typeof ctx.state.activeTool) {
    ctx.setActiveTool(tool)
  }

  return {
    createShape,
    ...penActions,
    ...pencilActions,
    ...framePresetActions,
    adoptCoveredLayers: (containerId: string) => adoptCoveredLayers(ctx, containerId),
    setTool
  }
}
