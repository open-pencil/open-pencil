import {
  importClipboardNodes,
  parseFigmaClipboard,
  parseOpenPencilClipboard
} from '#core/clipboard'
import { computeAllLayouts } from '#core/layout'

import { createClipboardCopyActions } from './clipboard/copy'
import { createClipboardExportActions } from './clipboard/export'
import { createClipboardFontActions } from './clipboard/fonts'
import { createClipboardImageActions } from './clipboard/images'
import { createClipboardPlacementActions } from './clipboard/placement'
import { collectSubtrees, restoreSubtree, snapshotSubtree } from './clipboard/subtree-history'

import type { SceneNode } from '#core/scene-graph'
import type { Vector } from '#core/types'
import type { EditorContext } from './types'

export function createClipboardActions(ctx: EditorContext) {
  function duplicateSelected(selectedNodes: SceneNode[]) {
    const prevSelection = new Set(ctx.state.selectedIds)
    const selectedSet = new Set(selectedNodes.map((n) => n.id))
    const topLevel = selectedNodes.filter((n) => !n.parentId || !selectedSet.has(n.parentId))

    const newRootIds: string[] = []
    const allSnapshots = new Map<string, SceneNode>()

    for (const node of topLevel) {
      const parentId = node.parentId ?? ctx.state.currentPageId
      const clone = ctx.graph.cloneTree(node.id, parentId, {
        name: node.name + ' copy',
        x: node.x + 20,
        y: node.y + 20
      })
      if (!clone) continue
      newRootIds.push(clone.id)
      const subtree = snapshotSubtree(ctx.graph, clone.id)
      for (const [id, snap] of subtree) allSnapshots.set(id, snap)
    }

    if (newRootIds.length > 0) {
      ctx.state.selectedIds = new Set(newRootIds)
      ctx.undo.push({
        label: 'Duplicate',
        forward: () => {
          for (const rootId of newRootIds) {
            const snapshot = allSnapshots.get(rootId)
            if (!snapshot) continue
            const parentId = snapshot.parentId ?? ctx.state.currentPageId
            restoreSubtree(ctx.graph, snapshot, parentId, allSnapshots)
          }
          ctx.state.selectedIds = new Set(newRootIds)
        },
        inverse: () => {
          for (const id of newRootIds.slice().reverse()) ctx.graph.deleteNode(id)
          ctx.state.selectedIds = prevSelection
        }
      })
    }
  }

  function pasteFromHTML(html: string, cursorPos?: Vector) {
    const openPencil = parseOpenPencilClipboard(html)
    if (openPencil) {
      pasteOpenPencilNodes(openPencil.nodes, openPencil.images, cursorPos)
      return
    }

    void parseFigmaClipboard(html).then((figma) => {
      if (figma) {
        const prevSelection = new Set(ctx.state.selectedIds)
        const created = importClipboardNodes(
          figma.nodes,
          ctx.graph,
          ctx.state.currentPageId,
          0,
          0,
          figma.blobs
        )
        if (created.length > 0) {
          const { width: viewW, height: viewH } = ctx.getViewportSize()
          const cx = cursorPos?.x ?? (-ctx.state.panX + viewW / 2) / ctx.state.zoom
          const cy = cursorPos?.y ?? (-ctx.state.panY + viewH / 2) / ctx.state.zoom
          placementActions.centerNodesAt(created, cx, cy)
          computeAllLayouts(ctx.graph, ctx.state.currentPageId)
          ctx.state.selectedIds = new Set(created)

          const allNodes = collectSubtrees(ctx.graph, created)
          const pageId = ctx.state.currentPageId
          ctx.undo.push({
            label: 'Paste',
            forward: () => {
              for (const snapshot of allNodes) {
                ctx.graph.createNode(snapshot.type, snapshot.parentId ?? pageId, {
                  ...snapshot,
                  childIds: []
                })
              }
              computeAllLayouts(ctx.graph, pageId)
              ctx.state.selectedIds = new Set(created)
            },
            inverse: () => {
              for (const id of [...created].reverse()) ctx.graph.deleteNode(id)
              computeAllLayouts(ctx.graph, pageId)
              ctx.state.selectedIds = prevSelection
            }
          })
          void fontActions.loadFontsForNodes(created)
          warnMissingImages(created)
        }
      }
    })
  }

  function pasteOpenPencilNodes(
    nodes: Array<SceneNode & { children?: SceneNode[] }>,
    images: Map<string, Uint8Array>,
    cursorPos?: Vector
  ) {
    const prevSelection = new Set(ctx.state.selectedIds)
    for (const [hash, bytes] of images) ctx.graph.images.set(hash, bytes)

    const created: string[] = []
    const createNodeTree = (source: SceneNode & { children?: SceneNode[] }, parentId: string) => {
      const { id: _id, childIds: _childIds, children = [], parentId: _parentId, ...rest } = source
      const node = ctx.graph.createNode(source.type, parentId, {
        ...structuredClone(rest),
        x: source.x + 20,
        y: source.y + 20,
        childIds: []
      })
      for (const child of children) createNodeTree(child, node.id)
      return node.id
    }

    for (const node of nodes) created.push(createNodeTree(node, ctx.state.currentPageId))
    if (created.length === 0) return

    if (cursorPos) placementActions.centerNodesAt(created, cursorPos.x, cursorPos.y)
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    ctx.state.selectedIds = new Set(created)

    const allNodes = collectSubtrees(ctx.graph, created)
    const pageId = ctx.state.currentPageId
    ctx.undo.push({
      label: 'Paste',
      forward: () => {
        for (const snapshot of allNodes) {
          ctx.graph.createNode(snapshot.type, snapshot.parentId ?? pageId, {
            ...snapshot,
            childIds: []
          })
        }
        computeAllLayouts(ctx.graph, pageId)
        ctx.state.selectedIds = new Set(created)
      },
      inverse: () => {
        for (const id of [...created].reverse()) ctx.graph.deleteNode(id)
        computeAllLayouts(ctx.graph, pageId)
        ctx.state.selectedIds = prevSelection
      }
    })
  }

  function warnMissingImages(nodeIds: string[]) {
    const allNodes = collectSubtrees(ctx.graph, nodeIds)
    return allNodes.some((n) =>
      n.fills.some((f) => f.type === 'IMAGE' && f.imageHash && !ctx.graph.images.has(f.imageHash))
    )
  }

  function deleteSelected() {
    const entries: Array<{
      id: string
      parentId: string
      index: number
      subtree: Map<string, SceneNode>
    }> = []
    for (const id of ctx.state.selectedIds) {
      const node = ctx.graph.getNode(id)
      if (!node || node.locked) continue
      const parentId = node.parentId ?? ctx.state.currentPageId
      const parent = ctx.graph.getNode(parentId)
      const index = parent?.childIds.indexOf(id) ?? -1
      entries.push({ id, parentId, index, subtree: snapshotSubtree(ctx.graph, id) })
    }
    if (entries.length === 0) return

    const prevSelection = new Set(ctx.state.selectedIds)
    for (const { id } of entries) ctx.graph.deleteNode(id)

    ctx.undo.push({
      label: 'Delete',
      forward: () => {
        for (const { id } of entries) ctx.graph.deleteNode(id)
        ctx.state.selectedIds = new Set()
      },
      inverse: () => {
        for (const { id, parentId, index, subtree } of [...entries].reverse()) {
          const rootSnap = subtree.get(id)
          if (rootSnap) restoreSubtree(ctx.graph, rootSnap, parentId, subtree)
          if (index >= 0) ctx.graph.reorderChild(id, parentId, index)
        }
        ctx.state.selectedIds = prevSelection
      }
    })
    ctx.state.selectedIds = new Set()
  }

  const copyActions = createClipboardCopyActions(ctx)
  const exportActions = createClipboardExportActions(ctx)
  const fontActions = createClipboardFontActions(ctx)
  const imageActions = createClipboardImageActions(ctx)
  const placementActions = createClipboardPlacementActions(ctx)

  return {
    collectSubtrees,
    ...placementActions,
    ...fontActions,
    duplicateSelected,
    ...copyActions,
    pasteFromHTML,
    warnMissingImages,
    deleteSelected,
    ...imageActions,
    ...exportActions
  }
}
