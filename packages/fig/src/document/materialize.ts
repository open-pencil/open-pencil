import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { generateId, SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { OPEN_PENCIL_PLUGIN_DATA } from '@open-pencil/scene-graph/plugin-data'
import { remapStyleRunReferences } from '@open-pencil/scene-graph/text'

import {
  reconcileLiveComponentEdits,
  syncSourceLayers
} from '../instance-overrides/live-component-edits'
import { materializeInstance } from '../instance-overrides/materialize-instance'
import type {
  InstanceOccurrence,
  InterpretInstanceOptions
} from '../instance-overrides/occurrence/types'
import {
  reconcileOccurrenceStructure,
  linkInstanceSourceChildren,
  mapMaterializedComponentNodes,
  mapInstanceSourceChildren,
  type MaterializedComponentOccurrence
} from '../instance-overrides/source-children'
import { nodeChangeToProps } from '../node-change'
import { generatedFrameCodec } from '../node-change/generated/codecs'
import { readNodeChangePluginData } from '../node-change/plugin-data'
import { applyDocumentEffectBindings } from './bindings/effects'
import { applyDocumentLayoutBindings } from './bindings/layout'
import { applyDocumentPaintBindings } from './bindings/paint'
import type { BindingReferenceDiagnostic } from './bindings/references'
import { applyDocumentValueBindings } from './bindings/values'
import { foldVariantPropertyCopies, type PropertyCopies } from './component/links'
import { linkComponentPropertyValues, resolveVariantPropertyValues } from './component/values'
import type { ComponentConstruction } from './components'
import { applyDocumentMetadata } from './metadata'
import { createArchiveDocumentReader, createDocumentReader } from './read'
import { mergeSavedOrder } from './saved-order'
import {
  materializeVariableResources,
  type UnsupportedVariableExpressionDiagnostic
} from './variables'

export interface DocumentAssemblyOptions extends InterpretInstanceOptions {
  /** Restrict scene population to these source pages plus required component ownership. */
  pageIds?: ReadonlySet<string>
  images?: ReadonlyMap<string, Uint8Array>
  /** A resource record the materializer does not convert; acknowledged rather than dropped. */
  onUnsupportedResource?: (resource: NodeChange) => void
  /** Explicitly preserve expression-valued variables without evaluating them. */
  onUnsupportedVariableExpression?: (diagnostic: UnsupportedVariableExpressionDiagnostic) => void
  onUnresolvedBinding?: (diagnostic: BindingReferenceDiagnostic) => void
}

/** Assemble every page of an archive into one graph. */
export function materializeDocument(
  changes: readonly NodeChange[],
  blobs: Uint8Array[] = [],
  options: DocumentAssemblyOptions = {}
): AssemblyState {
  return materializeReader(createDocumentReader(changes, options.pageIds), blobs, options)
}

/** Own parsed archive records; do not create a second full source tree. */
export function materializeFigArchive(
  bytes: ArrayBuffer,
  options: DocumentAssemblyOptions = {}
): AssemblyState {
  const { reader, blobs, images } = createArchiveDocumentReader(bytes, options.pageIds)
  return materializeReader(reader, blobs, { ...options, images: options.images ?? new Map(images) })
}

export interface AssemblyState {
  graph: SceneGraph
  nextImportedId: number
  /** Every GUID the archive's records keep, on pages loaded or not; minted ids skip them. */
  recordIds: ReadonlySet<string>
  sources: Map<string, string>
  components: Map<string, MaterializedComponentOccurrence>
  componentIds: Map<string, string>
  savedSizeNodes: Set<string>
  /** Component property types by definition id, carried across page loads. */
  definitionTypes?: Map<string, string>
  /** A variant's copies of its set's properties, read from its record by GUID. */
  propertyCopies: (sourceId: string) => PropertyCopies
}

/** Definition types already in the graph; only needed once, or after a resume. */
function seedDefinitionTypes(graph: SceneGraph): Map<string, string> {
  const types = new Map<string, string>()
  for (const node of graph.getAllNodes())
    for (const definition of node.componentPropertyDefinitions)
      types.set(definition.id, definition.type)
  return types
}

/**
 * The next id the import mints for a layer with no record of its own, such as a copy inside an
 * instance. It skips every GUID the archive's records keep, so a page loaded later still finds
 * its layers' GUIDs free.
 */
function mintImportedId(state: Pick<AssemblyState, 'nextImportedId' | 'recordIds'>): string {
  let id: string
  do id = `0:${state.nextImportedId++}`
  while (state.recordIds.has(id))
  return id
}

/**
 * A graph whose root takes the document record's GUID and whose first page an imported id, and
 * every later entity the production allocator's. The graph keeps its generator for life, and a
 * closure keeps every variable its scope shares with other closures, so the generator lives
 * here, away from the archive reader.
 */
function createImportedGraph(
  rootId: string | undefined,
  recordIds: ReadonlySet<string>
): { graph: SceneGraph; nextImportedId: number } {
  let initializing = true
  let root = rootId
  const counter = { nextImportedId: 1, recordIds }
  const graph = new SceneGraph(() => {
    if (!initializing) return generateId()
    const id = root ?? mintImportedId(counter)
    root = undefined
    return id
  })
  initializing = false
  return { graph, nextImportedId: counter.nextImportedId }
}

/**
 * The root's id: the one OpenPencil saved it under, or else the document record's GUID, which
 * Figma always saves as `0:0`.
 */
function documentRootId(document: NodeChange, recordIds: ReadonlySet<string>): string | undefined {
  const saved = readNodeChangePluginData(document, OPEN_PENCIL_PLUGIN_DATA.documentId)
  if (saved && !recordIds.has(saved)) return saved
  return document.guid && guidToString(document.guid)
}

function createAssemblyState(
  reader: ReturnType<typeof createDocumentReader>,
  options: DocumentAssemblyOptions
): AssemblyState {
  // Layers take their records' GUIDs and the rest counter ids, the same on every run, for CLI
  // inspection, patches, and rooms. Authored entities use the production allocator even when
  // created in a previously imported graph.
  const document = reader.documentRecord
  const { recordIds } = reader
  const imported = createImportedGraph(document && documentRootId(document, recordIds), recordIds)
  const { graph } = imported
  const state: AssemblyState = {
    graph,
    nextImportedId: imported.nextImportedId,
    recordIds,
    sources: new Map(),
    components: new Map(),
    componentIds: new Map(),
    savedSizeNodes: new Set(),
    propertyCopies: (sourceId) => reader.propertyCopies(sourceId)
  }
  applyDocumentMetadata(graph, document)
  for (const [hash, bytes] of options.images ?? []) graph.images.set(hash, bytes.slice())
  graph.applyImportedStateDuring(
    () =>
      materializeVariableResources(
        graph,
        reader.resources,
        options.onUnsupportedResource,
        options.onUnsupportedVariableExpression
      ),
    () => mintImportedId(state)
  )
  for (const page of graph.getPages()) graph.deleteNode(page.id)
  return state
}

/**
 * Syncing an edited graph's new instances copies their component's sizes over the sizes Figma
 * derived for them, such as a field filling its resized instance. Puts the derived sizes back,
 * except along an axis whose component layer was edited live, which syncing rightly carried over:
 * the layer an owning instance maps it to, or its own component.
 */
function restoreDerivedSizes(
  graph: SceneGraph,
  derivedSizes: ReadonlyMap<string, { width: number; height: number }>
): void {
  graph.preserveSourceMetadataDuring(() => {
    for (const [id, size] of derivedSizes) {
      const node = graph.getNode(id)
      if (!node) continue
      const edited = new Set(
        syncSourceLayers(graph, node).flatMap((layer) => layer.source.editedFields)
      )
      const updates: Partial<SceneNode> = {}
      if (node.width !== size.width && !edited.has('width')) updates.width = size.width
      if (node.height !== size.height && !edited.has('height')) updates.height = size.height
      if (Object.keys(updates).length > 0) graph.updateNode(id, updates)
    }
  })
}

/** How a page load joins a graph that earlier loads built. */
export interface PageLoad {
  /** The graph may hold edits made since the file loaded, which new instances must take. */
  edited: boolean
  onProgress?: () => void
}

/** Materialize what a reader selected into a new graph, or into `previous` for a page load. */
export function materializeReader(
  reader: ReturnType<typeof createDocumentReader>,
  blobs: Uint8Array[],
  options: DocumentAssemblyOptions,
  previous?: AssemblyState,
  load: PageLoad = { edited: false }
): AssemblyState {
  for (const diagnostic of reader.bindingDiagnostics) {
    if (!options.onUnresolvedBinding)
      throw new Error(`Unresolved binding ${diagnostic.sourceId}: ${diagnostic.field}`)
    options.onUnresolvedBinding(diagnostic)
  }
  // Reading a large page and the components it places takes a while on its own.
  const readOptions = load.onProgress ? { ...options, onProgress: load.onProgress } : options
  const pages = reader.pages.map((page) => reader.readPage(page.id, readOptions))
  const state = previous ?? createAssemblyState(reader, options)
  const plan = reader.planComponents(pages, readOptions, (id) => state.components.has(id))
  return state.graph.applyImportedStateDuring(
    () => materializeReaderInto(pages, plan, blobs, state, load),
    () => mintImportedId(state)
  )
}

/** The instances a definition holds itself, not those inside its instances or nested definitions. */
function definitionInstances(
  occurrence: InstanceOccurrence,
  nodes: ReadonlyMap<InstanceOccurrence, SceneNode>
): string[] {
  return occurrence.children.flatMap((child) => {
    if (child.properties.type === 'SYMBOL') {
      return []
    }
    if (child.mainComponentId === null) {
      return definitionInstances(child, nodes)
    }
    return nodes.get(child)?.id ?? []
  })
}

function materializeReaderInto(
  pages: InstanceOccurrence[],
  plan: ComponentConstruction[],
  blobs: Uint8Array[],
  state: AssemblyState,
  { edited, onProgress }: PageLoad
): AssemblyState {
  const { graph, sources, components, savedSizeNodes, componentIds } = state
  const existingNodeIds = new Set(graph.nodes.keys())
  const layoutScales = new Map<string, number>()
  /** The sizes Figma derived for this pass's instance layers, as materialized. */
  const derivedSizes = new Map<string, { width: number; height: number }>()
  const rememberDerivedSizes = (nodes: ReadonlyMap<InstanceOccurrence, SceneNode>): void => {
    for (const [occurrence, node] of nodes) {
      if (occurrence.derivedSize) {
        savedSizeNodes.add(node.id)
        derivedSizes.set(node.id, { width: node.width, height: node.height })
      }
      if (occurrence.layoutScale !== undefined) layoutScales.set(node.id, occurrence.layoutScale)
    }
  }
  /** A record's layer keeps the record's GUID, unless a layer has it already: a repeated record. */
  const recordId = ({ sourceId }: InstanceOccurrence): string | undefined =>
    graph.isEntityIdTaken(sourceId) ? undefined : sourceId
  /** Generated frames whose records name other layers, linked once the pass has made them. */
  const linked: Array<{ node: SceneNode; record: NodeChange }> = []
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
    const id = recordId(occurrence)
    const node = id
      ? graph.createNodeWithId(id, nodeType, parentId, props)
      : graph.createNode(nodeType, parentId, props)
    sources.set(occurrence.sourceId, node.id)
    if (node.type === 'COMPONENT') componentIds.set(occurrence.sourceId, node.id)
    const codec = generatedFrameCodec(node.type)
    codec?.read(graph, node, occurrence.properties, blobs)
    if (codec?.link) linked.push({ node, record: occurrence.properties })
    for (const child of occurrence.children) createShells(child, node.id)
  }
  for (const page of pages) createShells(page, graph.rootId)
  /**
   * Instances a load into an edited graph must sync with their components, which may have
   * changed live since the file loaded. Only this load's new instances: syncing a whole
   * component would copy its sizes over the sizes Figma derived for instances placed earlier.
   */
  const resync = new Set<string>()
  const buildComponent = (item: ComponentConstruction): void => {
    if (edited) reconcileOccurrenceStructure(item.occurrence, graph, components)
    const parentId = sources.get(item.parentSourceId)
    if (!parentId) throw new Error(`Unmaterialized component parent ${item.parentSourceId}`)
    const existingNodes = new Map<InstanceOccurrence, SceneNode>()
    /** Definitions an earlier step built inside this one: they keep the layers they have. */
    const nested: Array<[InstanceOccurrence, MaterializedComponentOccurrence]> = []
    const collectExisting = (node: InstanceOccurrence): void => {
      const id = sources.get(node.sourceId)
      const existing = id ? graph.getNode(id) : undefined
      if (existing) existingNodes.set(node, existing)
      // A definition deleted since it was built is built again, like any missing layer.
      const component =
        existing && node.properties.type === 'SYMBOL' ? components.get(node.sourceId) : undefined
      if (component) nested.push([node, component])
      else if (node.mainComponentId === null) node.children.forEach(collectExisting)
    }
    collectExisting(item.occurrence)
    const built = materializeInstance(graph, parentId, item.occurrence, componentIds, {
      blobs,
      sourceChildren: mapInstanceSourceChildren(item.occurrence, components),
      existingNodes,
      recordId
    })
    rememberDerivedSizes(built.nodes)
    if (edited) {
      reconcileLiveComponentEdits(graph, built)
      for (const id of definitionInstances(item.occurrence, built.nodes)) resync.add(id)
    }
    // Linking and checkpoints address a nested definition's layers through this tree too.
    const nodes = new Map(built.nodes)
    for (const [node, component] of nested) {
      for (const [occurrence, layer] of mapMaterializedComponentNodes(node, component)) {
        nodes.set(occurrence, layer)
      }
    }
    const materialized = { root: built.root, nodes }
    linkInstanceSourceChildren(item.occurrence, materialized, components)
    components.set(item.sourceId, { occurrence: item.occurrence, materialized })
    componentIds.set(item.sourceId, materialized.root.id)
    sources.set(item.sourceId, materialized.root.id)
  }
  for (const item of plan) {
    onProgress?.()
    if (!components.has(item.sourceId)) buildComponent(item)
  }
  const populateInstances = (occurrence: InstanceOccurrence): void => {
    if (occurrence.properties.type === 'SYMBOL') return
    const parentId = sources.get(occurrence.sourceId)
    if (!parentId) throw new Error(`Missing source container ${occurrence.sourceId}`)
    const ordered: string[] = []
    for (const child of occurrence.children) {
      if (edited) reconcileOccurrenceStructure(child, graph, components)
      if (child.mainComponentId !== null && !sources.has(child.sourceId)) {
        onProgress?.()
        const materialized = materializeInstance(graph, parentId, child, componentIds, {
          blobs,
          sourceChildren: mapInstanceSourceChildren(child, components),
          recordId
        })
        rememberDerivedSizes(materialized.nodes)
        linkInstanceSourceChildren(child, materialized, components)
        if (edited) {
          reconcileLiveComponentEdits(graph, materialized)
          if (materialized.root.componentId) resync.add(materialized.root.id)
        }
        sources.set(child.sourceId, materialized.root.id)
      } else if (child.mainComponentId === null && child.properties.type !== 'SYMBOL')
        populateInstances(child)
      const id = sources.get(child.sourceId)
      if (!id) throw new Error(`Missing assembled child ${child.sourceId}`)
      // A layer moved live to another parent stays there; this only orders what the parent holds.
      if (graph.getNode(id)?.parentId === parentId) ordered.push(id)
    }
    const parent = graph.getNode(parentId)
    if (parent) parent.childIds = mergeSavedOrder(graph, parent.childIds, ordered, existingNodeIds)
  }
  for (const page of pages) populateInstances(page)
  // Before instances sync, so they bind and assign the set properties their variants' copies
  // stand for.
  const componentSources = new Map([...componentIds].map(([source, node]) => [node, source]))
  foldVariantPropertyCopies(
    graph,
    [...graph.nodes.values()].filter((node) => !existingNodeIds.has(node.id)),
    (variant) => state.propertyCopies(componentSources.get(variant.id) ?? variant.id)
  )
  for (const instanceId of resync) graph.syncInstance(instanceId)
  if (resync.size > 0) restoreDerivedSizes(graph, derivedSizes)
  // Records name other layers by GUID, so links wait until every layer of the pass exists,
  // instances and the layers inside them included.
  const layerOf = (sourceId: string) => sources.get(sourceId)
  for (const { node, record } of linked) {
    generatedFrameCodec(node.type)?.link?.(graph, node, record, layerOf)
  }
  // Layers and ranges name their styles by the styles' own IDs, which the records' GUIDs are,
  // so only links to other layers are renamed to the layers this page added.
  for (const node of graph.getAllNodes()) {
    if (existingNodeIds.has(node.id) || node.styleRuns.length === 0) continue
    node.styleRuns = remapStyleRunReferences(node.styleRuns, {
      variable: (id) => id,
      style: (id) => id,
      node: (id) => sources.get(id) ?? id
    })
  }
  // These passes apply to the nodes this page added, not to the whole graph.
  const materialized = [...graph.nodes.values()].filter((node) => !existingNodeIds.has(node.id))
  state.definitionTypes ??= seedDefinitionTypes(graph)
  linkComponentPropertyValues(graph, sources, materialized, state.definitionTypes)
  graph.preserveSourceMetadataDuring(() => {
    resolveVariantPropertyValues(graph, materialized)
    applyDocumentLayoutBindings(graph, savedSizeNodes, materialized, layoutScales)
    applyDocumentPaintBindings(graph, materialized)
    applyDocumentEffectBindings(graph, materialized)
    applyDocumentValueBindings(graph, materialized)
  })
  return state
}
