import { expect } from 'bun:test'

import * as Y from 'yjs'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  bindCollabGraphEvents,
  createYjsGraphSync,
  registerYjsObservers
} from '@/app/collab/yjs-sync'
import { createEditorStore } from '@/app/editor/session'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { connectYDocs } from '#tests/helpers/yjs'

/** Host and peer editor stores whose Yjs documents sync through the app's collab code. */
export type SyncedStores = ReturnType<typeof createSyncedStores>

export type SyncedStoreOptions = {
  hostDoc?: Y.Doc
  peerDoc?: Y.Doc
  connectImmediately?: boolean
  /** Sync local graph edits to Yjs through graph events, as a collab session does. */
  bindGraphEvents?: boolean
}

export function createSyncedStores(options: SyncedStoreOptions = {}) {
  const hostStore = createEditorStore(new SceneGraph())
  const peerStore = createEditorStore(new SceneGraph())
  const hostDoc = options.hostDoc ?? new Y.Doc()
  const peerDoc = options.peerDoc ?? new Y.Doc()
  const hostNodes = hostDoc.getMap<Y.Map<unknown>>('nodes')
  const peerNodes = peerDoc.getMap<Y.Map<unknown>>('nodes')
  const hostImages = hostDoc.getMap<Uint8Array>('images')
  const peerImages = peerDoc.getMap<Uint8Array>('images')
  let hostSuppressYjsEvents = false
  let peerSuppressYjsEvents = false
  let hostSuppressGraphSync = false
  let peerSuppressGraphSync = false

  const hostSync = createYjsGraphSync({
    getStore: () => hostStore,
    getYdoc: () => hostDoc,
    getYnodes: () => hostNodes,
    getYimages: () => hostImages,
    setSuppressYjsEvents: (value) => {
      hostSuppressYjsEvents = value
    }
  })
  const peerSync = createYjsGraphSync({
    getStore: () => peerStore,
    getYdoc: () => peerDoc,
    getYnodes: () => peerNodes,
    getYimages: () => peerImages,
    setSuppressYjsEvents: (value) => {
      peerSuppressYjsEvents = value
    }
  })

  registerYjsObservers({
    store: hostStore,
    ynodes: hostNodes,
    yimages: hostImages,
    getSuppressYjsEvents: () => hostSuppressYjsEvents,
    setSuppressGraphSync: (value) => {
      hostSuppressGraphSync = value
    },
    applyYjsToGraph: hostSync.applyYjsToGraph
  })
  registerYjsObservers({
    store: peerStore,
    ynodes: peerNodes,
    yimages: peerImages,
    getSuppressYjsEvents: () => peerSuppressYjsEvents,
    setSuppressGraphSync: (value) => {
      peerSuppressGraphSync = value
    },
    applyYjsToGraph: peerSync.applyYjsToGraph
  })

  const unbindGraphEvents = options.bindGraphEvents
    ? [
        bindCollabGraphEvents({
          store: hostStore,
          getYdoc: () => hostDoc,
          getYnodes: () => hostNodes,
          getSuppressGraphSync: () => hostSuppressGraphSync,
          syncLocalEdit: hostSync.syncLocalEdit
        }),
        bindCollabGraphEvents({
          store: peerStore,
          getYdoc: () => peerDoc,
          getYnodes: () => peerNodes,
          getSuppressGraphSync: () => peerSuppressGraphSync,
          syncLocalEdit: peerSync.syncLocalEdit
        })
      ]
    : []

  const disconnectYDocs =
    options.connectImmediately === false ? undefined : connectYDocs(hostDoc, peerDoc)

  return {
    hostStore,
    peerStore,
    hostSync,
    peerSync,
    hostDoc,
    peerDoc,
    disconnectYDocs,
    get hostSuppressGraphSync() {
      return hostSuppressGraphSync
    },
    get peerSuppressGraphSync() {
      return peerSuppressGraphSync
    },
    cleanup: () => {
      for (const unbind of unbindGraphEvents) unbind()
      hostStore.preparationController.dispose()
      peerStore.preparationController.dispose()
      disconnectYDocs?.()
      hostDoc.destroy()
      peerDoc.destroy()
    }
  }
}

export async function withSyncedStores(
  run: (stores: SyncedStores) => void | Promise<void>,
  options: SyncedStoreOptions = {}
) {
  const stores = createSyncedStores(options)
  try {
    await run(stores)
  } finally {
    stores.cleanup()
  }
}

/** Lets the sync a local edit schedules after its graph events run. */
export async function settleGraphSync() {
  await Promise.resolve()
}

/**
 * Both peers hold the same acyclic tree under `rootIds`, and every layer in it sits in its parent's
 * `childIds`. Returns the layers the tree reaches.
 */
export function expectSameLayerTree(
  { hostStore, peerStore }: SyncedStores,
  rootIds: string[]
): Set<string> {
  const host = hostStore.graph
  const peer = peerStore.graph
  const visited = new Set<string>()
  const pending = [...rootIds]
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    expect(visited.has(id)).toBe(false)
    visited.add(id)
    const hostNode = getNodeOrThrow(host, id)
    const peerNode = getNodeOrThrow(peer, id)
    expect(peerNode.parentId).toBe(hostNode.parentId)
    expect(peerNode.childIds).toEqual(hostNode.childIds)
    for (const childId of hostNode.childIds) {
      expect(getNodeOrThrow(host, childId).parentId).toBe(id)
      pending.push(childId)
    }
  }
  return visited
}
