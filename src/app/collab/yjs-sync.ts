import * as Y from 'yjs'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { siblingOrderKeys } from '@open-pencil/scene-graph/order-keys'

import { decodeNodeFromYjs, syncEncodedNodeToYMap } from '@/app/collab/node-codec'
import {
  claimRoot,
  markTreeFormat,
  writeOrderKey,
  writePage,
  writeParentEntry,
  writeRootEntries,
  type YNodes
} from '@/app/collab/shared-tree/fields'
import { migrateLegacyLayers, TREE_MIGRATION_ORIGIN } from '@/app/collab/shared-tree/migration'
import {
  applySharedTree,
  createLocalEdit,
  createSharedTree,
  isLocalEditEmpty,
  keepSharedLayers,
  pageOf,
  recordLocalLayers,
  writeLocalPlacement,
  type LocalEdit,
  type SharedTree
} from '@/app/collab/shared-tree/sync'
import type { EditorStore } from '@/app/editor/active-store'

type YImages = Y.Map<Uint8Array>

type GraphBindingOptions = {
  store: EditorStore
  getYdoc: () => Y.Doc | null
  getYnodes: () => YNodes | null
  getSuppressGraphSync: () => boolean
  syncLocalEdit: (edit: LocalEdit) => void
}

type YjsObserverOptions = {
  store: EditorStore
  ynodes: YNodes
  yimages: YImages
  getSuppressYjsEvents: () => boolean
  setSuppressGraphSync: (value: boolean) => void
  applyYjsToGraph: (events: Y.YEvent<Y.Map<unknown>>[]) => void
}

type YjsGraphSyncOptions = {
  getStore: () => EditorStore
  getYdoc: () => Y.Doc | null
  getYnodes: () => YNodes | null
  getYimages: () => YImages | null
  setSuppressYjsEvents: (value: boolean) => void
}

function logCollabSyncError(context: string, error: unknown) {
  console.error(`[Collab] ${context}:`, error)
}

/**
 * Collects the graph events of one edit and syncs them once, after the edit, in one Yjs
 * transaction, so a move writes its parent entry and order key against the final layer order.
 */
export function bindCollabGraphEvents({
  store,
  getYdoc,
  getYnodes,
  getSuppressGraphSync,
  syncLocalEdit
}: GraphBindingOptions) {
  let edit = createLocalEdit()
  let bound = true

  function record(update: (pending: LocalEdit) => void) {
    if (getSuppressGraphSync() || !getYdoc() || !getYnodes()) return
    if (isLocalEditEmpty(edit)) queueMicrotask(flush)
    update(edit)
  }

  function flush() {
    const pending = edit
    edit = createLocalEdit()
    if (bound && getYdoc() && getYnodes()) syncLocalEdit(pending)
  }

  const unbinds = [
    store.onEditorEvent('node:updated', (id, changes) =>
      record((pending) => {
        // A direct parentId write, as a checkpoint restore makes, syncs as a move when it
        // differs from the shared tree; a childIds write re-keys the children out of order.
        pending.changed.add(id)
        if ('childIds' in changes) pending.reordered.add(id)
      })
    ),
    store.onEditorEvent('node:created', (node) =>
      record((pending) => {
        pending.changed.add(node.id)
        pending.placed.add(node.id)
      })
    ),
    store.onEditorEvent('node:reparented', (nodeId, oldParentId) =>
      record((pending) => {
        pending.changed.add(nodeId)
        pending.placed.add(nodeId)
        if (oldParentId) pending.previousParents.add(oldParentId)
      })
    ),
    store.onEditorEvent('node:reordered', (nodeId, _parentId, _index, previousParentId) =>
      record((pending) => {
        pending.placed.add(nodeId)
        if (previousParentId) pending.previousParents.add(previousParentId)
      })
    ),
    store.onEditorEvent('node:deleted', (id) => record((pending) => pending.deleted.add(id)))
  ]
  return () => {
    // An edit made just before leaving still reaches the room.
    if (!isLocalEditEmpty(edit)) flush()
    bound = false
    for (const unbind of unbinds) unbind()
  }
}

export function registerYjsObservers({
  store,
  ynodes,
  yimages,
  getSuppressYjsEvents,
  setSuppressGraphSync,
  applyYjsToGraph
}: YjsObserverOptions): () => void {
  function onNodes(events: Y.YEvent<Y.Map<unknown>>[], transaction: Y.Transaction) {
    // A migration this peer wrote was applied by the change that triggered it.
    if (getSuppressYjsEvents() || transaction.origin === TREE_MIGRATION_ORIGIN) return
    setSuppressGraphSync(true)
    try {
      applyYjsToGraph(events)
      store.requestRender()
    } catch (error) {
      logCollabSyncError('Failed to apply remote graph changes', error)
    } finally {
      setSuppressGraphSync(false)
    }
  }

  function onImages(event: Y.YMapEvent<Uint8Array>) {
    if (getSuppressYjsEvents()) return
    try {
      for (const [key, change] of event.changes.keys) {
        if (change.action === 'add' || change.action === 'update') {
          const data = yimages.get(key)
          if (data) store.graph.images.set(key, new Uint8Array(data))
        } else {
          store.graph.images.delete(key)
        }
      }
      store.requestRender()
    } catch (error) {
      logCollabSyncError('Failed to apply remote image changes', error)
    }
  }

  ynodes.observeDeep(onNodes)
  yimages.observe(onImages)
  return () => {
    ynodes.unobserveDeep(onNodes)
    yimages.unobserve(onImages)
  }
}

export function createYjsGraphSync({
  getStore,
  getYdoc,
  getYnodes,
  getYimages,
  setSuppressYjsEvents
}: YjsGraphSyncOptions) {
  let pendingPageSwitch: { store: EditorStore; pageId: string } | undefined
  let shared: SharedTree | null = null

  function sharedTreeOf(ydoc: Y.Doc): SharedTree {
    if (shared?.ydoc !== ydoc) {
      shared = createSharedTree(ydoc, () => getStore().graph, getYnodes)
    }
    return shared
  }

  function writeNode(graph: SceneGraph, ynodes: YNodes, nodeId: string): void {
    const node = graph.getNode(nodeId)
    if (!node) return
    let ynode = ynodes.get(nodeId)
    if (!ynode) {
      ynode = new Y.Map()
      ynodes.set(nodeId, ynode)
    }
    syncEncodedNodeToYMap(node, ynode)

    const localYimages = getYimages()
    if (!localYimages) return
    for (const fill of node.fills) {
      if (fill.imageHash && !localYimages.has(fill.imageHash)) {
        const data = graph.images.get(fill.imageHash)
        if (data) localYimages.set(fill.imageHash, data)
      }
    }
  }

  /** Writes one local edit: changed layers' fields, deletions, and where layers now sit. */
  function syncLocalEdit(edit: LocalEdit) {
    const graph = getStore().graph
    const ydoc = getYdoc()
    const ynodes = getYnodes()
    if (!ydoc || !ynodes) return
    const tree = sharedTreeOf(ydoc)
    setSuppressYjsEvents(true)
    try {
      ydoc.transact(() => {
        for (const id of edit.deleted) {
          if (graph.getNode(id)) {
            // Deleted and restored within the edit, as an undo can.
            edit.changed.add(id)
            edit.placed.add(id)
            continue
          }
          ynodes.delete(id)
          tree.tree.deleteLayer(id)
        }
        keepSharedLayers(tree, graph, edit)
        for (const id of edit.changed) writeNode(graph, ynodes, id)
        for (const id of edit.placed) if (!ynodes.has(id)) writeNode(graph, ynodes, id)
        writeLocalPlacement(tree, graph, ynodes, ydoc.getMap('meta'), edit)
      })
    } catch (error) {
      logCollabSyncError('Failed to sync local edit', error)
    } finally {
      setSuppressYjsEvents(false)
    }
  }

  function syncNodeToYjs(nodeId: string) {
    const edit = createLocalEdit()
    edit.changed.add(nodeId)
    syncLocalEdit(edit)
  }

  /**
   * Shares this peer's whole document, as Share does: every layer, its parent with counter 0, its
   * order, and its page, with its root as the room's.
   */
  function syncAllNodesToYjs() {
    const graph = getStore().graph
    const ydoc = getYdoc()
    const ynodes = getYnodes()
    if (!ydoc || !ynodes) return
    setSuppressYjsEvents(true)
    try {
      ydoc.transact(() => {
        for (const node of graph.getAllNodes()) writeNode(graph, ynodes, node.id)
        for (const node of graph.getAllNodes()) {
          const ynode = ynodes.get(node.id)
          if (!ynode) continue
          if (node.parentId === null) writeRootEntries(ynode)
          const pageId = pageOf(graph, node.id)
          if (pageId !== undefined) writePage(ynode, pageId)
          const children = node.childIds.filter((id) => graph.getNode(id)?.parentId === node.id)
          const keys = siblingOrderKeys(children.map(() => undefined))
          children.forEach((childId, index) => {
            const child = ynodes.get(childId)
            if (!child) return
            writeParentEntry(child, node.id, 0)
            writeOrderKey(child, keys[index])
          })
        }
        claimRoot(ydoc.getMap('meta'), graph.rootId)
        markTreeFormat(ydoc.getMap('meta'))
      })
      recordLocalLayers(sharedTreeOf(ydoc), ynodes, ydoc.getMap('meta'), ynodes.keys())
    } catch (error) {
      logCollabSyncError('Failed to sync document', error)
    } finally {
      setSuppressYjsEvents(false)
    }
  }

  function applyYjsToGraph(events: Y.YEvent<Y.Map<unknown>>[]) {
    const store = getStore()
    const ydoc = getYdoc()
    const ynodes = getYnodes()
    if (!ydoc || !ynodes) return
    const changed = new Set<string>()
    const deleted = new Set<string>()
    for (const event of events) {
      if (event.target === ynodes) {
        for (const [key, change] of event.changes.keys) {
          if (change.action === 'delete') deleted.add(key)
          else changed.add(key)
        }
        continue
      }
      // The path from the nodes map starts with the layer's id, whether its own field changed
      // or an entry of its nested parents map did.
      const [nodeId] = event.path
      if (typeof nodeId === 'string') changed.add(nodeId)
    }

    migrateLegacyLayers(ydoc, ynodes, ydoc.getMap('meta'), changed)
    for (const nodeId of changed) {
      const ynode = ynodes.get(nodeId)
      if (ynode) applyYnodeToGraph(store.graph, nodeId, ynode)
    }
    const gone = [...deleted].filter((nodeId) => !ynodes.has(nodeId))
    // Moves go first, so a layer moved out of a deleted parent survives the deletion.
    applySharedTree(sharedTreeOf(ydoc), store.graph, ynodes, ydoc.getMap('meta'), changed, gone)
    for (const nodeId of gone) store.graph.deleteNode(nodeId)
    ensureCurrentPageExists(store)
  }

  /** Applies a layer's own fields; `applySharedTree` places it in the tree afterwards. */
  function applyYnodeToGraph(graph: SceneGraph, nodeId: string, ynode: Y.Map<unknown>) {
    const props = decodeNodeFromYjs(ynode)
    if (graph.getNode(nodeId)) {
      graph.updateNode(nodeId, props)
      return
    }
    const type = props.type
    if (type) graph.createNodeWithId(nodeId, type, null, { ...props, childIds: [] })
  }

  function ensureCurrentPageExists(store: EditorStore) {
    const pages = store.graph.getPages()
    if (pages.some((page) => page.id === store.state.currentPageId)) return
    if (pages.length === 0) return
    const pageId = pages[0].id
    if (pendingPageSwitch?.store === store && pendingPageSwitch.pageId === pageId) return
    const pending = { store, pageId }
    pendingPageSwitch = pending
    void store
      .switchPage(pageId)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        logCollabSyncError('Failed to switch to a synced page', error)
      })
      .finally(() => {
        if (pendingPageSwitch === pending) pendingPageSwitch = undefined
      })
  }

  return { syncNodeToYjs, syncLocalEdit, syncAllNodesToYjs, applyYjsToGraph }
}
