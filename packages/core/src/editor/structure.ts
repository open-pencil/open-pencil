import { computeAbsoluteBounds } from '../geometry'
import { computeLayout } from '../layout'

import type { LayoutMode, NodeType, SceneNode } from '../scene-graph'
import type { EditorContext } from './types'

export function createStructureActions(ctx: EditorContext) {
  function defaultNodeName(type: NodeType): string {
    return type.charAt(0) + type.slice(1).toLowerCase()
  }

  function isTopLevel(parentId: string | null): boolean {
    return !parentId || parentId === ctx.graph.rootId || parentId === ctx.state.currentPageId
  }

  function doReorderChild(nodeId: string, parentId: string, insertIndex: number) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return

    if (node.parentId !== parentId) {
      const absPos = ctx.graph.getAbsolutePosition(nodeId)
      const parentAbs = ctx.graph.getAbsolutePosition(parentId)
      ctx.graph.updateNode(nodeId, { x: absPos.x - parentAbs.x, y: absPos.y - parentAbs.y })
    }

    ctx.graph.reorderChild(nodeId, parentId, insertIndex)
    computeLayout(ctx.graph, parentId)
    ctx.runLayoutForNode(parentId)
  }

  function reorderInAutoLayout(nodeId: string, parentId: string, insertIndex: number) {
    const parent = ctx.graph.getNode(parentId)
    if (!parent || parent.layoutMode === 'NONE') return

    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const origParentId = node.parentId ?? ctx.state.currentPageId
    const origX = node.x
    const origY = node.y
    const origIndex = ctx.graph.getNode(origParentId)?.childIds.indexOf(nodeId) ?? -1

    doReorderChild(nodeId, parentId, insertIndex)

    ctx.undo.push({
      label: 'Reorder',
      forward: () => {
        doReorderChild(nodeId, parentId, insertIndex)
      },
      inverse: () => {
        ctx.graph.reorderChild(nodeId, origParentId, origIndex >= 0 ? origIndex : 0)
        ctx.graph.updateNode(nodeId, { x: origX, y: origY })
        computeLayout(ctx.graph, origParentId)
        ctx.runLayoutForNode(origParentId)
        if (origParentId !== parentId) {
          computeLayout(ctx.graph, parentId)
          ctx.runLayoutForNode(parentId)
        }
      }
    })
  }

  function reorderChildWithUndo(nodeId: string, newParentId: string, insertIndex: number) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const origParentId = node.parentId ?? ctx.state.currentPageId
    const origIndex = ctx.graph.getNode(origParentId)?.childIds.indexOf(nodeId) ?? 0
    const origX = node.x
    const origY = node.y

    ctx.graph.reorderChild(nodeId, newParentId, insertIndex)
    ctx.runLayoutForNode(newParentId)
    if (origParentId !== newParentId) ctx.runLayoutForNode(origParentId)

    ctx.undo.push({
      label: 'Reorder',
      forward: () => {
        ctx.graph.reorderChild(nodeId, newParentId, insertIndex)
        ctx.runLayoutForNode(newParentId)
        if (origParentId !== newParentId) ctx.runLayoutForNode(origParentId)
      },
      inverse: () => {
        ctx.graph.reorderChild(nodeId, origParentId, origIndex)
        ctx.graph.updateNode(nodeId, { x: origX, y: origY })
        ctx.runLayoutForNode(origParentId)
        if (origParentId !== newParentId) ctx.runLayoutForNode(newParentId)
      }
    })
  }

  function reparentNodes(nodeIds: string[], newParentId: string) {
    const parent = ctx.graph.getNode(newParentId)
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (
        node?.type === 'SECTION' &&
        parent &&
        parent.type !== 'CANVAS' &&
        parent.type !== 'SECTION'
      )
        continue
      ctx.graph.reparentNode(id, newParentId)
    }
  }

  function wrapSelectionInContainer(
    containerType: 'GROUP' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET',
    selectedNodes: SceneNode[],
    extraProps?: Partial<SceneNode>
  ) {
    if (selectedNodes.length === 0) return null

    const parentId = selectedNodes[0].parentId ?? ctx.state.currentPageId
    const sameParent = selectedNodes.every(
      (n) => (n.parentId ?? ctx.state.currentPageId) === parentId
    )
    if (!sameParent) return null

    const parent = ctx.graph.getNode(parentId)
    if (!parent) return null

    const prevSelection = new Set(ctx.state.selectedIds)
    const nodeIds = selectedNodes.map((n) => n.id)
    const origPositions = selectedNodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))

    const {
      x: minX,
      y: minY,
      width: bw,
      height: bh
    } = computeAbsoluteBounds(selectedNodes, (id) => ctx.graph.getAbsolutePosition(id))
    const maxX = minX + bw
    const maxY = minY + bh

    const parentAbs = isTopLevel(parentId)
      ? { x: 0, y: 0 }
      : ctx.graph.getAbsolutePosition(parentId)
    const firstIndex = Math.min(...nodeIds.map((id) => parent.childIds.indexOf(id)))

    const padding = containerType === 'COMPONENT_SET' ? 40 : 0
    const containerNames: Record<string, string> = {
      COMPONENT_SET: selectedNodes[0].name.split('/')[0]?.trim() || 'Component Set',
      COMPONENT: 'Component',
      GROUP: 'Group',
      FRAME: 'Frame'
    }
    const containerNode = ctx.graph.createNode(containerType, parentId, {
      name: containerNames[containerType] ?? containerType,
      x: minX - parentAbs.x - padding,
      y: minY - parentAbs.y - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      fills:
        containerType === 'COMPONENT_SET'
          ? [
              {
                type: 'SOLID',
                color: { r: 0.96, g: 0.96, b: 0.96, a: 1 },
                opacity: 1,
                visible: true
              }
            ]
          : [],
      ...extraProps
    })
    const containerId = containerNode.id

    ctx.graph.insertChildAt(containerId, parentId, firstIndex)

    for (const n of selectedNodes) {
      ctx.graph.reparentNode(n.id, containerId)
    }

    ctx.state.selectedIds = new Set([containerId])

    ctx.undo.push({
      label: `Create ${containerType.toLowerCase().replace('_', ' ')}`,
      forward: () => {
        const c = ctx.graph.createNode(containerType, parentId, {
          ...containerNode,
          ...extraProps,
          id: containerId
        })
        ctx.graph.insertChildAt(c.id, parentId, firstIndex)
        for (const n of origPositions) ctx.graph.reparentNode(n.id, c.id)
        ctx.state.selectedIds = new Set([c.id])
      },
      inverse: () => {
        for (const orig of origPositions) {
          ctx.graph.reparentNode(orig.id, parentId)
          ctx.graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        ctx.graph.deleteNode(containerId)
        ctx.state.selectedIds = prevSelection
      }
    })

    return containerId
  }

  function wrapInAutoLayout(selectedNodes: SceneNode[]) {
    if (selectedNodes.length === 0) return

    const parentId = selectedNodes[0].parentId ?? ctx.state.currentPageId
    const sameParent = selectedNodes.every(
      (n) => (n.parentId ?? ctx.state.currentPageId) === parentId
    )
    if (!sameParent) return

    const prevSelection = new Set(ctx.state.selectedIds)
    const origPositions = selectedNodes.map((n) => ({ id: n.id, x: n.x, y: n.y, parentId }))

    const bounds = computeAbsoluteBounds(selectedNodes, (id) => ctx.graph.getAbsolutePosition(id))

    const parentAbs = isTopLevel(parentId)
      ? { x: 0, y: 0 }
      : ctx.graph.getAbsolutePosition(parentId)

    const direction: LayoutMode =
      selectedNodes.length <= 1 || bounds.height > bounds.width ? 'VERTICAL' : 'HORIZONTAL'

    const frame = ctx.graph.createNode('FRAME', parentId, {
      name: 'Frame',
      x: bounds.x - parentAbs.x,
      y: bounds.y - parentAbs.y,
      width: bounds.width,
      height: bounds.height,
      layoutMode: direction,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      primaryAxisAlign: 'MIN',
      counterAxisAlign: 'MIN',
      fills: []
    })
    const frameId = frame.id

    const sortedIds = selectedNodes
      .map((n) => ({ id: n.id, pos: ctx.graph.getAbsolutePosition(n.id) }))
      .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)
      .map((n) => n.id)

    for (const id of sortedIds) {
      ctx.graph.reparentNode(id, frameId)
    }

    computeLayout(ctx.graph, frameId)
    ctx.runLayoutForNode(frameId)
    ctx.state.selectedIds = new Set([frameId])

    ctx.undo.push({
      label: 'Wrap in auto layout',
      forward: () => {
        const f = ctx.graph.createNode('FRAME', parentId, { ...frame, id: frameId })
        for (const n of origPositions) ctx.graph.reparentNode(n.id, f.id)
        computeLayout(ctx.graph, f.id)
        ctx.runLayoutForNode(f.id)
        ctx.state.selectedIds = new Set([f.id])
      },
      inverse: () => {
        for (const orig of origPositions) {
          ctx.graph.reparentNode(orig.id, orig.parentId)
          ctx.graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        ctx.graph.deleteNode(frameId)
        ctx.state.selectedIds = prevSelection
      }
    })
  }

  function groupSelected(selectedNodes: SceneNode[]) {
    return wrapSelectionInContainer('GROUP', selectedNodes)
  }

  function ungroupSelected(selectedNode: SceneNode | undefined) {
    if (selectedNode?.type !== 'GROUP') return

    const node = selectedNode
    const parentId = node.parentId ?? ctx.state.currentPageId
    const parent = ctx.graph.getNode(parentId)
    if (!parent) return

    const groupIndex = parent.childIds.indexOf(node.id)
    const childIds = [...node.childIds]
    const prevSelection = new Set(ctx.state.selectedIds)
    const origPositions = childIds.map((id) => {
      const child = ctx.graph.getNode(id)
      if (!child) return { id, x: 0, y: 0 }
      return { id, x: child.x, y: child.y }
    })
    const groupId = node.id
    const groupSnapshot = { ...node, childIds: [...node.childIds] }

    for (let i = 0; i < childIds.length; i++) {
      ctx.graph.reparentNode(childIds[i], parentId)
      ctx.graph.insertChildAt(childIds[i], parentId, groupIndex + i)
    }

    ctx.graph.deleteNode(node.id)
    ctx.state.selectedIds = new Set(childIds)

    ctx.undo.push({
      label: 'Ungroup',
      forward: () => {
        for (let i = 0; i < childIds.length; i++) {
          ctx.graph.reparentNode(childIds[i], parentId)
          ctx.graph.insertChildAt(childIds[i], parentId, groupIndex + i)
        }
        ctx.graph.deleteNode(groupId)
        ctx.state.selectedIds = new Set(childIds)
      },
      inverse: () => {
        const g = ctx.graph.createNode('GROUP', parentId, {
          ...groupSnapshot,
          childIds: [],
          id: groupId
        })
        ctx.graph.insertChildAt(g.id, parentId, groupIndex)
        for (const orig of origPositions) {
          ctx.graph.reparentNode(orig.id, g.id)
          ctx.graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        ctx.state.selectedIds = prevSelection
      }
    })
  }

  function bringToFront() {
    for (const id of ctx.state.selectedIds) {
      const node = ctx.graph.getNode(id)
      if (!node?.parentId) continue
      const parent = ctx.graph.getNode(node.parentId)
      if (!parent) continue
      const idx = parent.childIds.indexOf(id)
      if (idx === parent.childIds.length - 1) continue
      ctx.graph.insertChildAt(id, node.parentId, parent.childIds.length)
    }
    ctx.requestRender()
  }

  function sendToBack() {
    for (const id of ctx.state.selectedIds) {
      const node = ctx.graph.getNode(id)
      if (!node?.parentId) continue
      const parent = ctx.graph.getNode(node.parentId)
      if (!parent) continue
      const idx = parent.childIds.indexOf(id)
      if (idx === 0) continue
      ctx.graph.insertChildAt(id, node.parentId, 0)
    }
    ctx.requestRender()
  }

  function toggleNodeVisibility(id: string) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    ctx.graph.updateNode(id, { visible: !node.visible })
  }

  function toggleNodeLock(id: string) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    ctx.graph.updateNode(id, { locked: !node.locked })
  }

  function toggleVisibility() {
    for (const id of ctx.state.selectedIds) toggleNodeVisibility(id)
  }

  function toggleLock() {
    for (const id of ctx.state.selectedIds) toggleNodeLock(id)
  }

  function moveToPage(pageId: string) {
    const targetPage = ctx.graph.getNode(pageId)
    if (targetPage?.type !== 'CANVAS') return
    const ids = [...ctx.state.selectedIds]
    for (const id of ids) {
      ctx.graph.reparentNode(id, pageId)
    }
    ctx.state.selectedIds = new Set()
  }

  function renameNode(id: string, name: string) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    const trimmedName = name.trim()
    ctx.graph.updateNode(id, { name: trimmedName || defaultNodeName(node.type) })
  }

  return {
    isTopLevel,
    reorderInAutoLayout,
    reorderChildWithUndo,
    reparentNodes,
    wrapSelectionInContainer,
    wrapInAutoLayout,
    groupSelected,
    ungroupSelected,
    bringToFront,
    sendToBack,
    toggleNodeVisibility,
    toggleNodeLock,
    toggleVisibility,
    toggleLock,
    moveToPage,
    renameNode
  }
}
