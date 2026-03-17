import {
  DEFAULT_FRAME_FILL,
  DEFAULT_SHAPE_FILL,
  SECTION_DEFAULT_FILL,
  SECTION_DEFAULT_STROKE
} from '../constants'
import { computeVectorBounds } from '../vector'

import type { Fill, NodeType, SceneNode, VectorNetwork, VectorRegion } from '../scene-graph'
import type { EditorContext } from './types'

const BLACK_FILL: Fill = {
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true
}

const DEFAULT_FILLS: Record<string, Fill> = {
  FRAME: DEFAULT_FRAME_FILL,
  SECTION: SECTION_DEFAULT_FILL,
  RECTANGLE: DEFAULT_SHAPE_FILL,
  ELLIPSE: DEFAULT_SHAPE_FILL,
  POLYGON: DEFAULT_SHAPE_FILL,
  STAR: DEFAULT_SHAPE_FILL,
  LINE: BLACK_FILL,
  TEXT: BLACK_FILL
}

export function createShapeActions(ctx: EditorContext) {
  function createShape(
    type: NodeType,
    x: number,
    y: number,
    w: number,
    h: number,
    parentId?: string
  ): string {
    const fill = DEFAULT_FILLS[type] ?? DEFAULT_FILLS.RECTANGLE
    const pid = parentId ?? ctx.state.currentPageId
    const overrides: Partial<SceneNode> = {
      x,
      y,
      width: w,
      height: h,
      fills: [{ ...fill }]
    }
    if (type === 'SECTION') {
      overrides.strokes = [{ ...SECTION_DEFAULT_STROKE }]
      overrides.cornerRadius = 5
    }
    if (type === 'POLYGON') {
      overrides.pointCount = 3
    }
    if (type === 'STAR') {
      overrides.pointCount = 5
      overrides.starInnerRadius = 0.38
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
        ctx.state.selectedIds = next
      }
    })
    return id
  }

  function penAddVertex(x: number, y: number) {
    if (!ctx.state.penState) {
      ctx.state.penState = {
        vertices: [{ x, y }],
        segments: [],
        dragTangent: null,
        closingToFirst: false
      }
      ctx.requestRender()
      return
    }

    const ps = ctx.state.penState
    const prevIdx = ps.vertices.length - 1

    const first = ps.vertices[0]
    const dist = Math.hypot(x - first.x, y - first.y)
    if (ps.vertices.length > 2 && dist < 8) {
      ps.segments.push({
        start: prevIdx,
        end: 0,
        tangentStart: ps.dragTangent ?? { x: 0, y: 0 },
        tangentEnd: { x: 0, y: 0 }
      })
      penCommit(true)
      return
    }

    ps.vertices.push({ x, y })
    const newIdx = ps.vertices.length - 1
    ps.segments.push({
      start: prevIdx,
      end: newIdx,
      tangentStart: ps.dragTangent ?? { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })
    ps.dragTangent = null
    ctx.requestRender()
  }

  function penSetDragTangent(tx: number, ty: number) {
    if (!ctx.state.penState) return
    ctx.state.penState.dragTangent = { x: tx, y: ty }

    const ps = ctx.state.penState
    if (ps.segments.length > 0) {
      const lastSeg = ps.segments[ps.segments.length - 1]
      lastSeg.tangentEnd = { x: -tx, y: -ty }
    }
    ctx.requestRender()
  }

  function penSetClosingToFirst(closing: boolean) {
    if (!ctx.state.penState) return
    ctx.state.penState.closingToFirst = closing
    ctx.requestRender()
  }

  function penCommit(closed: boolean) {
    const ps = ctx.state.penState
    if (!ps || ps.vertices.length < 2) {
      ctx.state.penState = null
      ctx.state.penCursorX = null
      ctx.state.penCursorY = null
      return
    }

    const regions: VectorRegion[] = closed
      ? [{ windingRule: 'NONZERO', loops: [ps.segments.map((_, i) => i)] }]
      : []

    const network: VectorNetwork = {
      vertices: ps.vertices,
      segments: ps.segments,
      regions
    }

    const bounds = computeVectorBounds(network)

    const normalizedVertices = network.vertices.map((v) => ({
      ...v,
      x: v.x - bounds.x,
      y: v.y - bounds.y
    }))

    const normalizedNetwork: VectorNetwork = {
      vertices: normalizedVertices,
      segments: network.segments,
      regions: network.regions
    }

    const nodeId = createShape('VECTOR', bounds.x, bounds.y, bounds.width, bounds.height)
    ctx.graph.updateNode(nodeId, {
      vectorNetwork: normalizedNetwork,
      name: 'Vector',
      fills: closed ? [{ ...DEFAULT_SHAPE_FILL }] : [],
      strokes: closed
        ? []
        : [
            {
              color: { r: 0, g: 0, b: 0, a: 1 },
              weight: 2,
              opacity: 1,
              visible: true,
              align: 'CENTER' as const
            }
          ]
    })
    ctx.state.selectedIds = new Set([nodeId])

    ctx.state.penState = null
    ctx.state.penCursorX = null
    ctx.state.penCursorY = null
    ctx.state.activeTool = 'SELECT'
    ctx.requestRender()
  }

  function penCancel() {
    ctx.state.penState = null
    ctx.state.penCursorX = null
    ctx.state.penCursorY = null
    ctx.state.activeTool = 'SELECT'
    ctx.requestRender()
  }

  function adoptNodesIntoSection(sectionId: string) {
    const section = ctx.graph.getNode(sectionId)
    if (section?.type !== 'SECTION') return

    const parentId = section.parentId ?? ctx.state.currentPageId
    const siblings = ctx.graph.getChildren(parentId)

    const sx = section.x
    const sy = section.y
    const sx2 = sx + section.width
    const sy2 = sy + section.height

    const toAdopt: string[] = []
    for (const sibling of siblings) {
      if (sibling.id === sectionId) continue
      const nx = sibling.x
      const ny = sibling.y
      const nx2 = nx + sibling.width
      const ny2 = ny + sibling.height
      if (nx >= sx && ny >= sy && nx2 <= sx2 && ny2 <= sy2) {
        toAdopt.push(sibling.id)
      }
    }

    if (toAdopt.length === 0) return

    const undoOps: Array<{
      id: string
      oldParent: string
      oldX: number
      oldY: number
      newX: number
      newY: number
    }> = []
    for (const id of toAdopt) {
      const node = ctx.graph.getNode(id)
      if (!node) continue
      const newX = node.x - sx
      const newY = node.y - sy
      undoOps.push({ id, oldParent: parentId, oldX: node.x, oldY: node.y, newX, newY })
      ctx.graph.reparentNode(id, sectionId)
      ctx.graph.updateNode(id, { x: newX, y: newY })
    }

    ctx.undo.push({
      label: 'Adopt into section',
      forward: () => {
        for (const op of undoOps) {
          ctx.graph.reparentNode(op.id, sectionId)
          ctx.graph.updateNode(op.id, { x: op.newX, y: op.newY })
        }
      },
      inverse: () => {
        for (const op of undoOps) {
          ctx.graph.reparentNode(op.id, op.oldParent)
          ctx.graph.updateNode(op.id, { x: op.oldX, y: op.oldY })
        }
      }
    })
  }

  function setTool(tool: typeof ctx.state.activeTool) {
    ctx.state.activeTool = tool
  }

  return {
    createShape,
    penAddVertex,
    penSetDragTangent,
    penSetClosingToFirst,
    penCommit,
    penCancel,
    adoptNodesIntoSection,
    setTool
  }
}
