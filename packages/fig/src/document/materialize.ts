import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import type { InstanceOccurrence, InterpretInstanceOptions } from '../instance-overrides/interpret'
import { reconcileLiveComponentEdits } from '../instance-overrides/live-component-edits'
import { materializeInstance } from '../instance-overrides/materialize-instance'
import {
  linkInstanceSourceChildren,
  mapInstanceSourceChildren,
  type MaterializedComponentOccurrence
} from '../instance-overrides/source-children'
import { nodeChangeToProps } from '../node-change'
import type { BindingReferenceDiagnostic } from './binding-references'
import {
  checkpointComponent,
  restoreComponentCheckpoint,
  type ComponentCheckpoint
} from './component/checkpoint'
import { assertComponentStructureCurrent } from './component/structure'
import { linkComponentPropertyValues } from './component/values'
import { applyDocumentLayoutBindings } from './layout-bindings'
import { loadPageTransaction } from './load-transaction'
import { createArchiveDocumentReader, createDocumentReader } from './read'
import { materializeVariableResources } from './variables'

export interface DocumentAssemblyOptions extends InterpretInstanceOptions {
  /** Restrict scene population to these source pages plus required component ownership. */
  pageIds?: ReadonlySet<string>
  images?: ReadonlyMap<string, Uint8Array>
  /** Explicit acknowledgement until variable-resource conversion is implemented. */
  onUnsupportedResource?: (resource: NodeChange) => void
  onUnresolvedBinding?: (diagnostic: BindingReferenceDiagnostic) => void
}

/** Full-page graph assembly. Styles, variables and lazy loading are not integrated yet. */
export function materializeDocument(
  changes: readonly NodeChange[],
  blobs: Uint8Array[] = [],
  options: DocumentAssemblyOptions = {}
) {
  return materializeReader(createDocumentReader(changes, options.pageIds), blobs, options)
}

/** Own parsed archive records; do not create a second full source tree. */
export function materializeFigArchive(bytes: ArrayBuffer, options: DocumentAssemblyOptions = {}) {
  const { reader, blobs, images } = createArchiveDocumentReader(bytes, options.pageIds)
  return materializeReader(reader, blobs, { ...options, images: options.images ?? new Map(images) })
}

export interface AssemblyState {
  graph: SceneGraph
  sources: Map<string, string>
  components: Map<string, MaterializedComponentOccurrence>
  componentIds: Map<string, string>
  savedSizeNodes: Set<string>
}

export interface FigSessionCheckpoint {
  sources: Array<[string, string]>
  componentIds: Array<[string, string]>
  savedSizeNodeIds: string[]
  loadedPageIds: string[]
  components: Array<[string, ComponentCheckpoint]>
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
    components,
    sources: new Map(checkpoint.sources),
    componentIds: new Map(checkpoint.componentIds),
    savedSizeNodes: new Set(checkpoint.savedSizeNodeIds)
  }
}

export function createFigDocumentSession(
  bytes: ArrayBuffer,
  options: DocumentAssemblyOptions = {},
  resume?: FigSessionResume
) {
  const archive = createArchiveDocumentReader(bytes, new Set())
  const sessionOptions = { ...options, images: options.images ?? new Map(archive.images) }
  const state = resume
    ? restoreAssemblyState(resume, archive.reader, sessionOptions)
    : materializeReader(archive.reader, archive.blobs, sessionOptions)
  state.graph.figKiwiVersion = archive.figKiwiVersion
  state.graph.figSchemaDeflated = archive.figSchemaDeflated
  const loaded = new Set<string>(resume?.checkpoint.loadedPageIds)
  return {
    checkpoint(): FigSessionCheckpoint {
      return structuredClone({
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
    loadPage(id: string): void {
      if (loaded.has(id)) return
      assertComponentStructureCurrent(state.graph, state.components)
      const reader = archive.reader.selectPages(new Set([id]))
      loadPageTransaction(state, reader.dependencyClosure, () => {
        materializeReader(reader, archive.blobs, sessionOptions, state)
        loaded.add(id)
      })
    },
    get loadedPageIds(): ReadonlySet<string> {
      return new Set(loaded)
    }
  }
}

function createAssemblyState(
  reader: ReturnType<typeof createDocumentReader>,
  options: DocumentAssemblyOptions
): AssemblyState {
  const graph = new SceneGraph()
  for (const [hash, bytes] of options.images ?? []) graph.images.set(hash, bytes.slice())
  materializeVariableResources(graph, reader.resources, options.onUnsupportedResource)
  for (const page of graph.getPages()) graph.deleteNode(page.id)
  return {
    graph,
    sources: new Map(),
    components: new Map(),
    componentIds: new Map(),
    savedSizeNodes: new Set()
  }
}

function materializeReader(
  reader: ReturnType<typeof createDocumentReader>,
  blobs: Uint8Array[],
  options: DocumentAssemblyOptions,
  previous?: AssemblyState
) {
  for (const diagnostic of reader.bindingDiagnostics) {
    if (!options.onUnresolvedBinding)
      throw new Error(`Unresolved binding ${diagnostic.sourceId}: ${diagnostic.field}`)
    options.onUnresolvedBinding(diagnostic)
  }
  const pages = reader.pages.map((page) => reader.readPage(page.id, options))
  const plan = reader.planComponents(pages, options)
  const { graph, sources, components, savedSizeNodes, componentIds } =
    previous ?? createAssemblyState(reader, options)
  const existingNodeIds = new Set(graph.nodes.keys())
  const rememberDerivedSizes = (nodes: ReadonlyMap<InstanceOccurrence, SceneNode>): void => {
    for (const [occurrence, node] of nodes) if (occurrence.derivedSize) savedSizeNodes.add(node.id)
  }
  const createShells = (occurrence: InstanceOccurrence, parentId: string): void => {
    if (occurrence.mainComponentId !== null) return
    const existingId = sources.get(occurrence.sourceId)
    if (existingId) {
      for (const child of occurrence.children) createShells(child, existingId)
      return
    }
    const { nodeType, ...props } = nodeChangeToProps(occurrence.properties, blobs)
    if (nodeType === 'DOCUMENT' || nodeType === 'VARIABLE')
      throw new Error(`Unsupported scene type ${nodeType}`)
    const node = graph.createNode(nodeType, parentId, props)
    sources.set(occurrence.sourceId, node.id)
    if (node.type === 'COMPONENT') componentIds.set(occurrence.sourceId, node.id)
    for (const child of occurrence.children) createShells(child, node.id)
  }
  for (const page of pages) createShells(page, graph.rootId)
  for (const item of plan) {
    if (components.has(item.sourceId)) continue
    const parentId = sources.get(item.parentSourceId)
    if (!parentId) throw new Error(`Unmaterialized component parent ${item.parentSourceId}`)
    const existingNodes = new Map<InstanceOccurrence, SceneNode>()
    const collectExisting = (node: InstanceOccurrence): void => {
      const id = sources.get(node.sourceId)
      const existing = id ? graph.getNode(id) : undefined
      if (existing) existingNodes.set(node, existing)
      if (node.mainComponentId === null) node.children.forEach(collectExisting)
    }
    collectExisting(item.occurrence)
    const materialized = materializeInstance(
      graph,
      parentId,
      item.occurrence,
      componentIds,
      blobs,
      mapInstanceSourceChildren(item.occurrence, components),
      existingNodes
    )
    rememberDerivedSizes(materialized.nodes)
    linkInstanceSourceChildren(item.occurrence, materialized, components)
    components.set(item.sourceId, { occurrence: item.occurrence, materialized })
    componentIds.set(item.sourceId, materialized.root.id)
    sources.set(item.sourceId, materialized.root.id)
  }
  const populateInstances = (occurrence: InstanceOccurrence): void => {
    if (occurrence.properties.type === 'SYMBOL') return
    const parentId = sources.get(occurrence.sourceId)
    if (!parentId) throw new Error(`Missing source container ${occurrence.sourceId}`)
    const ordered: string[] = []
    for (const child of occurrence.children) {
      if (child.mainComponentId !== null && !sources.has(child.sourceId)) {
        const materialized = materializeInstance(
          graph,
          parentId,
          child,
          componentIds,
          blobs,
          mapInstanceSourceChildren(child, components)
        )
        rememberDerivedSizes(materialized.nodes)
        linkInstanceSourceChildren(child, materialized, components)
        if (previous) reconcileLiveComponentEdits(graph, materialized)
        sources.set(child.sourceId, materialized.root.id)
      } else if (child.mainComponentId === null && child.properties.type !== 'SYMBOL')
        populateInstances(child)
      const id = sources.get(child.sourceId)
      if (!id) throw new Error(`Missing assembled child ${child.sourceId}`)
      ordered.push(id)
    }
    const parent = graph.getNode(parentId)
    if (parent)
      parent.childIds = [...ordered, ...parent.childIds.filter((id) => !ordered.includes(id))]
  }
  for (const page of pages) populateInstances(page)
  linkComponentPropertyValues(graph, sources, existingNodeIds)
  graph.preserveSourceMetadataDuring(() =>
    applyDocumentLayoutBindings(graph, savedSizeNodes, existingNodeIds)
  )
  return { graph, sources, components, componentIds, savedSizeNodes }
}
