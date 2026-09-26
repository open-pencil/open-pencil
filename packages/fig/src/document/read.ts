import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { parseFigBuffer } from '../archive'
import {
  createOccurrenceInterpreter,
  type InterpretInstanceOptions
} from '../instance-overrides/interpret'
import {
  bySavedPosition,
  createSourceIndex,
  type SourceIndex
} from '../instance-overrides/source-index'
import { symbolOverridesOf } from '../instance-overrides/types'
import { applyStyleRefsToFields } from '../node-change/style-refs'
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
  const liveSource = source.filter((node) => node.phase !== 'REMOVED')
  const changes = resolveDocumentBindingReferences(
    liveSource,
    (diagnostic) => bindingDiagnostics.push(diagnostic),
    ownership
  )
  // One index over these records serves inheritance, style lookup, the dependency closure
  // and component planning; each pass used to build its own over the same array.
  const index = createSourceIndex(changes)
  inheritComponentPropertyDefinitions(changes, index.sources)
  const styles = index.sources
  const assets = new Map<string, string>()
  for (const node of changes)
    if (node.guid && typeof node.key === 'string') {
      const id = guidToString(node.guid)
      assets.set(node.key, id)
      if (typeof node.version === 'string') assets.set(`${node.key}@${node.version}`, id)
    }
  const resolveStyles = (node: NodeChange): void => {
    applyStyleRefsToFields(styles, node, assets)
    for (const override of symbolOverridesOf(node)) resolveStyles(override as NodeChange)
  }
  for (const node of changes) resolveStyles(node)
  return createScopedReader(
    changes,
    bindingDiagnostics,
    pageIds,
    createSharedReaderState(changes, index)
  )
}

/**
 * Everything a scoped reader needs that does not depend on which pages are selected.
 * Selecting a page rebuilt both whole-document indexes, so loading N pages indexed the
 * archive 2N times; only the page's own subset actually varies.
 */
interface SharedReaderState {
  index: SourceIndex
  sourceInterpreter: ReturnType<typeof createOccurrenceInterpreter>
}

function createSharedReaderState(changes: readonly NodeChange[], index: SourceIndex) {
  let sourceInterpreter: SharedReaderState['sourceInterpreter'] | undefined
  return {
    index,
    get sourceInterpreter() {
      sourceInterpreter ??= createOccurrenceInterpreter(
        changes.filter((change) => change.type !== 'VARIABLE' && change.type !== 'VARIABLE_SET')
      )
      return sourceInterpreter
    }
  }
}

function createScopedReader(
  changes: NodeChange[],
  bindingDiagnostics: BindingReferenceDiagnostic[],
  pageIds?: ReadonlySet<string>,
  shared?: SharedReaderState
) {
  const resources = changes.filter(
    (change) => change.type === 'VARIABLE' || change.type === 'VARIABLE_SET'
  )
  const closure = collectSceneDependencies(changes, pageIds, shared?.index)
  // Deleted components are interpreted per instance; broken hierarchy is not recoverable.
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
  const sourceInterpreter = shared
    ? shared.sourceInterpreter
    : createOccurrenceInterpreter(
        changes.filter((change) => change.type !== 'VARIABLE' && change.type !== 'VARIABLE_SET')
      )
  const interpreter = createOccurrenceInterpreter(sceneChanges)
  const pages = changes
    .filter((change) => change.type === 'CANVAS')
    .toSorted(bySavedPosition)
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
      return createScopedReader(changes, bindingDiagnostics, ids, shared)
    },
    get sourceRecords() {
      return structuredClone(changes)
    },
    get documentRecord() {
      return structuredClone(changes.find((change) => change.type === 'DOCUMENT'))
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
      return planComponentConstruction(
        changes,
        roots,
        (id) => sourceInterpreter.component(id, options),
        shared?.index.sources
      )
    },
    readComponent: sourceInterpreter.component
  }
}
