import { variableConsumptionEntries } from '#fig/node-change/variable/bindings'
import { visitVariableReferences } from '#fig/node-change/variable/expression'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { idOf, type InterpreterIndex } from '../source-index'
import { symbolDataOf, symbolOverridesOf } from '../types'

type Collections = ReadonlySet<string>

const NO_COLLECTIONS: Collections = new Set()
const collectionsByRecord = new WeakMap<NodeChange, Collections>()

function variablesBoundBy(holder: NodeChange, found: Set<string>): void {
  for (const entry of variableConsumptionEntries(holder)) {
    visitVariableReferences(entry.variableData, (reference) => {
      if (reference.guid) {
        found.add(guidToString(reference.guid))
      }
    })
  }
  for (const range of holder.textData?.styleOverrideTable ?? []) {
    variablesBoundBy(range, found)
  }
  for (const override of symbolOverridesOf(holder)) {
    variablesBoundBy(override, found)
  }
}

function componentsUsedBy(record: NodeChange): GUID[] {
  const saved = symbolDataOf(record)?.symbolID
  const swapped = symbolOverridesOf(record).flatMap(({ overriddenSymbolID }) =>
    overriddenSymbolID ? [overriddenSymbolID] : []
  )
  return saved ? [saved, ...swapped] : swapped
}

export function createBoundCollections({ sources, children, variables }: InterpreterIndex) {
  const collectionsUnder = (record: NodeChange): Collections => {
    const known = collectionsByRecord.get(record)
    if (known) {
      return known
    }
    collectionsByRecord.set(record, NO_COLLECTIONS)
    const bound = new Set<string>()
    variablesBoundBy(record, bound)
    const collections = new Set<string>()
    for (const variable of bound) {
      for (const collection of variables.collectionsReachedFrom(variable)) {
        collections.add(collection)
      }
    }
    const include = (layer: NodeChange | undefined): void => {
      for (const collection of layer ? collectionsUnder(layer) : NO_COLLECTIONS) {
        collections.add(collection)
      }
    }
    const id = idOf(record)
    const layers = id ? children.get(id) : undefined
    for (const layer of layers ?? []) {
      include(layer)
    }
    for (const component of componentsUsedBy(record)) {
      include(sources.get(guidToString(component)))
    }
    const result = collections.size ? collections : NO_COLLECTIONS
    collectionsByRecord.set(record, result)
    return result
  }
  return collectionsUnder
}
