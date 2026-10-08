import { isEqual } from 'es-toolkit/predicate'

import type { NodeChange, Paint } from '@open-pencil/kiwi/fig/codec'
import { setInstanceOverride, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'

import { nodeChangeToProps } from '../node-change'
import { numericVariableBindingScales } from '../node-change/variable/bindings'
import {
  recordVariableBindingClaims,
  occurrenceAssignmentScales,
  occurrenceScale
} from './bindings/variables'
import { OVERRIDE_FIELDS, type OverrideField, type RawOverrideField } from './fields'
import { resolveOccurrencePath } from './interpret'
import type { InstanceOccurrence } from './occurrence/types'
import { symbolDataOf } from './types'

function occurrenceMetadata(
  current: InstanceOccurrence,
  converted: ReturnType<typeof nodeChangeToProps>
) {
  const metadata = createDefaultSourceMetadata()
  // Figma's own sibling key, so re-export keeps the order Figma saved.
  metadata.orderKey = current.properties.parentIndex?.position ?? null
  metadata.fig.layout = converted.source?.fig.layout ?? null
  metadata.fig.uniformScaleFactor = symbolDataOf(current.properties)?.uniformScaleFactor ?? null
  return metadata
}

/**
 * Fields a layer keeps its own: its children, and state written in place, such as its source
 * metadata and its override maps.
 */
const OWN_FIELDS = new Set(['childIds', 'source', 'instanceOverrides'])

/** Maps and sets are written in place, so values holding them are never shared. */
function holdsCollections(value: unknown): boolean {
  if (value instanceof Map || value instanceof Set) return true
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) return false
  return Object.values(value).some(holdsCollections)
}

/**
 * A layer inside an instance holds what its component's layer holds unless an override changed
 * it. Each equal value is the component layer's own object rather than a copy, so a design kit's
 * many instances do not each repeat their components' paints, glyphs, and defaults. Values are
 * replaced, never written into, once loaded; loading writes only into fields a layer keeps.
 */
function shareUnchanged(node: SceneNode, source: SceneNode): void {
  for (const field of Object.keys(node)) {
    if (OWN_FIELDS.has(field)) continue
    const value: unknown = Reflect.get(node, field)
    const original: unknown = Reflect.get(source, field)
    if (value === original || value === null || typeof value !== 'object') continue
    if (holdsCollections(value) || !isEqual(value, original)) continue
    Reflect.set(node, field, original)
  }
}

export interface MaterializedInstance {
  root: SceneNode
  /** Occurrence object identity distinguishes repeated uses of a source node. */
  nodes: ReadonlyMap<InstanceOccurrence, SceneNode>
}

/**
 * Materialize an interpreted tree. Population, sync and layout are the caller's to run.
 * Component IDs must refer to existing COMPONENT nodes in the destination graph.
 * Occurrence provenance stays in the returned map, not in fabricated FIG metadata.
 */
/** What an occurrence tree needs beyond the graph it is written into. */
export interface MaterializeInstanceOptions {
  blobs?: Uint8Array[]
  /** Graph ids for occurrences a component definition already materialized. */
  sourceChildren?: ReadonlyMap<InstanceOccurrence, string>
  /** Nodes to update in place rather than create, keyed by occurrence. */
  existingNodes?: ReadonlyMap<InstanceOccurrence, SceneNode>
}

/** A document or a variable is a resource record, never a node in an expansion. */
function assertMaterializableType(
  nodeType: 'DOCUMENT' | 'VARIABLE' | SceneNode['type']
): asserts nodeType is SceneNode['type'] {
  if (nodeType === 'DOCUMENT' || nodeType === 'VARIABLE') {
    throw new Error(`Cannot materialize ${nodeType} as an instance descendant`)
  }
}

export function materializeInstance(
  graph: SceneGraph,
  parentId: string,
  occurrence: InstanceOccurrence,
  components: ReadonlyMap<string, string>,
  options: MaterializeInstanceOptions = {}
): MaterializedInstance {
  const { blobs = [], sourceChildren = new Map(), existingNodes = new Map() } = options
  if (!graph.getNode(parentId)) throw new Error('Missing materialization parent')
  const prepared = new Map<InstanceOccurrence, ReturnType<typeof nodeChangeToProps>>()
  const validate = (current: InstanceOccurrence): void => {
    if (prepared.has(current)) throw new Error('Repeated or cyclic instance occurrence')
    const converted = nodeChangeToProps(current.properties, blobs, 'occurrence')
    if (converted.nodeType === 'TEXT' && current.derivedSize) {
      converted.derivedLayout = { width: current.derivedSize.x, height: current.derivedSize.y }
    }
    assertMaterializableType(converted.nodeType)
    const existing = existingNodes.get(current)
    if (
      existing &&
      (graph.getNode(existing.id) !== existing || existing.type !== converted.nodeType)
    ) {
      throw new Error(`Invalid preallocated occurrence ${current.sourceId}`)
    }
    prepared.set(current, converted)
    const sourceChildId = sourceChildren.get(current)
    if (sourceChildId && graph.getNode(sourceChildId)?.type !== converted.nodeType) {
      throw new Error(`Invalid source child for ${current.sourceId}`)
    }
    if (current.mainComponentId !== null) {
      const id = components.get(current.mainComponentId)
      if (!id || graph.getNode(id)?.type !== 'COMPONENT') {
        throw new Error(`Missing materialized component ${current.mainComponentId}`)
      }
    }
    for (const child of current.children) validate(child)
  }
  validate(occurrence)
  const nodes = new Map<InstanceOccurrence, SceneNode>(existingNodes)
  const applyBindingClaims = (
    current: InstanceOccurrence,
    node: SceneNode,
    owner?: SceneNode
  ): void => {
    if (!owner) return
    for (const claim of current.bindingClaims) {
      if (claim.origin === 'assignment' && claim.field === 'visible') {
        setInstanceOverride(owner.instanceOverrides, owner.id, node.id, 'visible', node.visible)
      }
    }
  }
  const create = (current: InstanceOccurrence, parent: string, owner?: SceneNode): SceneNode => {
    const converted = prepared.get(current)
    if (!converted) throw new Error('Missing prepared occurrence')
    const { nodeType, ...props } = converted
    assertMaterializableType(nodeType)
    const metadata = occurrenceMetadata(current, converted)
    const propsWithIdentity = {
      ...props,
      variableAssignmentScales: occurrenceAssignmentScales(current),
      componentScale: occurrenceScale(current),
      variableBindingScales: numericVariableBindingScales(
        props.boundVariables ?? {},
        current.layoutScale ?? 1,
        current.variableBindingScales
      ),
      componentId:
        current.mainComponentId === null
          ? (sourceChildren.get(current) ?? null)
          : components.get(current.mainComponentId),
      source: metadata
    }
    const existing = existingNodes.get(current)
    if (existing && existing.parentId !== parent) {
      throw new Error(`Preallocated occurrence has wrong parent ${current.sourceId}`)
    }
    const node = existing ?? graph.createNode(nodeType, parent, propsWithIdentity)
    if (existing) graph.updateNode(existing.id, propsWithIdentity)
    const sharedSource = graph.getNode(sourceChildren.get(current) ?? '')
    if (sharedSource) shareUnchanged(node, sharedSource)
    nodes.set(current, node)
    if (existing && current !== occurrence && node.type === 'COMPONENT') return node
    applyBindingClaims(current, node, owner)
    const sourceChildId = sourceChildren.get(current)
    if (owner && current.mainComponentId !== null && sourceChildId) {
      setInstanceOverride(
        owner.instanceOverrides,
        owner.id,
        node.id,
        'sourceComponentId',
        sourceChildId
      )
      const sourceChild = graph.getNode(sourceChildId)
      if (sourceChild?.componentId !== node.componentId) {
        setInstanceOverride(
          owner.instanceOverrides,
          owner.id,
          node.id,
          'componentId',
          node.componentId
        )
      }
    }
    const children = current.children.map(
      (child) => create(child, node.id, node.type === 'INSTANCE' ? node : owner).id
    )
    node.childIds = children
    return node
  }
  const root = create(occurrence, parentId)
  recordPropertyClaims(nodes)
  return { root, nodes }
}

/** Whether a raw claim actually carries the scene value its kind maps to. */
function claimApplies(field: OverrideField, value: unknown, target: SceneNode): boolean {
  if (field.kind === 'text')
    return typeof value === 'object' && value !== null && 'characters' in value
  if (field.kind === 'text-style') return Boolean(target.textStyleId)
  return true
}

/**
 * A claimed paint carries its colour alias inside the paint, so the binding it declares is
 * part of the claim too; otherwise a later component sync restores the component's binding.
 */
function recordPaintBindingClaims(
  owner: SceneNode,
  target: SceneNode,
  scene: keyof SceneNode,
  paints: unknown
): void {
  if (!Array.isArray(paints)) return
  let declared = false
  for (const [index, paint] of paints.entries()) {
    const alias = (paint as Paint).colorVar?.value?.alias
    if (!alias) continue
    const field = `boundVariables/${scene}/${index}/color`
    setInstanceOverride(
      owner.instanceOverrides,
      owner.id,
      target.id,
      field,
      target.boundVariables[`${scene}/${index}/color`] ?? null
    )
    declared = true
  }
  if (declared) setInstanceOverride(owner.instanceOverrides, owner.id, target.id, 'boundVariables')
}

function recordPropertyClaims(nodes: ReadonlyMap<InstanceOccurrence, SceneNode>): void {
  for (const [ownerOccurrence, owner] of nodes) {
    if (owner.type !== 'INSTANCE') continue
    for (const claim of ownerOccurrence.propertyClaims) {
      const targetOccurrence = resolveOccurrencePath(ownerOccurrence, claim.path)
      const target = nodes.get(targetOccurrence)
      if (!target) throw new Error('Unmaterialized property claim target')
      for (const raw of Object.keys(OVERRIDE_FIELDS) as RawOverrideField[]) {
        if (!(raw in claim.properties)) continue
        const field = OVERRIDE_FIELDS[raw]
        if (!claimApplies(field, claim.properties[raw], target)) continue
        for (const scene of field.scene) {
          const value = target[scene]
          setInstanceOverride(
            owner.instanceOverrides,
            owner.id,
            target.id,
            scene,
            structuredClone(value)
          )
        }
        if (field.kind === 'paint')
          recordPaintBindingClaims(owner, target, field.scene[0], claim.properties[raw])
      }
      recordVariableBindingClaims(owner, target, claim.properties as NodeChange)
    }
  }
}
