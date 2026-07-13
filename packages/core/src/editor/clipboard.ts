import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  importClipboardNodes,
  parseFigmaClipboard,
  parseOpenPencilClipboard
} from '#core/clipboard'
import { computeAllLayouts } from '#core/layout'

import { createClipboardCopyActions } from './clipboard/copy'
import { createClipboardExportActions } from './clipboard/export'
import { createClipboardFontActions } from './clipboard/fonts'
import {
  deleteIds,
  type DeletedEntry,
  recreateSnapshots,
  restoreDeletedEntries
} from './clipboard/history'
import { createClipboardImageActions } from './clipboard/images'
import { replaceTargetsWithCreated, selectedReplacementTargets } from './clipboard/paste-replace'
import { resolvePasteTarget } from './clipboard/paste-target'
import { createClipboardPlacementActions } from './clipboard/placement'
import { collectSubtrees, restoreSubtree, snapshotSubtree } from './clipboard/subtree-history'
import type { EditorContext } from './types'

type PasteOptions = {
  replaceSelection?: boolean
}

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
      ctx.setSelectedIds(new Set(newRootIds))
      ctx.undo.push({
        label: 'Duplicate',
        forward: () => {
          for (const rootId of newRootIds) {
            const snapshot = allSnapshots.get(rootId)
            if (!snapshot) continue
            const parentId = snapshot.parentId ?? ctx.state.currentPageId
            restoreSubtree(ctx.graph, snapshot, parentId, allSnapshots)
          }
          ctx.setSelectedIds(new Set(newRootIds))
        },
        inverse: () => {
          for (const id of newRootIds.slice().reverse()) ctx.graph.deleteNode(id)
          ctx.setSelectedIds(prevSelection)
        }
      })
    }
  }

  function pushPasteUndo(created: string[], prevSelection: Set<string>) {
    const allNodes = collectSubtrees(ctx.graph, created)
    const pageId = ctx.state.currentPageId
    ctx.undo.push({
      label: 'Paste',
      forward: () => {
        recreateSnapshots(ctx, allNodes, pageId)
        computeAllLayouts(ctx.graph, pageId)
        ctx.setSelectedIds(new Set(created))
      },
      inverse: () => {
        deleteIds(ctx, created)
        computeAllLayouts(ctx.graph, pageId)
        ctx.setSelectedIds(prevSelection)
      }
    })
  }

  async function pasteFromHTML(html: string, cursorPos?: Vector, options: PasteOptions = {}) {
    const openPencil = parseOpenPencilClipboard(html)
    if (openPencil) {
      pasteOpenPencilNodes(openPencil.nodes, openPencil.images, cursorPos, options)
      return
    }

    const figma = await parseFigmaClipboard(html)
    if (figma) {
      const prevSelection = new Set(ctx.state.selectedIds)
      const replacementTargets = options.replaceSelection ? selectedReplacementTargets(ctx) : []
      const pasteTarget = replacementTargets[0]?.parentId ?? resolvePasteTarget(ctx)
      const created = importClipboardNodes(figma.nodes, ctx.graph, pasteTarget, 0, 0, figma.blobs)
      if (created.length > 0) {
        if (replacementTargets.length > 0) {
          replaceTargetsWithCreated(
            ctx,
            placementActions.centerNodesAt,
            created,
            replacementTargets,
            prevSelection
          )
          void fontActions.loadFontsForNodes(created)
          warnMissingImages(created)
          ctx.requestRender()
          return
        }
        const { width: viewW, height: viewH } = ctx.getViewportSize()
        const cx = cursorPos?.x ?? (-ctx.state.panX + viewW / 2) / ctx.state.zoom
        const cy = cursorPos?.y ?? (-ctx.state.panY + viewH / 2) / ctx.state.zoom
        placementActions.centerNodesAt(created, cx, cy)
        computeAllLayouts(ctx.graph, ctx.state.currentPageId)
        ctx.setSelectedIds(new Set(created))

        pushPasteUndo(created, prevSelection)
        void fontActions.loadFontsForNodes(created)
        warnMissingImages(created)
        ctx.requestRender()
      }
    }
  }

  function pasteOpenPencilNodes(
    nodes: Array<SceneNode & { children?: SceneNode[] }>,
    images: Map<string, Uint8Array>,
    cursorPos?: Vector,
    options: PasteOptions = {}
  ) {
    const prevSelection = new Set(ctx.state.selectedIds)
    const replacementTargets = options.replaceSelection ? selectedReplacementTargets(ctx) : []
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

    const pasteTarget = replacementTargets[0]?.parentId ?? resolvePasteTarget(ctx)
    for (const node of nodes) created.push(createNodeTree(node, pasteTarget))
    if (created.length === 0) return

    if (replacementTargets.length > 0) {
      replaceTargetsWithCreated(
        ctx,
        placementActions.centerNodesAt,
        created,
        replacementTargets,
        prevSelection
      )
      return
    }

    if (cursorPos) placementActions.centerNodesAt(created, cursorPos.x, cursorPos.y)
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    ctx.setSelectedIds(new Set(created))

    pushPasteUndo(created, prevSelection)
  }

  function warnMissingImages(nodeIds: string[]) {
    const allNodes = collectSubtrees(ctx.graph, nodeIds)
    return allNodes.some((n) =>
      n.fills.some((f) => f.type === 'IMAGE' && f.imageHash && !ctx.graph.images.has(f.imageHash))
    )
  }

  function deleteSelected() {
    const entries: DeletedEntry[] = []
    for (const id of ctx.state.selectedIds) {
      const node = ctx.graph.getNode(id)
      if (!node || node.locked) continue
      const parentId = node.parentId ?? ctx.state.currentPageId
      const parent = ctx.graph.getNode(parentId)
      const index = parent?.childIds.indexOf(id) ?? -1
      entries.push({ id, parentId, index, subtree: snapshotSubtree(ctx.graph, id) })
    }
    if (entries.length === 0) return

    const syncedInstanceEntries = collectSyncedInstanceDeleteEntries(entries)
    const relayoutEntries = [...entries, ...syncedInstanceEntries]

    const relayoutParents = () => {
      for (const parentId of new Set(relayoutEntries.map((entry) => entry.parentId))) {
        ctx.runLayoutForNode(parentId)
      }
    }

    const prevSelection = new Set(ctx.state.selectedIds)
    for (const { id } of entries) ctx.graph.deleteNode(id)
    for (const { id } of syncedInstanceEntries) ctx.graph.deleteNode(id)
    relayoutParents()

    ctx.undo.push({
      label: 'Delete',
      forward: () => {
        for (const { id } of entries) ctx.graph.deleteNode(id)
        for (const { id } of syncedInstanceEntries) ctx.graph.deleteNode(id)
        relayoutParents()
        ctx.setSelectedIds(new Set())
      },
      inverse: () => {
        restoreDeletedEntries(ctx, entries)
        restoreDeletedEntries(ctx, syncedInstanceEntries)
        relayoutParents()
        ctx.setSelectedIds(prevSelection)
      }
    })
    ctx.setSelectedIds(new Set())
  }

  function collectSyncedInstanceDeleteEntries(entries: readonly DeletedEntry[]): DeletedEntry[] {
    const deletedComponentNodeIds = new Set<string>()
    const containingComponentIds = new Set<string>()
    for (const entry of entries) {
      for (const id of entry.subtree.keys()) {
        const componentId = containingComponentIdForNode(id)
        if (!componentId || componentId === id) continue
        deletedComponentNodeIds.add(id)
        containingComponentIds.add(componentId)
      }
    }
    if (deletedComponentNodeIds.size === 0 || containingComponentIds.size === 0) return []

    const collected = new Set<string>()
    const sideEffects: DeletedEntry[] = []
    for (const componentId of containingComponentIds) {
      for (const instanceId of ctx.graph.instanceIndex.get(componentId) ?? []) {
        collectMappedInstanceDeletes(instanceId, deletedComponentNodeIds, collected, sideEffects)
      }
    }
    return sideEffects
  }

  function containingComponentIdForNode(id: string): string | null {
    let current = ctx.graph.getNode(id)
    while (current) {
      if (current.type === 'COMPONENT') return current.id
      current = current.parentId ? ctx.graph.getNode(current.parentId) : undefined
    }
    return null
  }

  function collectMappedInstanceDeletes(
    nodeId: string,
    deletedComponentNodeIds: ReadonlySet<string>,
    collected: Set<string>,
    sideEffects: DeletedEntry[],
    hasDeletedMappedAncestor = false
  ): void {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const isDeletedMapping = Boolean(
      node.componentId && deletedComponentNodeIds.has(node.componentId)
    )
    if (isDeletedMapping && !hasDeletedMappedAncestor && !collected.has(node.id)) {
      const parentId = node.parentId ?? ctx.state.currentPageId
      const parent = ctx.graph.getNode(parentId)
      sideEffects.push({
        id: node.id,
        parentId,
        index: parent?.childIds.indexOf(node.id) ?? -1,
        subtree: snapshotSubtree(ctx.graph, node.id)
      })
      collected.add(node.id)
    }
    const nextHasDeletedMappedAncestor = hasDeletedMappedAncestor || isDeletedMapping
    for (const childId of node.childIds) {
      collectMappedInstanceDeletes(
        childId,
        deletedComponentNodeIds,
        collected,
        sideEffects,
        nextHasDeletedMappedAncestor
      )
    }
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
