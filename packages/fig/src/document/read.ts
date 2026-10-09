import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { deduplicateNodeChangePluginData } from '@open-pencil/kiwi/fig/parse'
import { decodeWhole } from '@open-pencil/kiwi/schema-runtime'

import { parseFigBuffer } from '../archive'
import { createIndexedOccurrenceInterpreter } from '../instance-overrides/interpret'
import type { InterpretInstanceOptions } from '../instance-overrides/occurrence/types'
import {
  bySavedPosition,
  createSourceIndex,
  parentIdOf,
  type SourceIndex
} from '../instance-overrides/source-index'
import { symbolOverridesOf } from '../instance-overrides/types'
import { applyStyleRefsToFields } from '../node-change/style/refs'
import {
  createBindingNormalizer,
  resolveDocumentBindingReferences,
  type BindingReferenceDiagnostic
} from './bindings/references'
import { planComponentConstruction } from './components'
import { DecodedMap } from './decoded-map'
import { collectSceneDependencies } from './dependency-closure'
import { inheritComponentPropertyDefinitions, inheritFromAncestors } from './property-inheritance'

/** Indexed source document. Resources remain separate from scene occurrences. */
export function createDocumentReader(source: readonly NodeChange[], pageIds?: ReadonlySet<string>) {
  return createScopedReader(wholeRecords(source), pageIds)
}

/**
 * The fields a record keeps when an archive is read: what indexing, the dependency closure's
 * walk, page listing, and resource lookup read. Every other field stays in the archive's bytes
 * until something needs the whole record, which most records of a design kit never are.
 */
export const RECORD_HEADER_FIELDS = [
  'guid',
  'parentIndex',
  'type',
  'phase',
  'name',
  'internalOnly',
  'key',
  'version',
  'styleType',
  'overrideKey'
] as const

/** Parse into exclusively owned records; callers never receive the mutable source index. */
export function createArchiveDocumentReader(bytes: ArrayBuffer, pageIds?: ReadonlySet<string>) {
  const parsed = parseFigBuffer(bytes, undefined, { NodeChange: RECORD_HEADER_FIELDS })
  return {
    figKiwiVersion: parsed.figKiwiVersion,
    figSchemaDeflated: parsed.figSchemaDeflated,
    reader: createScopedReader(archiveRecords(parsed.nodeChanges), pageIds),
    blobs: parsed.blobs,
    images: parsed.images,
    /** The archive's record headers, which carry the identities patching numbers from. */
    records: parsed.nodeChanges
  }
}

/** Whole records, prepared, by the record or header that stands for them. */
type WholeRecord = (record: NodeChange) => NodeChange

/**
 * What a reader reads records through: every live record, whole or as a header, one index
 * over them, and the whole records behind them, prepared as a document read whole prepares
 * every record.
 */
interface ReaderRecords {
  records: readonly NodeChange[]
  /** Serves the dependency closure, component planning, and pages. */
  index: SourceIndex
  bindingDiagnostics: BindingReferenceDiagnostic[]
  /** Whole records for one read of pages, each decoded at most once while it is held. */
  scope(): WholeRecord
  /** Whole records kept for the document: components the interpreter reads, and styles. */
  shared: WholeRecord
  /** Indexes whole records, for the interpreter that reads components on demand. */
  interpreterIndex(): SourceIndex
}

function assetIds(records: readonly NodeChange[]): Map<string, string> {
  const assets = new Map<string, string>()
  for (const node of records)
    if (node.guid && typeof node.key === 'string') {
      const id = guidToString(node.guid)
      assets.set(node.key, id)
      if (typeof node.version === 'string') assets.set(`${node.key}@${node.version}`, id)
    }
  return assets
}

function isResource(record: NodeChange): boolean {
  return record.type === 'VARIABLE' || record.type === 'VARIABLE_SET'
}

/** Records decoded whole up front, as clipboard fragments and in-memory documents are. */
function wholeRecords(source: readonly NodeChange[]): ReaderRecords {
  const bindingDiagnostics: BindingReferenceDiagnostic[] = []
  const records = resolveDocumentBindingReferences(
    source.filter((node) => node.phase !== 'REMOVED'),
    (diagnostic) => bindingDiagnostics.push(diagnostic)
  )
  const index = createSourceIndex(records)
  inheritComponentPropertyDefinitions(records, index.sources)
  const assets = assetIds(records)
  const resolveStyles = (node: NodeChange): void => {
    applyStyleRefsToFields(index.sources, node, assets)
    for (const override of symbolOverridesOf(node)) resolveStyles(override as NodeChange)
  }
  for (const node of records) resolveStyles(node)
  const same: WholeRecord = (record) => record
  return {
    records,
    index,
    bindingDiagnostics,
    scope: () => same,
    shared: same,
    interpreterIndex: () => createSourceIndex(records.filter((record) => !isResource(record)))
  }
}

/**
 * A header's whole record, read again from the archive bytes, its plugin data deduplicated. A
 * header that lost those bytes, as a copy does, holds only its header fields, so it fails here
 * rather than read as a record without its contents.
 */
function decodeRecord(header: NodeChange): NodeChange {
  const record = decodeWhole(header) as NodeChange | undefined
  if (!record) throw new Error('Record header has no archive bytes to read it whole')
  deduplicateNodeChangePluginData([record])
  return record
}

/**
 * Records kept as headers, each decoded whole when a read needs it. Opening checks every
 * record's bindings, as a document read whole does, and keeps none of what it decodes; a whole
 * record is then prepared as that read prepares it: bindings resolved, property definitions
 * inherited from its ancestors, and style references applied.
 */
function archiveRecords(headers: readonly NodeChange[]): ReaderRecords {
  const records = headers.filter((node) => node.phase !== 'REMOVED')
  const index = createSourceIndex(records)
  const normalize = createBindingNormalizer(records)
  const assets = assetIds(records)
  const bindingDiagnostics: BindingReferenceDiagnostic[] = []
  for (const header of records)
    normalize(decodeRecord(header), (diagnostic) => bindingDiagnostics.push(diagnostic))

  const kept = new Map<NodeChange, NodeChange>()
  /** Styles resolve against style records kept whole; other records only need their header. */
  const styles = new DecodedMap(index.sources, (header) =>
    header.styleType ? shared(header) : header
  )
  /** Records whose preparation is running: preparing an ancestor reaches them only in a cycle. */
  const preparing = new Set<NodeChange>()
  const prepare = (header: NodeChange, whole: WholeRecord): NodeChange => {
    if (preparing.has(header)) throw new Error('Cyclic component-property ancestry')
    preparing.add(header)
    try {
      const record = decodeRecord(header)
      normalize(record)
      const ancestors: NodeChange[] = []
      for (
        let parent = index.sources.get(parentIdOf(header) ?? '');
        parent;
        parent = index.sources.get(parentIdOf(parent) ?? '')
      )
        ancestors.push(whole(parent))
      inheritFromAncestors(record, ancestors)
      const resolveStyles = (node: NodeChange): void => {
        applyStyleRefsToFields(styles, node, assets)
        for (const override of symbolOverridesOf(node)) resolveStyles(override as NodeChange)
      }
      resolveStyles(record)
      return record
    } finally {
      preparing.delete(header)
    }
  }
  const shared: WholeRecord = (header) => {
    let record = kept.get(header)
    if (!record) {
      record = prepare(header, shared)
      kept.set(header, record)
    }
    return record
  }
  const interpreterIndex = (): SourceIndex => {
    const { sources, children } = createSourceIndex(records.filter((record) => !isResource(record)))
    const lists = new WeakMap<readonly NodeChange[], NodeChange[]>()
    return {
      sources: new DecodedMap(sources, shared),
      children: new DecodedMap(children, (list) => {
        let whole = lists.get(list)
        if (!whole) {
          whole = list.map(shared)
          lists.set(list, whole)
        }
        return whole
      })
    }
  }
  return {
    records,
    index,
    bindingDiagnostics,
    scope: () => {
      const decoded = new Map<NodeChange, NodeChange>()
      const whole: WholeRecord = (header) => {
        const record = kept.get(header) ?? decoded.get(header)
        if (record) return record
        const prepared = prepare(header, whole)
        decoded.set(header, prepared)
        return prepared
      }
      return whole
    },
    shared,
    interpreterIndex
  }
}

/**
 * Everything a scoped reader needs that does not depend on which pages are selected. Only
 * the page's own subset varies, so the whole-document work happens once per document.
 */
interface SharedReaderState {
  records: ReaderRecords
  sourceInterpreter: ReturnType<typeof createIndexedOccurrenceInterpreter>
}

function createSharedReaderState(records: ReaderRecords): SharedReaderState {
  let sourceInterpreter: SharedReaderState['sourceInterpreter'] | undefined
  return {
    records,
    get sourceInterpreter() {
      sourceInterpreter ??= createIndexedOccurrenceInterpreter(records.interpreterIndex())
      return sourceInterpreter
    }
  }
}

function createScopedReader(
  source: ReaderRecords | SharedReaderState,
  pageIds: ReadonlySet<string> | undefined
) {
  const shared = 'sourceInterpreter' in source ? source : createSharedReaderState(source)
  const { records, index, bindingDiagnostics } = shared.records
  const changes = records
  const whole = shared.records.scope()
  const resources = changes.filter(isResource)
  const closure = collectSceneDependencies(changes, pageIds, index, whole)
  // Deleted components are interpreted per instance; broken hierarchy is not recoverable.
  if (closure.missingIds.size)
    throw new Error(`Missing reachable sources: ${[...closure.missingIds].join(', ')}`)
  const sceneChanges = changes
    .filter(
      (change) =>
        !isResource(change) &&
        (change.type === 'CANVAS' ||
          (change.guid &&
            (closure.contentIds.has(guidToString(change.guid)) ||
              closure.ancestorIds.has(guidToString(change.guid)))))
    )
    .map(whole)
  const sourceInterpreter = shared.sourceInterpreter
  const interpreter = createIndexedOccurrenceInterpreter(createSourceIndex(sceneChanges))
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
      return createScopedReader(shared, ids)
    },
    get sourceRecords() {
      return structuredClone(changes.map(whole))
    },
    get documentRecord() {
      const document = changes.find((change) => change.type === 'DOCUMENT')
      return structuredClone(document && whole(document))
    },
    dependencyClosure: closure,
    pages,
    get resources() {
      return structuredClone(resources.map(whole))
    },
    bindingDiagnostics,
    readPage(id: string, options: InterpretInstanceOptions = {}) {
      if (!knownPageIds.has(id)) throw new Error(`Unknown page ${id}`)
      const page = interpreter.page(id, options)
      // A slot content frame is read through the instance assigning it, never as a layer.
      page.children = page.children.filter((child) => child.properties.isSlotContent !== true)
      return page
    },
    planComponents(
      roots: readonly ReturnType<typeof interpreter.page>[],
      options: InterpretInstanceOptions = {}
    ) {
      return planComponentConstruction(
        roots,
        (id) => sourceInterpreter.component(id, options),
        index.sources
      )
    },
    readComponent: sourceInterpreter.component
  }
}
