import { CommittedGraphEventError } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { parseFigmaClipboard, parseOpenPencilClipboard } from '#core/clipboard'
import { prepareClipboardImport } from '#core/clipboard/fig-import'
import { computeAllLayouts } from '#core/layout'

import { createClipboardAssetActions } from './clipboard/assets'
import type { ClipboardSnapshot } from './clipboard/copy'
import { createClipboardCopyActions } from './clipboard/copy'
import { importClipboardDependencies } from './clipboard/dependencies'
import { createClipboardExportActions } from './clipboard/export'
import { createClipboardFontActions } from './clipboard/fonts'
import { deleteIds, recreateSnapshots, restoreDeletedEntries } from './clipboard/history'
import type { PasteHistoryOperation } from './clipboard/paste-replace'
import { replaceTargetsWithCreated, selectedReplacementTargets } from './clipboard/paste-replace'
import {
  instanceSafeParent,
  pastedComponentIds,
  resolvePasteTarget
} from './clipboard/paste-target'
import { createClipboardPlacementActions } from './clipboard/placement'
import { collectSubtrees, restoreSubtree, snapshotSubtree } from './clipboard/subtree-history'
import { acceptsChildren, prepareSlotEdits } from './components/slots'
import type { EditorContext } from './types'

type PasteOptions = {
  replaceSelection?: boolean
}

/**
 * A copy of the layer under the same parent, keeping its name as Figma does. A main component
 * outside a component set duplicates as an instance of itself.
 */
export function duplicateNode(
  ctx: Pick<EditorContext, 'graph'>,
  node: SceneNode,
  parentId: string,
  position: Vector
): SceneNode | null {
  const parent = ctx.graph.getNode(parentId)
  if (node.type === 'COMPONENT' && parent?.type !== 'COMPONENT_SET') {
    return ctx.graph.createInstance(node.id, parentId, { name: node.name, ...position })
  }
  return ctx.graph.cloneTree(node.id, parentId, { name: node.name, ...position })
}

export function createClipboardActions(ctx: EditorContext) {
  function duplicateSelected(selectedNodes: SceneNode[]) {
    const prevSelection = new Set(ctx.state.selectedIds)
    const selectedSet = new Set(selectedNodes.map((n) => n.id))
    const topLevel = selectedNodes.filter((n) => !n.parentId || !selectedSet.has(n.parentId))
    const parents = topLevel.map((node) => node.parentId ?? ctx.state.currentPageId)
    if (!prepareSlotEdits(ctx, parents)) return

    const newRootIds: string[] = []
    const allSnapshots = new Map<string, SceneNode>()

    const placed: Rect[] = []
    for (const node of topLevel) {
      const parentId = node.parentId ?? ctx.state.currentPageId
      const position =
        topLevel.length === 1
          ? placementActions.duplicatePosition(node, placed)
          : { x: node.x, y: node.y }
      const clone = duplicateNode(ctx, node, parentId, position)
      if (!clone) continue
      placed.push(getAxisAlignedBoundsInParent([clone], parentId, ctx.graph))
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

  function pushCreatedNodesUndo(
    created: string[],
    prevSelection: Set<string>,
    label = 'Paste',
    operation?: PasteHistoryOperation
  ) {
    const allNodes = collectSubtrees(ctx.graph, created)
    const pageId = ctx.state.currentPageId
    operation?.capture()
    ctx.undo.push({
      label,
      forward: () => {
        if (operation) operation.redo()
        else recreateSnapshots(ctx, allNodes, pageId)
        computeAllLayouts(ctx.graph, pageId)
        ctx.setSelectedIds(new Set(created))
      },
      inverse: () => {
        if (operation) operation.undo()
        else deleteIds(ctx, created)
        computeAllLayouts(ctx.graph, pageId)
        ctx.setSelectedIds(prevSelection)
      }
    })
  }

  async function pasteSnapshot(
    snapshot: ClipboardSnapshot,
    cursorPos?: Vector,
    options: PasteOptions = {}
  ) {
    let created: string[] = []
    ctx.undo.runBatch('Paste', () => {
      const dependencies = importClipboardDependencies(ctx, snapshot)
      if (dependencies.styleSnapshots.length > 0) {
        ctx.undo.push({
          label: 'Import clipboard styles',
          forward: () => {
            for (const style of dependencies.styleSnapshots) {
              ctx.graph.preserveSourceMetadataDuring(() =>
                ctx.graph.createNode(style.type, ctx.state.currentPageId, style)
              )
            }
          },
          inverse: () => {
            for (const style of dependencies.styleSnapshots) ctx.graph.deleteNode(style.id)
          }
        })
      }
      if (dependencies.applyVariables && dependencies.revertVariables) {
        ctx.undo.push({
          label: 'Import clipboard variables',
          forward: dependencies.applyVariables,
          inverse: dependencies.revertVariables
        })
      }
      created = pasteOpenPencilNodes(
        dependencies.nodes,
        snapshot.images,
        dependencies.componentDependencies,
        cursorPos,
        options
      )
    })
    await fontActions.loadFontsForNodes(created)
  }

  async function pasteFromHTML(html: string, cursorPos?: Vector, options: PasteOptions = {}) {
    const openPencil = parseOpenPencilClipboard(html)
    if (openPencil) {
      // One undo step for the paste and any slot it claims.
      const created = ctx.undo.runBatch('Paste', () =>
        pasteOpenPencilNodes(openPencil.nodes, openPencil.images, [], cursorPos, options)
      )
      await fontActions.loadFontsForNodes(created)
      return
    }

    const figma = await parseFigmaClipboard(html)
    if (figma) {
      // One undo step for the paste and any slot it claims.
      const pasted = ctx.undo.runBatch('Paste', () => {
        const prevSelection = new Set(ctx.state.selectedIds)
        const replacementTargets = options.replaceSelection ? selectedReplacementTargets(ctx) : []
        const pasteTarget = replacementTargets[0]?.parentId ?? resolvePasteTarget(ctx)
        if (!prepareSlotEdits(ctx, [pasteTarget])) return null
        const operation = prepareClipboardImport(figma.nodes, ctx.graph, pasteTarget, figma.blobs)
        let deliveryError: CommittedGraphEventError | undefined
        try {
          operation.commit()
        } catch (error) {
          if (!(error instanceof CommittedGraphEventError)) throw error
          deliveryError = error
        }
        const created = operation.plan.rootIds
        if (created.length === 0) return null

        if (replacementTargets.length > 0) {
          replaceTargetsWithCreated(
            ctx,
            placementActions.centerNodesAt,
            created,
            replacementTargets,
            prevSelection,
            operation
          )
        } else {
          placementActions.placeForeignPaste(created, pasteTarget, cursorPos)
          computeAllLayouts(ctx.graph, ctx.state.currentPageId)
          ctx.setSelectedIds(new Set(created))
          pushCreatedNodesUndo(created, prevSelection, 'Paste', operation)
        }
        return { created, deliveryError }
      })
      if (!pasted) return
      const { created, deliveryError } = pasted

      if (deliveryError) throw deliveryError
      await Promise.all([
        hydrateFigmaClipboardImages(figma.meta.fileKey, created),
        fontActions.loadFontsForNodes(created)
      ])
      ctx.requestRender()
    }
  }

  function pasteOpenPencilNodes(
    nodes: Array<SceneNode & { children?: SceneNode[] }>,
    images: Map<string, Uint8Array>,
    dependencies: Array<SceneNode & { children?: SceneNode[] }> = [],
    cursorPos?: Vector,
    options: PasteOptions = {}
  ) {
    const prevSelection = new Set(ctx.state.selectedIds)
    const replacementTargets = options.replaceSelection ? selectedReplacementTargets(ctx) : []
    for (const [hash, bytes] of images) ctx.graph.images.set(hash, bytes)

    const created: string[] = []
    const copiedIds = new Map<string, string>()
    const createNodeTree = (source: SceneNode & { children?: SceneNode[] }, parentId: string) => {
      const { id: _id, childIds: _childIds, children = [], parentId: _parentId, ...rest } = source
      const node = ctx.graph.createNode(source.type, parentId, {
        ...structuredClone(rest),
        childIds: []
      })
      copiedIds.set(source.id, node.id)
      for (const child of children) createNodeTree(child, node.id)
      return node.id
    }

    const requestedTarget = replacementTargets[0]?.parentId ?? resolvePasteTarget(ctx)
    const pasteTarget = instanceSafeParent(
      ctx.graph,
      requestedTarget,
      pastedComponentIds(ctx.graph, [...nodes, ...dependencies])
    )
    if (!prepareSlotEdits(ctx, [pasteTarget])) return created
    const dependencyRootIds: string[] = []
    for (const dependency of dependencies)
      dependencyRootIds.push(createNodeTree(dependency, ctx.state.currentPageId))
    for (const node of nodes) created.push(createNodeTree(node, pasteTarget))
    for (const id of copiedIds.values()) {
      const node = ctx.graph.getNode(id)
      if (!node) continue
      const componentId = node.componentId ? copiedIds.get(node.componentId) : undefined
      const instanceOverrides = {
        self: node.instanceOverrides.self,
        descendants: new Map(
          [...node.instanceOverrides.descendants].map(([target, fields]) => [
            copiedIds.get(target) ?? target,
            fields
          ])
        )
      }
      ctx.graph.updateNode(id, { componentId: componentId ?? node.componentId, instanceOverrides })
    }
    if (dependencyRootIds.length > 0) {
      const snapshots = collectSubtrees(ctx.graph, dependencyRootIds)
      ctx.undo.push({
        label: 'Import component dependencies',
        forward: () => recreateSnapshots(ctx, snapshots, ctx.state.currentPageId),
        inverse: () => deleteIds(ctx, dependencyRootIds)
      })
    }
    if (created.length === 0) return created

    if (replacementTargets.length > 0) {
      replaceTargetsWithCreated(
        ctx,
        placementActions.centerNodesAt,
        created,
        replacementTargets,
        prevSelection
      )
      return created
    }

    if (cursorPos) placementActions.centerNodesAtCanvasPoint(created, pasteTarget, cursorPos)
    else
      placementActions.placePasted(
        created,
        nodes[0]?.parentId ?? undefined,
        pasteTarget,
        requestedTarget
      )
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    ctx.setSelectedIds(new Set(created))

    pushCreatedNodesUndo(created, prevSelection)
    return created
  }

  function missingImageHashes(nodeIds: string[]) {
    const hashes = new Set<string>()
    for (const node of collectSubtrees(ctx.graph, nodeIds)) {
      for (const fill of node.fills) {
        if (fill.type === 'IMAGE' && fill.imageHash && !ctx.graph.images.has(fill.imageHash)) {
          hashes.add(fill.imageHash)
        }
      }
    }
    return [...hashes]
  }

  async function hydrateFigmaClipboardImages(fileKey: string, nodeIds: string[]) {
    const hashes = missingImageHashes(nodeIds)
    if (hashes.length === 0) return

    const resolver = ctx.resolveFigmaClipboardImages
    if (resolver) {
      try {
        const images = await resolver(fileKey, hashes)
        for (const hash of hashes) {
          const bytes = images.get(hash)
          if (bytes) ctx.graph.images.set(hash, bytes)
        }
      } catch (error) {
        console.warn('Failed to fetch Figma clipboard images', error)
      }
    }

    const missing = missingImageHashes(nodeIds).length
    if (missing > 0) {
      ctx.emitEditorEvent('clipboard:images-missing', {
        total: hashes.length,
        missing,
        fetchAttempted: Boolean(resolver)
      })
    }
  }

  function warnMissingImages(nodeIds: string[]) {
    return missingImageHashes(nodeIds).length > 0
  }

  /**
   * Deletes layers with their children as one undo step, skipping locked ones and, as in Figma,
   * layers of an instance outside its slots. Deleted layers leave the selection, and undo
   * restores the selection from before.
   */
  function deleteNodes(nodeIds: Iterable<string>, nextSelection?: ReadonlySet<string>) {
    // One undo step for the delete and any slot it claims.
    ctx.undo.runBatch('Delete', () => deleteLayers(nodeIds, nextSelection))
  }

  function deleteLayers(nodeIds: Iterable<string>, nextSelection?: ReadonlySet<string>) {
    const entries: Array<{
      id: string
      parentId: string
      index: number
      subtree: Map<string, SceneNode>
    }> = []
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (!node || node.locked) continue
      const parentId = node.parentId ?? ctx.state.currentPageId
      if (!acceptsChildren(ctx, parentId)) continue
      const parent = ctx.graph.getNode(parentId)
      const index = parent?.childIds.indexOf(id) ?? -1
      entries.push({ id, parentId, index, subtree: snapshotSubtree(ctx.graph, id) })
    }
    if (entries.length === 0) return
    prepareSlotEdits(
      ctx,
      entries.map((entry) => entry.parentId)
    )
    for (const entry of entries) entry.subtree = snapshotSubtree(ctx.graph, entry.id)

    const relayoutParents = () => {
      for (const parentId of new Set(entries.map((entry) => entry.parentId))) {
        ctx.runLayoutForNode(parentId)
      }
    }

    const prevSelection = new Set(ctx.state.selectedIds)
    for (const { id } of entries) ctx.graph.deleteNode(id)
    relayoutParents()
    const selectionAfter =
      nextSelection ?? new Set([...prevSelection].filter((id) => ctx.graph.getNode(id)))

    ctx.undo.push({
      label: 'Delete',
      forward: () => {
        for (const { id } of entries) ctx.graph.deleteNode(id)
        relayoutParents()
        ctx.setSelectedIds(new Set(selectionAfter))
      },
      inverse: () => {
        restoreDeletedEntries(ctx, entries)
        relayoutParents()
        ctx.setSelectedIds(prevSelection)
      }
    })
    ctx.setSelectedIds(new Set(selectionAfter))
  }

  function deleteSelected() {
    deleteNodes(ctx.state.selectedIds, new Set())
  }

  const copyActions = createClipboardCopyActions(ctx)
  const exportActions = createClipboardExportActions(ctx)
  const fontActions = createClipboardFontActions(ctx)
  const assetActions = createClipboardAssetActions(ctx, pushCreatedNodesUndo)
  const placementActions = createClipboardPlacementActions(ctx)

  return {
    collectSubtrees,
    ...placementActions,
    ...fontActions,
    duplicateSelected,
    duplicateNode: (node: SceneNode, parentId: string, position: Vector) =>
      duplicateNode(ctx, node, parentId, position),
    ...copyActions,
    pasteSnapshot,
    pasteFromHTML,
    warnMissingImages,
    deleteNodes,
    deleteSelected,
    ...assetActions,
    ...exportActions
  }
}
