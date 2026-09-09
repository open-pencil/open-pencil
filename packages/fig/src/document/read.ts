import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { parseFigBuffer } from '../archive'
import {
  createOccurrenceInterpreter,
  type InterpretInstanceOptions
} from '../instance-overrides/interpret'
import {
  resolveDocumentBindingReferences,
  type BindingReferenceDiagnostic
} from './binding-references'
import { planComponentConstruction } from './components'
import { collectSceneDependencies } from './dependency-closure'
import { inheritComponentPropertyDefinitions } from './property-inheritance'

/** Indexed source document. Resources remain separate from scene occurrences. */
export function createDocumentReader(source: readonly NodeChange[], pageIds?: ReadonlySet<string>) {
  return createReader(source, 'copy', pageIds)
}

/** Parse into exclusively owned records; callers never receive the mutable source index. */
export function createArchiveDocumentReader(bytes: ArrayBuffer, pageIds?: ReadonlySet<string>) {
  const parsed = parseFigBuffer(bytes)
  return {
    figKiwiVersion: parsed.figKiwiVersion,
    figSchemaDeflated: parsed.figSchemaDeflated,
    reader: createReader(parsed.nodeChanges, 'transfer', pageIds),
    blobs: parsed.blobs,
    images: parsed.images
  }
}

function createReader(
  source: readonly NodeChange[],
  ownership: 'copy' | 'transfer',
  pageIds?: ReadonlySet<string>
) {
  const bindingDiagnostics: BindingReferenceDiagnostic[] = []
  const changes = resolveDocumentBindingReferences(
    source,
    (diagnostic) => bindingDiagnostics.push(diagnostic),
    ownership
  )
  inheritComponentPropertyDefinitions(changes)
  return createScopedReader(changes, bindingDiagnostics, pageIds)
}

function createScopedReader(
  changes: NodeChange[],
  bindingDiagnostics: BindingReferenceDiagnostic[],
  pageIds?: ReadonlySet<string>
) {
  const resources = changes.filter(
    (change) => change.type === 'VARIABLE' || change.type === 'VARIABLE_SET'
  )
  const closure = collectSceneDependencies(changes, pageIds)
  if (closure.missingIds.size)
    throw new Error(`Missing reachable sources: ${[...closure.missingIds].join(', ')}`)
  const sceneChanges = changes.filter(
    (change) =>
      change.type !== 'VARIABLE' &&
      change.type !== 'VARIABLE_SET' &&
      (change.type === 'CANVAS' ||
        (change.guid &&
          (closure.contentIds.has(guidToString(change.guid)) ||
            closure.ancestorIds.has(guidToString(change.guid)))))
  )
  const sourceInterpreter = createOccurrenceInterpreter(
    changes.filter((change) => change.type !== 'VARIABLE' && change.type !== 'VARIABLE_SET')
  )
  const interpreter = createOccurrenceInterpreter(sceneChanges)
  const pages = changes
    .filter((change) => change.type === 'CANVAS')
    .toSorted((a, b) => {
      const left = a.parentIndex?.position ?? ''
      const right = b.parentIndex?.position ?? ''
      if (left === right) return 0
      return left < right ? -1 : 1
    })
    .map((page) => {
      if (!page.guid) throw new Error('Page has no GUID')
      return {
        id: guidToString(page.guid),
        name: page.name ?? '',
        position: page.parentIndex?.position ?? null,
        internalOnly: page.internalOnly === true
      }
    })
  const knownPageIds = new Set(pages.map((page) => page.id))
  return {
    selectPages(ids: ReadonlySet<string>) {
      return createScopedReader(changes, bindingDiagnostics, ids)
    },
    get sourceRecords() {
      return structuredClone(changes)
    },
    dependencyClosure: closure,
    pages,
    get resources() {
      return structuredClone(resources)
    },
    bindingDiagnostics,
    readPage(id: string, options: InterpretInstanceOptions = {}) {
      if (!knownPageIds.has(id)) throw new Error(`Unknown page ${id}`)
      return interpreter.page(id, options)
    },
    planComponents(
      roots: readonly ReturnType<typeof interpreter.page>[],
      options: InterpretInstanceOptions = {}
    ) {
      return planComponentConstruction(changes, roots, (id) =>
        sourceInterpreter.component(id, options)
      )
    },
    readComponent: sourceInterpreter.component
  }
}
