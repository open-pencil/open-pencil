import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import type { InstanceOccurrence, InterpretInstanceOptions } from '../instance-overrides/interpret'
import { materializeInstance } from '../instance-overrides/materialize-instance'
import {
  linkInstanceSourceChildren,
  mapInstanceSourceChildren,
  type MaterializedComponentOccurrence
} from '../instance-overrides/source-children'
import { nodeChangeToProps } from '../node-change'
import type { BindingReferenceDiagnostic } from './binding-references'
import { applyDocumentLayoutBindings } from './layout-bindings'
import { createDocumentReader } from './read'
import { materializeVariableResources } from './variables'

export interface DocumentAssemblyOptions extends InterpretInstanceOptions {
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
  const reader = createDocumentReader(changes)
  for (const diagnostic of reader.bindingDiagnostics) {
    if (!options.onUnresolvedBinding)
      throw new Error(`Unresolved binding ${diagnostic.sourceId}: ${diagnostic.field}`)
    options.onUnresolvedBinding(diagnostic)
  }
  const pages = reader.pages.map((page) => reader.readPage(page.id, options))
  const plan = reader.planComponents(pages, options)
  const graph = new SceneGraph()
  materializeVariableResources(graph, reader.resources, options.onUnsupportedResource)
  for (const page of graph.getPages()) graph.deleteNode(page.id)
  const sources = new Map<string, string>()
  const components = new Map<string, MaterializedComponentOccurrence>()
  const componentIds = new Map<string, string>()
  const createShells = (occurrence: InstanceOccurrence, parentId: string): void => {
    if (occurrence.mainComponentId !== null) return
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
      if (child.mainComponentId !== null) {
        const materialized = materializeInstance(
          graph,
          parentId,
          child,
          componentIds,
          blobs,
          mapInstanceSourceChildren(child, components)
        )
        linkInstanceSourceChildren(child, materialized, components)
        sources.set(child.sourceId, materialized.root.id)
      } else if (child.properties.type !== 'SYMBOL') populateInstances(child)
      const id = sources.get(child.sourceId)
      if (!id) throw new Error(`Missing assembled child ${child.sourceId}`)
      ordered.push(id)
    }
    const parent = graph.getNode(parentId)
    if (parent) parent.childIds = ordered
  }
  for (const page of pages) populateInstances(page)
  graph.preserveSourceMetadataDuring(() => applyDocumentLayoutBindings(graph))
  return { graph, sources }
}
