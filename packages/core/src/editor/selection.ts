import type { SceneNode } from '../scene-graph'
import type { SnapGuide } from '../scene-graph/snap'
import type { Rect } from '../types'
import type { EditorContext } from './types'

export function createSelectionActions(ctx: EditorContext) {
  function select(ids: string[], additive = false) {
    if (additive) {
      const next = new Set(ctx.state.selectedIds)
      for (const id of ids) {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      ctx.state.selectedIds = next
    } else {
      ctx.state.selectedIds = new Set(ids)
    }
  }

  function clearSelection() {
    ctx.state.selectedIds = new Set()
  }

  function selectAll() {
    const children = ctx.graph.getChildren(ctx.state.currentPageId)
    ctx.state.selectedIds = new Set(children.map((n) => n.id))
  }

  function setMarquee(rect: Rect | null) {
    ctx.state.marquee = rect
    ctx.requestRepaint()
  }

  function setSnapGuides(guides: SnapGuide[]) {
    ctx.state.snapGuides = guides
    ctx.requestRepaint()
  }

  function setRotationPreview(preview: { nodeId: string; angle: number } | null) {
    ctx.state.rotationPreview = preview
    ctx.requestRepaint()
  }

  function setHoveredNode(id: string | null) {
    if (ctx.state.hoveredNodeId === id) return
    ctx.state.hoveredNodeId = id
    ctx.requestRepaint()
  }

  function setDropTarget(id: string | null) {
    ctx.state.dropTargetId = id
    ctx.requestRepaint()
  }

  function setLayoutInsertIndicator(indicator: typeof ctx.state.layoutInsertIndicator) {
    ctx.state.layoutInsertIndicator = indicator
    ctx.requestRepaint()
  }

  function validateEnteredContainer() {
    if (ctx.state.enteredContainerId && !ctx.graph.getNode(ctx.state.enteredContainerId)) {
      ctx.state.enteredContainerId = null
    }
  }

  function enterContainer(id: string) {
    ctx.state.enteredContainerId = id
  }

  function exitContainer() {
    const entered = ctx.state.enteredContainerId
    if (!entered) return
    const node = ctx.graph.getNode(entered)
    const parentId = node?.parentId
    if (parentId && parentId !== ctx.state.currentPageId) {
      ctx.state.enteredContainerId = parentId
    } else {
      ctx.state.enteredContainerId = null
    }
    ctx.state.selectedIds = new Set(entered ? [entered] : [])
  }

  function getSelectedNodes() {
    const nodes = []
    for (const id of ctx.state.selectedIds) {
      const n = ctx.graph.getNode(id)
      if (n) nodes.push({ ...n })
    }
    return nodes
  }

  function getSelectedNode() {
    if (ctx.state.selectedIds.size !== 1) return undefined
    const id = ctx.state.selectedIds.values().next().value as string
    const n = ctx.graph.getNode(id)
    return n ? { ...n } : undefined
  }

  function getLayerTree() {
    return ctx.graph.flattenTree(ctx.state.currentPageId)
  }

  function hitTestAtPoint(cx: number, cy: number, deep = false): SceneNode | null {
    const renderer = ctx.getRenderer()
    if (!renderer) return null
    const scopeId = ctx.state.enteredContainerId
    if (scopeId) {
      const scopeNode = ctx.graph.getNode(scopeId)
      if (!scopeNode) {
        ctx.state.enteredContainerId = null
      } else {
        const abs = ctx.graph.getAbsolutePosition(scopeId)
        const lx = cx - abs.x
        const ly = cy - abs.y
        return deep ? ctx.graph.hitTestDeep(lx, ly, scopeId) : ctx.graph.hitTest(lx, ly, scopeId)
      }
    }
    return deep
      ? ctx.graph.hitTestDeep(cx, cy, ctx.state.currentPageId)
      : ctx.graph.hitTest(cx, cy, ctx.state.currentPageId)
  }

  function selectAtPoint(cx: number, cy: number) {
    const hit = hitTestAtPoint(cx, cy)
    if (hit) {
      if (!ctx.state.selectedIds.has(hit.id)) select([hit.id])
    } else {
      clearSelection()
    }
  }

  return {
    select,
    clearSelection,
    selectAll,
    setMarquee,
    setSnapGuides,
    setRotationPreview,
    setHoveredNode,
    setDropTarget,
    setLayoutInsertIndicator,
    validateEnteredContainer,
    enterContainer,
    exitContainer,
    getSelectedNodes,
    getSelectedNode,
    getLayerTree,
    hitTestAtPoint,
    selectAtPoint
  }
}
