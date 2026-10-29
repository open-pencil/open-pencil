import { isEqual } from 'es-toolkit/predicate'
import * as v from 'valibot'
import type * as Y from 'yjs'

import type { Variable, VariableCollection } from '@open-pencil/scene-graph'
import { variableCollectionSchema, variableSchema } from '@open-pencil/scene-graph/variables'

import type { EditorStore } from '@/app/editor/active-store'

import { changedIds, writeChanges, type YRecords } from './records'

/** A variable's values are a map of their own by mode. */
const BY_MODE = new Set(['valuesByMode'])

type VariableSyncOptions = {
  store: EditorStore
  ydoc: Y.Doc
  yvariables: YRecords
  ycollections: YRecords
}

function isVariable(value: unknown): value is Variable {
  return v.is(variableSchema, value)
}

function isCollection(value: unknown): value is VariableCollection {
  return v.is(variableCollectionSchema, value)
}

/** Sets a record in place where it exists, as views may hold it, as undo does. */
function applyRecord<T extends object>(target: Map<string, T>, id: string, value: T): void {
  const existing = target.get(id)
  if (!existing) {
    target.set(id, value)
    return
  }
  for (const key of Object.keys(existing)) {
    if (!Object.hasOwn(value, key)) Reflect.deleteProperty(existing, key)
  }
  Object.assign(existing, value)
}

/**
 * Keeps the document's variables and collections in step with the room's. Local edits reach the
 * room after every change to the history, which every variable edit, undo, and redo makes;
 * peers' edits are applied without one, and the layers bound to them are laid out again.
 * Which mode a collection shows is each viewer's own, and stays out of the room.
 */
export function bindVariableSync({ store, ydoc, yvariables, ycollections }: VariableSyncOptions) {
  const graph = () => store.graph
  // What the room holds as this peer last wrote or read it, so only what changed since is sent.
  let sentVariables = structuredClone(graph().variables)
  let sentCollections = structuredClone(graph().variableCollections)

  function send() {
    const { variables, variableCollections } = graph()
    if (isEqual(sentVariables, variables) && isEqual(sentCollections, variableCollections)) return
    ydoc.transact(() => {
      writeChanges(ycollections, variableCollections, sentCollections)
      writeChanges(yvariables, variables, sentVariables, { nested: BY_MODE })
    })
    sentVariables = structuredClone(variables)
    sentCollections = structuredClone(variableCollections)
  }

  /** Writes every variable and collection, as Share does with the layers. */
  function share() {
    sentVariables = new Map()
    sentCollections = new Map()
    send()
  }

  /**
   * A collection lists its variables in order. Two peers adding variables at once each write
   * their own list, and the room keeps one, so a variable missing from its collection's list is
   * added at the end, in the same order on every peer.
   */
  function keepCollectionsComplete(collectionIds: Iterable<string>) {
    const { variables, variableCollections } = graph()
    for (const id of collectionIds) {
      const collection = variableCollections.get(id)
      if (!collection) continue
      const listed = new Set(collection.variableIds)
      const missing = [...variables.values()]
        .filter((variable) => variable.collectionId === id && !listed.has(variable.id))
        .map((variable) => variable.id)
        .toSorted()
      if (missing.length > 0) collection.variableIds = [...collection.variableIds, ...missing]
    }
  }

  /** Applies a peer's records; one that is not well formed is left as this peer has it. */
  function receive<T extends object>(
    records: YRecords,
    target: Map<string, T>,
    isValid: (value: unknown) => value is T,
    events: Y.YEvent<Y.Map<unknown>>[]
  ): Set<string> {
    const ids = changedIds(records, events)
    for (const id of ids) {
      const value: unknown = records.get(id)?.toJSON()
      if (value === undefined) target.delete(id)
      else if (isValid(value)) applyRecord(target, id, value)
    }
    return ids
  }

  /** Takes the records a peer sent as what the room holds; others may hold unsent edits. */
  function markReceived<T>(sent: Map<string, T>, records: Map<string, T>, ids: Set<string>) {
    for (const id of ids) {
      const record = records.get(id)
      if (record) sent.set(id, structuredClone(record))
      else sent.delete(id)
    }
  }

  /**
   * Lays out what the received records reach. Only those records are taken as sent: an edit not
   * yet in the history, such as a running plugin script's, still goes out with the next change.
   */
  function settle(variableIds: Set<string>, collectionIds: Set<string>) {
    const { variables, variableCollections } = graph()
    markReceived(sentVariables, variables, variableIds)
    markReceived(sentCollections, variableCollections, collectionIds)
    const collections = new Set(collectionIds)
    for (const id of variableIds) {
      const collectionId = variables.get(id)?.collectionId
      if (collectionId) collections.add(collectionId)
    }
    // A list completed here differs from the room's, and goes out with the next change.
    keepCollectionsComplete(collections)
    const scope = new Set(variableIds)
    for (const id of collections) {
      for (const variableId of variableCollections.get(id)?.variableIds ?? []) scope.add(variableId)
    }
    store.refreshVariables({ variables: scope })
  }

  // This peer's own writes are already in its graph.
  function onVariables(events: Y.YEvent<Y.Map<unknown>>[], transaction: Y.Transaction) {
    if (transaction.local) return
    const ids = receive(yvariables, graph().variables, isVariable, events)
    if (ids.size > 0) settle(ids, new Set())
  }

  function onCollections(events: Y.YEvent<Y.Map<unknown>>[], transaction: Y.Transaction) {
    if (transaction.local) return
    const ids = receive(ycollections, graph().variableCollections, isCollection, events)
    if (ids.size > 0) settle(new Set(), ids)
  }

  yvariables.observeDeep(onVariables)
  ycollections.observeDeep(onCollections)
  const stopHistory = store.onEditorEvent('history:changed', send)

  return {
    share,
    dispose() {
      // An edit made just before leaving still reaches the room.
      send()
      stopHistory()
      yvariables.unobserveDeep(onVariables)
      ycollections.unobserveDeep(onCollections)
    }
  }
}
