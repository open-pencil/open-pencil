import * as Y from 'yjs'

import { YJS_JSON_FIELDS } from '@/constants'

import type { EditorStore } from '@/app/editor/active-store'
import type { SceneNode } from '@open-pencil/core/scene-graph'

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

export function syncNodePropsToYMap(node: SceneNode, ynode: Y.Map<unknown>) {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'object' && value !== null) {
      ynode.set(key, JSON.stringify(value))
    } else {
      ynode.set(key, value)
    }
  }
}

export function yNodeToProps(ynode: Y.Map<unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  for (const [key, value] of ynode.entries()) {
    if (YJS_JSON_FIELDS.has(key)) {
      try {
        props[key] = typeof value === 'string' ? JSON.parse(value) : value
      } catch {
        props[key] = value
      }
    } else {
      props[key] = value
    }
  }

  return props
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

  return store.graph.onNodeEvents({
    updated: (id) => onGraphMutation(id),
    created: (node) => onGraphMutation(node.id),
    reparented: (nodeId) => onGraphMutation(nodeId),
    reordered: (nodeId) => onGraphMutation(nodeId),
    deleted: (id) => {
      const ydoc = getYdoc()
      const ynodes = getYnodes()
      if (!getSuppressGraphSync() && ydoc && ynodes) {
        setSuppressYjsEvents(true)
        ydoc.transact(() => {
          ynodes.delete(id)
        })
        setSuppressYjsEvents(false)
      }
    }
  })
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
    } finally {
      setSuppressGraphSync(false)
    }
    store.requestRender()
  })

  yimages.observe((event) => {
    if (getSuppressYjsEvents()) return
    for (const [key, change] of event.changes.keys) {
      if (change.action === 'add' || change.action === 'update') {
        const data = yimages.get(key)
        if (data) store.graph.images.set(key, new Uint8Array(data))
      } else {
        store.graph.images.delete(key)
      }
    }
    store.requestRender()
  })
}

export function createYjsGraphSync({
  getStore,
  getYdoc,
  getYnodes,
  getYimages,
  setSuppressYjsEvents
}: YjsGraphSyncOptions) {
  function syncNodeToYjs(nodeId: string) {
    const store = getStore()
    const ydoc = getYdoc()
    const ynodes = getYnodes()
    if (!ydoc || !ynodes) return
    const node = store.graph.getNode(nodeId)
    if (!node) return

    const localYimages = getYimages()
    setSuppressYjsEvents(true)
    ydoc.transact(() => {
      let ynode = ynodes.get(nodeId)
      if (!ynode) {
        ynode = new Y.Map()
        ynodes.set(nodeId, ynode)
      }
      syncNodePropsToYMap(node, ynode)

      if (localYimages) {
        for (const fill of node.fills) {
          if (fill.imageHash && !localYimages.has(fill.imageHash)) {
            const data = store.graph.images.get(fill.imageHash)
            if (data) localYimages.set(fill.imageHash, data)
          }
        }
      }
    })
    setSuppressYjsEvents(false)
  }

  function syncAllNodesToYjs() {
    const store = getStore()
    const ydoc = getYdoc()
    const ynodes = getYnodes()
    if (!ydoc || !ynodes) return
    const localYimages = getYimages()
    setSuppressYjsEvents(true)
    ydoc.transact(() => {
      for (const node of store.graph.getAllNodes()) {
        let ynode = ynodes.get(node.id)
        if (!ynode) {
          ynode = new Y.Map()
          ynodes.set(node.id, ynode)
        }
        syncNodePropsToYMap(node, ynode)
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
    setSuppressYjsEvents(false)
  }

  function applyYjsToGraph(events: Y.YEvent<Y.Map<unknown>>[]) {
    const store = getStore()
    const ynodes = getYnodes()
    if (!ynodes) return
    for (const event of events) {
      if (event.target === ynodes) {
        for (const [key, change] of event.changes.keys) {
          if (change.action === 'add') {
            const ynode = ynodes.get(key)
            if (ynode) applyYnodeToGraph(key, ynode)
          } else if (change.action === 'delete') {
            store.graph.deleteNode(key)
          }
        }
      } else if (event.target.parent === ynodes) {
        const nodeId = findNodeIdForYMap(event.target)
        if (nodeId) {
          const ynode = ynodes.get(nodeId)
          if (ynode) applyYnodeToGraph(nodeId, ynode)
        }
      }
    }
  }

  function findNodeIdForYMap(ymap: Y.Map<unknown>): string | null {
    const ynodes = getYnodes()
    if (!ynodes) return null
    for (const [key, value] of ynodes.entries()) {
      if (value === ymap) return key
    }
    return null
  }

  function applyYnodeToGraph(nodeId: string, ynode: Y.Map<unknown>) {
    const store = getStore()
    const existing = store.graph.getNode(nodeId)
    const props = yNodeToProps(ynode)

    if (existing) {
      store.graph.updateNode(nodeId, props as Partial<SceneNode>)
      return
    }

    const parentId = props.parentId as string
    if (parentId && store.graph.getNode(parentId)) {
      const type = props.type as SceneNode['type']
      const node = store.graph.createNode(type, parentId, props as Partial<SceneNode>)
      store.graph.nodes.delete(node.id)
      node.id = nodeId
      store.graph.nodes.set(nodeId, node)
    }
  }

  return { syncNodeToYjs, syncAllNodesToYjs, applyYjsToGraph }
}
