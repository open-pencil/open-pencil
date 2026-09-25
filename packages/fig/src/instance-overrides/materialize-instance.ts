import type { NodeChange, Paint } from '@open-pencil/kiwi/fig/codec'
import { setInstanceOverride, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'

import { nodeChangeToProps } from '../node-change'
import { numericVariableBindingScales } from '../node-change/variable-bindings'
import { OVERRIDE_FIELDS, type OverrideField, type RawOverrideField } from './fields'
import { resolveOccurrencePath, type InstanceOccurrence } from './interpret'
import { symbolDataOf } from './types'
import {
  recordVariableBindingClaims,
  occurrenceAssignmentScales,
  occurrenceScale
} from './variable-bindings'

function occurrenceMetadata(
  current: InstanceOccurrence,
  converted: ReturnType<typeof nodeChangeToProps>
) {
  const metadata = createDefaultSourceMetadata()
  metadata.fig.layout = converted.source?.fig.layout ?? null
  metadata.fig.uniformScaleFactor = symbolDataOf(current.properties)?.uniformScaleFactor ?? null
  return metadata
}

export interface MaterializedInstance {
  root: SceneNode
  /** Occurrence object identity distinguishes repeated uses of a source node. */
  nodes: ReadonlyMap<InstanceOccurrence, SceneNode>
}

/**
 * Materialize an interpreted tree, without legacy population, sync, or layout.
 * Component IDs must refer to existing COMPONENT nodes in the destination graph.
 * Occurrence provenance stays in the returned map, not in fabricated FIG metadata.
 */
export function materializeInstance(
  graph: SceneGraph,
  parentId: string,
  occurrence: InstanceOccurrence,
  components: ReadonlyMap<string, string>,
  blobs: Uint8Array[] = [],
  sourceChildren: ReadonlyMap<InstanceOccurrence, string> = new Map(),
  existingNodes: ReadonlyMap<InstanceOccurrence, SceneNode> = new Map()
): MaterializedInstance {
  if (!graph.getNode(parentId)) throw new Error('Missing materialization parent')
  const prepared = new Map<InstanceOccurrence, ReturnType<typeof nodeChangeToProps>>()
  const validate = (current: InstanceOccurrence): void => {
    if (prepared.has(current)) throw new Error('Repeated or cyclic instance occurrence')
    const converted = nodeChangeToProps(current.properties, blobs, 'occurrence')
    if (converted.nodeType === 'TEXT' && current.derivedSize) {
      converted.derivedLayout = { width: current.derivedSize.x, height: current.derivedSize.y }
    }
    if (converted.nodeType === 'DOCUMENT' || converted.nodeType === 'VARIABLE') {
      throw new Error(`Cannot materialize ${converted.nodeType} as an instance descendant`)
    }
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
    if (nodeType === 'DOCUMENT' || nodeType === 'VARIABLE') {
      throw new Error(`Cannot materialize ${nodeType} as an instance descendant`)
    }
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
    const alias = (paint as Paint).colorVar?.value?.alias ?? (paint as Paint).colorVariableBinding
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
