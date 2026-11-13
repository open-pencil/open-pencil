import type { SceneGraph } from '@open-pencil/scene-graph'

import type { MaterializedComponentOccurrence } from '../instance-overrides/source-children'
import { figArchiveRecordInfo, type FigArchiveRecordInfo } from '../record-patch'
import {
  checkpointComponent,
  restoreComponentCheckpoint,
  type ComponentCheckpoint
} from './component/checkpoint'
import { loadPageTransaction } from './load-transaction'
import {
  materializeReader,
  withArchiveImages,
  type AssemblyState,
  type DocumentAssemblyOptions
} from './materialize'
import { createArchiveDocumentReader, type createDocumentReader } from './read'

export interface FigSessionCheckpoint {
  /** Continuation of the import's counter ids, including ids consumed then deleted. */
  nextImportedId?: number
  sources: Array<[string, string]>
  componentIds: Array<[string, string]>
  savedSizeNodeIds: string[]
  loadedPageIds: string[]
  components: Array<[string, ComponentCheckpoint]>
}

/**
 * The layer each archive record became, by record GUID: layers, pages, instances, and the
 * layers inside components down to the instances they nest, whose contents are no records.
 */
export function figCheckpointRecords(checkpoint: FigSessionCheckpoint): Map<string, string> {
  const records = new Map(checkpoint.sources)
  for (const [componentId, component] of checkpoint.components) {
    records.set(componentId, component.rootId)
    const instances: string[][] = []
    for (const entry of component.nodes) {
      const sourceId = entry.path.at(-1)
      if (!sourceId) continue
      const inInstance = instances.some(
        (prefix) =>
          prefix.length < entry.path.length && prefix.every((id, index) => entry.path[index] === id)
      )
      if (inInstance) continue
      records.set(sourceId, entry.nodeId)
      if (entry.mainComponentId !== null) instances.push(entry.path)
    }
  }
  return records
}

export interface FigSessionResume {
  graph: SceneGraph
  checkpoint: FigSessionCheckpoint
}

function restoreAssemblyState(
  resume: FigSessionResume,
  reader: ReturnType<typeof createDocumentReader>,
  options: DocumentAssemblyOptions
): AssemblyState {
  const { graph, checkpoint } = resume
  const components = new Map<string, MaterializedComponentOccurrence>()
  for (const [id, entry] of checkpoint.components) {
    components.set(id, restoreComponentCheckpoint(graph, reader.readComponent(id, options), entry))
  }
  return {
    graph,
    nextImportedId: checkpoint.nextImportedId ?? inferNextImportedId(graph),
    recordIds: reader.recordIds,
    components,
    sources: new Map(checkpoint.sources),
    componentIds: new Map(checkpoint.componentIds),
    savedSizeNodes: new Set(checkpoint.savedSizeNodeIds),
    propertyCopies: (sourceId) => reader.propertyCopies(sourceId)
  }
}

export function createFigDocumentSession(
  bytes: ArrayBuffer,
  options: DocumentAssemblyOptions = {},
  resume?: FigSessionResume
) {
  const archive = createArchiveDocumentReader(bytes, new Set())
  const sessionOptions = withArchiveImages(options, archive.images)
  const state: AssemblyState = resume
    ? restoreAssemblyState(resume, archive.reader, sessionOptions)
    : materializeReader(archive.reader, archive.blobs, sessionOptions)
  state.graph.figKiwiVersion = archive.figKiwiVersion
  // A resumed session runs on the open graph, whose kind may have changed since it was read.
  if (!resume) state.graph.documentKind = archive.kind
  state.graph.figSchemaDeflated = archive.figSchemaDeflated
  const loaded = new Set<string>(resume?.checkpoint.loadedPageIds)
  const edits = watchGraphEdits(state.graph, resume !== undefined)
  let recordInfo: FigArchiveRecordInfo | undefined
  return {
    checkpoint(): FigSessionCheckpoint {
      return structuredClone({
        nextImportedId: state.nextImportedId,
        sources: [...state.sources],
        componentIds: [...state.componentIds],
        savedSizeNodeIds: [...state.savedSizeNodes],
        loadedPageIds: [...loaded],
        components: [...state.components].map(([id, component]) => [
          id,
          checkpointComponent(component)
        ])
      } satisfies FigSessionCheckpoint)
    },
    graph: state.graph,
    graphPageId(sourcePageId: string): string | undefined {
      return archive.reader.pages.some((page) => page.id === sourcePageId)
        ? state.sources.get(sourcePageId)
        : undefined
    },
    pages: archive.reader.pages,
    /** Where a patch of this archive starts its new GUIDs and blob indices. */
    archiveRecordInfo(): FigArchiveRecordInfo {
      recordInfo ??= figArchiveRecordInfo({
        records: archive.records,
        blobCount: archive.blobs.length,
        imageHashes: archive.images.map(([hash]) => hash)
      })
      return recordInfo
    },
    /** `onProgress` is called as the load advances, so a caller can tell a slow load from a stuck one. */
    loadPage(id: string, onProgress?: () => void): void {
      if (loaded.has(id)) return
      const reader = archive.reader.selectPages(new Set([id]))
      loadPageTransaction(state, reader.dependencyClosure, () => {
        materializeReader(reader, archive.blobs, sessionOptions, state, {
          edited: edits.edited,
          onProgress
        })
        loaded.add(id)
      })
    },
    get loadedPageIds(): ReadonlySet<string> {
      return new Set(loaded)
    }
  }
}

/**
 * Whether the graph may hold edits made since the file loaded, which a page load has to
 * reconcile its new instances with. A resumed session's graph may; a fresh one's does once a
 * layer changes outside page loads and derived layout, the edits the archive tracker counts.
 */
function watchGraphEdits(graph: SceneGraph, resumed: boolean): { readonly edited: boolean } {
  let edited = resumed
  if (edited) return { edited }
  const isEdit = () => !graph.isApplyingImportedState && !graph.isApplyingDerivedLayout
  const markEdited = () => {
    if (!isEdit()) return
    edited = true
    stop()
  }
  const stop = graph.observeNodeChanges({ before: markEdited, created: markEdited })
  return {
    get edited() {
      return edited
    }
  }
}

/** Compatibility with checkpoints saved before they carried the import counter. */
function inferNextImportedId(graph: SceneGraph): number {
  let next = 3
  const ids = [
    ...graph.nodes.keys(),
    ...graph.variables.keys(),
    ...graph.variableCollections.keys(),
    ...[...graph.variableCollections.values()].flatMap((collection) =>
      collection.modes.map((mode) => mode.modeId)
    )
  ]
  for (const id of ids) {
    if (!/^0:\d+$/.test(id)) continue
    next = Math.max(next, Number(id.slice(2)) + 1)
  }
  return next
}
