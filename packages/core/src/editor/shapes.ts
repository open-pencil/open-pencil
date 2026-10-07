import type { NodeType, SceneNode } from '@open-pencil/scene-graph'

import { prepareSlotEdits } from './components/slots'
import { adoptCoveredLayers } from './shapes/adopt'
import { newLayerDefaults } from './shapes/defaults'
import { createFramePresetActions } from './shapes/frame-presets'
import { createPenActions } from './shapes/pen'
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

export function createShapeActions(ctx: EditorContext) {
  function drawnLayerName(type: NodeType): string {
    const base = defaultNodeName(type)
    return NUMBERED_WHEN_DRAWN.has(type)
      ? nextNumberedName(ctx.graph, ctx.state.currentPageId, base)
      : base
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
      ...newLayerDefaults(type, ctx.state.theme),
      x,
      y,
      width: w,
      height: h,
      name: name ?? drawnLayerName(type)
    }
    const node = ctx.graph.createNode(type, pid, overrides)
    const id = node.id
    const snapshot = { ...node }
    ctx.undo.push({
      label: `Create ${type.toLowerCase()}`,
      forward: () => {
        ctx.graph.createNode(snapshot.type, pid, snapshot)
      },
      inverse: () => {
        ctx.graph.deleteNode(id)
        const next = new Set(ctx.state.selectedIds)
        next.delete(id)
        ctx.setSelectedIds(next)
      }
    })
    return id
  }

  const penActions = createPenActions(ctx, createShape)
  const framePresetActions = createFramePresetActions(ctx, createShape)

  function setTool(tool: typeof ctx.state.activeTool) {
    ctx.setActiveTool(tool)
  }

  return {
    createShape,
    ...penActions,
    ...framePresetActions,
    adoptCoveredLayers: (containerId: string) => adoptCoveredLayers(ctx, containerId),
    setTool
  }
}
