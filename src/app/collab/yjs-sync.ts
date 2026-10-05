import { omit, pick } from 'es-toolkit/object'
import * as Y from 'yjs'

import type { SceneNode } from '@open-pencil/scene-graph'

import { decodeNodeFromYjs, syncEncodedNodeToYMap } from '@/app/collab/node-codec'
import { applySyncedTree, type SyncedTree } from '@/app/collab/tree'
import type { EditorStore } from '@/app/editor/active-store'

type YNodes = Y.Map<Y.Map<unknown>>
type YImages = Y.Map<Uint8Array>

type GraphBindingOptions = {
  store: EditorStore
  getYdoc: () => Y.Doc | null
  getYnodes: () => YNodes | null
  getSuppressGraphSync: () => boolean
  setSuppressYjsEvents: (value: boolean) => void
  syncNodeToYjs: (nodeId: string) => void
}

type YjsObserverOptions = {
  store: EditorStore
  ynodes: Y.Map<Y.Map<unknown>>
  yimages: Y.Map<Uint8Array>
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

const LOCAL_TRANSFORM_FIELDS = ['x', 'y', 'rotation', 'flipX', 'flipY'] as const
type LocalTransform = Pick<SceneNode, (typeof LOCAL_TRANSFORM_FIELDS)[number]>

function syncedTreeOf(ynodes: YNodes): SyncedTree {
  return {
    parentOf(nodeId) {
      const ynode = ynodes.get(nodeId)
      if (!ynode) return undefined
      const parentId = ynode.get('parentId')
      return typeof parentId === 'string' ? parentId : null
    },
    childOrderOf(nodeId) {
      const childIds = ynodes.get(nodeId)?.get('childIds')
      return Array.isArray(childIds)
        ? childIds.filter((id): id is string => typeof id === 'string')
        : []
    }
  }
}

function logCollabSyncError(context: string, error: unknown) {
  console.error(`[Collab] ${context}:`, error)
}

export function bindCollabGraphEvents({
  store,
  getYdoc,
  getYnodes,
  getSuppressGraphSync,
  setSuppressYjsEvents,
  syncNodeToYjs
}: GraphBindingOptions) {
  function onGraphMutation(nodeId: string) {
    if (!getSuppressGraphSync() && getYdoc() && getYnodes()) {
      syncNodeToYjs(nodeId)
    }
  }

  // A parent's child list syncs once per edit, after every layer the edit touches has moved.
  const staleParents = new Set<string>()
  let bound = true

  function onChildrenChanged(...parentIds: (string | null | undefined)[]) {
    if (getSuppressGraphSync() || !getYdoc() || !getYnodes()) return
    if (staleParents.size === 0) queueMicrotask(syncStaleParents)
    for (const parentId of parentIds) if (parentId) staleParents.add(parentId)
  }

  function syncStaleParents() {
    const parentIds = [...staleParents]
    staleParents.clear()
    const ydoc = getYdoc()
    if (!bound || !ydoc || !getYnodes()) return
    setSuppressYjsEvents(true)
    try {
      ydoc.transact(() => {
        for (const parentId of parentIds) syncNodeToYjs(parentId)
      })
    } catch (error) {
      logCollabSyncError('Failed to sync layer order', error)
    } finally {
      setSuppressYjsEvents(false)
    }
  }

  const unbinds = [
    store.onEditorEvent('node:updated', (id) => onGraphMutation(id)),
    store.onEditorEvent('node:created', (node) => {
      onGraphMutation(node.id)
      onChildrenChanged(node.parentId)
    }),
    store.onEditorEvent('node:reparented', (nodeId, oldParentId, newParentId) => {
      onGraphMutation(nodeId)
      onChildrenChanged(oldParentId, newParentId)
    }),
    store.onEditorEvent('node:reordered', (nodeId, parentId, _index, previousParentId) => {
      onGraphMutation(nodeId)
      onChildrenChanged(parentId, previousParentId)
    }),
    store.onEditorEvent('node:deleted', (id, parentId) => {
      const ydoc = getYdoc()
      const ynodes = getYnodes()
      if (!getSuppressGraphSync() && ydoc && ynodes) {
        setSuppressYjsEvents(true)
        try {
          ydoc.transact(() => {
            ynodes.delete(id)
          })
        } catch (error) {
          logCollabSyncError('Failed to delete synced node', error)
        } finally {
          setSuppressYjsEvents(false)
        }
      }
      onChildrenChanged(parentId)
    })
  ]
  return () => {
    bound = false
    staleParents.clear()
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
}: YjsObserverOptions) {
  ynodes.observeDeep((events) => {
    if (getSuppressYjsEvents()) return
    setSuppressGraphSync(true)
    try {
      applyYjsToGraph(events)
      store.requestRender()
    } catch (error) {
      logCollabSyncError('Failed to apply remote graph changes', error)
    } finally {
      setSuppressGraphSync(false)
    }
  })

  yimages.observe((event) => {
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
  })
}

export function createYjsGraphSync({
  getStore,
  getYdoc,
  getYnodes,
  getYimages,
  setSuppressYjsEvents
}: YjsGraphSyncOptions) {
  let pendingPageSwitch: { store: EditorStore; pageId: string } | undefined

  function syncNodeToYjs(nodeId: string) {
    const store = getStore()
    const ydoc = getYdoc()
    const ynodes = getYnodes()
    if (!ydoc || !ynodes) return
    const node = store.graph.getNode(nodeId)
    if (!node) return

    const localYimages = getYimages()
    setSuppressYjsEvents(true)
    try {
      ydoc.transact(() => {
        let ynode = ynodes.get(nodeId)
        if (!ynode) {
          ynode = new Y.Map()
          ynodes.set(nodeId, ynode)
        }
        syncEncodedNodeToYMap(node, ynode)

        if (localYimages) {
          for (const fill of node.fills) {
            if (fill.imageHash && !localYimages.has(fill.imageHash)) {
              const data = store.graph.images.get(fill.imageHash)
              if (data) localYimages.set(fill.imageHash, data)
            }
          }
        }
      })
    } catch (error) {
      logCollabSyncError(`Failed to sync node ${nodeId}`, error)
    } finally {
      setSuppressYjsEvents(false)
    }
  }

  function syncAllNodesToYjs() {
    const store = getStore()
    const ydoc = getYdoc()
    const ynodes = getYnodes()
    if (!ydoc || !ynodes) return
    const localYimages = getYimages()
    setSuppressYjsEvents(true)
    try {
      ydoc.transact(() => {
        for (const node of store.graph.getAllNodes()) {
          let ynode = ynodes.get(node.id)
          if (!ynode) {
            ynode = new Y.Map()
            ynodes.set(node.id, ynode)
          }
          syncEncodedNodeToYMap(node, ynode)
        }
      })
      if (localYimages) {
        ydoc.transact(() => {
          for (const [hash, data] of store.graph.images) {
            if (!localYimages.has(hash)) {
              localYimages.set(hash, data)
            }
          }
        })
      }
    } catch (error) {
      logCollabSyncError('Failed to sync document', error)
    } finally {
      setSuppressYjsEvents(false)
    }
  }

  function applyYjsToGraph(events: Y.YEvent<Y.Map<unknown>>[]) {
    const store = getStore()
    const ynodes = getYnodes()
    if (!ynodes) return
    const changed = new Set<string>()
    const deleted = new Set<string>()
    for (const event of events) {
      if (event.target === ynodes) {
        for (const [key, change] of event.changes.keys) {
          if (change.action === 'delete') deleted.add(key)
          else changed.add(key)
        }
      } else if (event.target.parent === ynodes) {
        const nodeId = findNodeIdForYMap(event.target)
        if (nodeId) changed.add(nodeId)
      }
    }

    const transforms = new Map<string, LocalTransform>()
    for (const nodeId of changed) {
      const ynode = ynodes.get(nodeId)
      if (ynode) applyYnodeToGraph(nodeId, ynode, transforms)
    }
    // Moves go first, so a layer moved out of a deleted parent survives the deletion.
    const rejected = applySyncedTree(store.graph, syncedTreeOf(ynodes), changed)
    for (const nodeId of deleted) {
      if (!ynodes.has(nodeId)) store.graph.deleteNode(nodeId)
    }
    for (const nodeId of rejected) restoreRejectedParent(nodeId, transforms.get(nodeId))
    ensureCurrentPageExists(store)
  }

  /**
   * A move that would make a layer its own ancestor keeps the layer where it was, and the layer's
   * parent and position are written back so every peer settles on that tree.
   */
  function restoreRejectedParent(nodeId: string, transform: LocalTransform | undefined) {
    const store = getStore()
    if (!store.graph.getNode(nodeId)?.parentId) return
    if (transform) store.graph.updateNode(nodeId, transform)
    syncNodeToYjs(nodeId)
  }

  function findNodeIdForYMap(ymap: Y.Map<unknown>): string | null {
    const ynodes = getYnodes()
    if (!ynodes) return null
    for (const [key, value] of ynodes.entries()) {
      if (value === ymap) return key
    }
    return null
  }

  /** Applies a layer's own properties; `applySyncedTree` places it in the tree afterwards. */
  function applyYnodeToGraph(
    nodeId: string,
    ynode: Y.Map<unknown>,
    transforms: Map<string, LocalTransform>
  ) {
    const store = getStore()
    const existing = store.graph.getNode(nodeId)
    const props = decodeNodeFromYjs(ynode)
    const parentId = typeof props.parentId === 'string' ? props.parentId : null
    const own = omit(props, ['parentId', 'childIds'])

    if (existing) {
      // Kept until the move is known to be accepted: a rejected move keeps the old position.
      if (parentId !== null && parentId !== existing.parentId) {
        transforms.set(nodeId, pick(existing, LOCAL_TRANSFORM_FIELDS))
      }
      store.graph.updateNode(nodeId, own)
    } else {
      const type = props.type
      if (!type) return
      store.graph.createNodeWithId(nodeId, type, null, { ...own, childIds: [] })
    }
    if (parentId === null) store.graph.rootId = nodeId
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

  return { syncNodeToYjs, syncAllNodesToYjs, applyYjsToGraph }
}
