import { uniq } from 'es-toolkit/array'
import { isEqual } from 'es-toolkit/predicate'

import {
  entryPathKey,
  type FigArchiveRecordInfo,
  type FigEntryListPatch,
  type FigRecordFieldPatch
} from '@open-pencil/fig'
import { derivedSymbolDataOf, symbolDataOf } from '@open-pencil/fig/instance-overrides'
import type { FigNodeChangeExportRuntime } from '@open-pencil/fig/node-change'
import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { prepareFigExport, type FigExportSetup } from '#core/io/formats/fig/export/setup'
import { cloneSceneGraphForFigExport } from '#core/kiwi/fig/parse/transfer'
import { archiveBaseline, type ArchiveBaseline } from '#core/kiwi/fig/session/archive/changes'

/** Writes the records of these layers, as the patch writes the document's. */
export type RecordWriter = (
  graph: SceneGraph,
  setup: FigExportSetup,
  records: ReadonlySet<string>
) => NodeChange[] | null

const VARIABLE_TYPES = new Set(['VARIABLE', 'VARIABLE_SET'])

/**
 * The document as the archive holds it, for the pages that have loaded: a copy with the layers
 * edits changed as they were, without the layers added since, and with the variables it opened
 * with. It shares the rest with the document, which it does not write to.
 */
function archivedGraph(source: SceneGraph, baseline: ArchiveBaseline): SceneGraph {
  const graph = cloneSceneGraphForFigExport(source)
  for (const id of baseline.created) graph.nodes.delete(id)
  for (const [id, node] of baseline.before) graph.nodes.set(id, structuredClone(node))
  graph.instanceIndex = new Map()
  for (const node of graph.nodes.values()) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    const instances = graph.instanceIndex.get(node.componentId) ?? new Set<string>()
    instances.add(node.id)
    graph.instanceIndex.set(node.componentId, instances)
  }
  graph.variables = new Map(
    [...baseline.variables].map(([id, variable]) => [id, structuredClone(variable)])
  )
  graph.variableCollections = new Map(structuredClone(baseline.collections.collections))
  graph.activeMode = new Map(baseline.collections.activeMode)
  // The document record compares with the settings the archive saved, as the layers do.
  graph.documentColorSpace = baseline.settings.colorSpace
  graph.enabledLibraries = new Map(structuredClone(baseline.settings.libraries))
  return graph
}

/** The records the archived document writes, by GUID, for the records of these layers. */
async function baselineRecords(
  source: SceneGraph,
  runtime: FigNodeChangeExportRuntime,
  info: FigArchiveRecordInfo,
  recordOwners: ReadonlyMap<string, string>,
  guids: ReadonlySet<string>,
  write: RecordWriter
): Promise<Map<string, NodeChange> | null> {
  const baseline = archiveBaseline(source)
  if (!baseline) return null
  const graph = archivedGraph(source, baseline)
  const setup = await prepareFigExport(graph, runtime, {
    nextLocalId: info.nextLocalId,
    blobs: Array.from({ length: info.blobCount }, () => new Uint8Array(0)),
    recordOwners,
    archiveRecordIds: info.recordIds
  })
  // A layer loaded after an edit has no state before it to compare with, so it is written whole.
  const ids = new Set(
    [...guids].flatMap((guid) => {
      const id = recordOwners.get(guid)
      return id && graph.nodes.has(id) && !baseline.loadedAfterEdits.has(id) ? [id] : []
    })
  )
  const records = write(graph, setup, ids)
  if (!records) return null
  return new Map(
    records.flatMap((record) => (record.guid ? [[guidToString(record.guid), record]] : []))
  )
}

interface PathEntry {
  guidPath?: { guids?: GUID[] }
}

/**
 * What changed between two lists of entries addressed by layer path, or undefined when nothing
 * did. A list naming one path twice cannot be matched entry by entry, which `null` reports.
 */
function entryListPatch(
  before: readonly PathEntry[],
  after: readonly PathEntry[]
): FigEntryListPatch | null | undefined {
  const saved = new Map(before.map((entry) => [entryPathKey(entry.guidPath?.guids), entry]))
  const current = new Map(after.map((entry) => [entryPathKey(entry.guidPath?.guids), entry]))
  if (saved.size !== before.length || current.size !== after.length) return null
  const entries: FigEntryListPatch['entries'] = []
  for (const [key, entry] of current) {
    const { guidPath, ...fields } = entry as PathEntry & Record<string, unknown>
    const previous = saved.get(key) as (PathEntry & Record<string, unknown>) | undefined
    const set = Object.fromEntries(
      Object.entries(fields).filter(([field, value]) => !isEqual(previous?.[field], value))
    )
    const unset = previous
      ? Object.keys(previous).filter((field) => field !== 'guidPath' && !(field in fields))
      : []
    if (Object.keys(set).length > 0 || unset.length > 0)
      entries.push({ path: guidPath?.guids ?? [], set, unset })
  }
  const removed = [...saved].flatMap(([key, entry]) =>
    current.has(key) ? [] : [entry.guidPath?.guids ?? []]
  )
  return entries.length > 0 || removed.length > 0 ? { entries, removed } : undefined
}

/**
 * Whether `field` is one of an instance's lists addressed by layer path, compared entry by
 * entry into `patch`. A list that cannot be, or overrides whose component changed, are not.
 */
function patchEntryList(
  field: string,
  saved: NodeChange,
  record: NodeChange,
  patch: FigRecordFieldPatch
): boolean {
  if (field === 'symbolData') {
    const before = symbolDataOf(saved)
    const after = symbolDataOf(record)
    if (!before || !after) return false
    const { symbolOverrides: savedOverrides = [], ...savedRest } = before
    const { symbolOverrides: overrides = [], ...rest } = after
    if (!isEqual(savedRest, rest)) return false
    const changed = entryListPatch(savedOverrides, overrides)
    if (changed === null) return false
    if (changed) patch.symbolOverrides = changed
    return true
  }
  if (field === 'derivedSymbolData' && saved.derivedSymbolData && record.derivedSymbolData) {
    const changed = entryListPatch(derivedSymbolDataOf(saved), derivedSymbolDataOf(record))
    if (changed === null) return false
    if (changed) patch.derivedSymbolData = changed
    return true
  }
  return false
}

/**
 * The fields of `record` that differ from the `saved` one, or null when none does. An
 * instance's overrides and derived values are compared entry by entry, so an edit to one layer
 * leaves the entries of the others as the archive saved them.
 */
function changedFields(saved: NodeChange, record: NodeChange): FigRecordFieldPatch | null {
  if (!record.guid) return null
  const set: Partial<NodeChange> = {}
  const unset: string[] = []
  const patch: FigRecordFieldPatch = { guid: record.guid, set, unset }
  for (const field of uniq([...Object.keys(saved), ...Object.keys(record)])) {
    if (!(field in record)) unset.push(field)
    else if (isEqual(saved[field], record[field])) continue
    else if (!patchEntryList(field, saved, record, patch))
      Object.assign(set, { [field]: record[field] })
  }
  const changed =
    Object.keys(set).length > 0 ||
    unset.length > 0 ||
    patch.symbolOverrides ||
    patch.derivedSymbolData
  return changed ? patch : null
}

/**
 * Narrow written records the archive holds to the fields the edits changed in them. Each is
 * compared with the record the document as the archive holds it writes, so a field differs only
 * where the document does, and the rest of the record, fields OpenPencil does not model among
 * them, stays as the archive saved it. A record whose untouched copy is unavailable is written
 * whole, as before.
 */
export async function narrowToChangedFields(
  source: SceneGraph,
  runtime: FigNodeChangeExportRuntime,
  info: FigArchiveRecordInfo,
  recordOwners: ReadonlyMap<string, string>,
  written: readonly NodeChange[],
  write: RecordWriter
): Promise<{ records: NodeChange[]; fields: FigRecordFieldPatch[] }> {
  const archived = new Set(info.recordIds)
  const guids = new Set(
    written.flatMap((record) => {
      const id = record.guid ? guidToString(record.guid) : null
      return id && archived.has(id) ? [id] : []
    })
  )
  const baseline =
    guids.size > 0 ? await baselineRecords(source, runtime, info, recordOwners, guids, write) : null
  const records: NodeChange[] = []
  const fields: FigRecordFieldPatch[] = []
  for (const record of written) {
    const id = record.guid ? guidToString(record.guid) : null
    const saved = id ? baseline?.get(id) : undefined
    if (!saved || !record.guid) {
      records.push(record)
      continue
    }
    const changed = changedFields(saved, record)
    if (changed) fields.push(changed)
    // A variable the patch leaves out is dropped when variables are replaced, so it stays listed.
    else if (record.type && VARIABLE_TYPES.has(record.type))
      fields.push({ guid: record.guid, set: {}, unset: [] })
  }
  return { records, fields }
}
