import {
  CLEARED_STYLE,
  type OverrideField,
  SCENE_OVERRIDE_FIELDS
} from '#fig/instance-overrides/fields'
import { compact } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  forEachInstanceOverride,
  overriddenBindingField
} from '@open-pencil/scene-graph/instances/overrides'
import type { GUID, Vector } from '@open-pencil/scene-graph/primitives'
import { scaleNodeChanges } from '@open-pencil/scene-graph/scaling'
import { ownsSlotContent } from '@open-pencil/scene-graph/slots'
import { paintBindingTarget } from '@open-pencil/scene-graph/variables'

import { instanceExportAddress } from '../instance/geometry'
import { mergeVariableConsumptionMaps, overrideVariableBindingEntry } from '../variable/bindings'
import { nestedPropertyAssignments } from './assignments/nested'
import {
  createFillPaints,
  createStrokePaints,
  getOrCreateNodeGuid,
  exportedStyleReference,
  instanceGuidResolver,
  isDescendantOf,
  type KiwiNodeChange,
  type KiwiSymbolOverridePayload,
  type SceneNodeToKiwiContext
} from './context'
import { fillsOwnSizingAxis } from './fill-sizing'
import { exportedNode } from './resolved-bindings'

function unscaledRootSize(instance: SceneNode, target: SceneNode): Vector {
  const scale = instance.componentScale
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid instance uniform scale')
  return { x: target.width / scale, y: target.height / scale }
}

function exportedSwapOverride(
  context: SceneNodeToKiwiContext,
  target: SceneNode,
  path: GUID[] | undefined,
  counter: { value: number }
): KiwiSymbolOverridePayload | undefined {
  if (!path || target.type !== 'INSTANCE' || !target.componentId) return undefined
  const component = getOrCreateNodeGuid(context, target.componentId, counter)
  return component ? { guidPath: { guids: path }, overriddenSymbolID: component } : undefined
}

/**
 * Layout modes are dimensionless; sizing modes map to Figma's implicit-size vocabulary, and an
 * axis the layer fills stays fixed, since Figma applies the override over the fill.
 */
function layoutModeClaim(
  raw: string,
  value: unknown,
  graph: SceneGraph,
  target: SceneNode
): Record<string, unknown> | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  if (raw === 'stackPrimarySizing' || raw === 'stackCounterSizing') {
    const hugs = value === 'HUG' && !fillsOwnSizingAxis(graph, target, raw)
    return { [raw]: hugs ? 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE' : 'FIXED' }
  }
  return { [raw]: value }
}

/** Layout distances are placed-space lengths; claims are written in the owner's pre-scale space. */
function layoutDistanceClaim(
  raw: string,
  value: unknown,
  instance: SceneNode
): Record<string, number> | undefined {
  if (typeof value !== 'number') return undefined
  const scale = instance.componentScale
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid instance uniform scale')
  return { [raw]: value / scale }
}

interface ClaimInput {
  context: SceneNodeToKiwiContext
  instance: SceneNode
  target: SceneNode
  /** The recorded override value, when the override stored one. */
  value: unknown
  /** The target's own record, written once however many of its fields are claimed. */
  nodeFields: () => KiwiNodeChange
}

/**
 * The claim an instance override serializes to, by the kind of its scene field. This is the
 * export side of the same registry materialization records claims from.
 */
function registryClaim(
  field: keyof SceneNode,
  input: ClaimInput
): Omit<KiwiSymbolOverridePayload, 'guidPath'> | undefined {
  const entries = SCENE_OVERRIDE_FIELDS.get(field)
  if (!entries) return undefined
  const claims = compact(
    entries.map(({ raw, field: definition }) => rawClaim(raw, definition, field, input))
  )
  return claims.length > 0 ? Object.assign({}, ...claims) : undefined
}

/** Writes the style fields of a layer as its own record does. */
export type NodeFieldsWriter = (node: SceneNode) => KiwiNodeChange

/** A layer's record in its component's coordinates, which instance claims are written in. */
function unscaledNodeFields(
  writeNodeFields: NodeFieldsWriter,
  instance: SceneNode,
  target: SceneNode
): KiwiNodeChange {
  const scale = instance.componentScale
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid instance uniform scale')
  const unscaled =
    scale === 1 ? target : { ...target, ...scaleNodeChanges(target, 1 / scale, false) }
  return writeNodeFields(unscaled)
}

/** One raw field of a claim, serialized by the kind of its scene field. */
function rawClaim(
  raw: string,
  definition: OverrideField,
  field: keyof SceneNode,
  { context, instance, target, value, nodeFields }: ClaimInput
): Omit<KiwiSymbolOverridePayload, 'guidPath'> | undefined {
  switch (definition.kind) {
    case 'node': {
      const record = nodeFields()
      const claimed = raw in record ? record[raw] : definition.absent
      return claimed === undefined ? undefined : { [raw]: claimed }
    }
    case 'scalar':
      return { [raw]: target[field] }
    case 'visible':
      return { visible: target.visible }
    case 'text': {
      // The characters with their styled ranges and lines, as the layer's own record writes them.
      const characters = field === 'text' && typeof value === 'string' ? value : target.text
      return { textData: { ...nodeFields().textData, characters } }
    }
    case 'text-style':
      return {
        styleIdForText: target.textStyleId
          ? exportedStyleReference(context, target.textStyleId)
          : structuredClone(CLEARED_STYLE)
      }
    case 'paint':
      return raw === 'fillPaints'
        ? { fillPaints: createFillPaints(context, target) }
        : { strokePaints: createStrokePaints(context, target) }
    case 'size':
      return { size: unscaledRootSize(instance, target) }
    case 'layout-distance':
      return layoutDistanceClaim(raw, target[field], instance)
    case 'layout-mode':
      return layoutModeClaim(raw, target[field], context.graph, target)
    default:
      return undefined
  }
}

function paintBindingOverride(
  context: SceneNodeToKiwiContext,
  target: SceneNode,
  bindingField: string
): Partial<Pick<KiwiSymbolOverridePayload, 'fillPaints' | 'strokePaints'>> | undefined {
  const paint = paintBindingTarget(bindingField)
  if (paint?.list === 'fills') return { fillPaints: createFillPaints(context, target) }
  if (paint?.list === 'strokes') return { strokePaints: createStrokePaints(context, target) }
  return undefined
}

/** A binding override is a paint claim for paint colours and a consumption entry otherwise. */
function bindingClaim(
  { context, instance, target }: ClaimInput,
  bindingField: string
): Omit<KiwiSymbolOverridePayload, 'guidPath'> | undefined {
  const paints = paintBindingOverride(context, target, bindingField)
  if (paints) return paints
  const entry = overrideVariableBindingEntry(
    bindingField,
    target,
    instance,
    context.graph,
    context.varIdToGuid
  )
  return entry ? { parameterConsumptionMap: { entries: [entry] } } : undefined
}

function overrideClaim(
  claimed: Omit<ClaimInput, 'nodeFields'> & {
    records: Map<string, KiwiNodeChange>
    writeNodeFields: NodeFieldsWriter
  },
  field: string,
  path: GUID[],
  counter: { value: number }
): KiwiSymbolOverridePayload | undefined {
  const target = exportedNode(claimed.context, claimed.target)
  const nodeFields = () => {
    let record = claimed.records.get(target.id)
    if (!record) {
      record = unscaledNodeFields(claimed.writeNodeFields, claimed.instance, target)
      claimed.records.set(target.id, record)
    }
    return record
  }
  const input: ClaimInput = { ...claimed, target, nodeFields }
  if (field === 'componentId')
    return exportedSwapOverride(input.context, input.target, path, counter)
  const binding = overriddenBindingField(field)
  const claim =
    binding === null ? registryClaim(field as keyof SceneNode, input) : bindingClaim(input, binding)
  return claim && { guidPath: { guids: path }, ...claim }
}

/** Every override recorded on this instance and on instances inside it, as full-path claims. */
export function serializeRuntimePropertyOverrides(
  context: SceneNodeToKiwiContext,
  instance: SceneNode,
  localIdCounter: { value: number },
  writeNodeFields: NodeFieldsWriter
): KiwiSymbolOverridePayload[] {
  const result: KiwiSymbolOverridePayload[] = []
  const resolveGuid = instanceGuidResolver(context, localIdCounter)
  // A layer with several overridden fields is addressed once; the resolver keeps the GUIDs it makes.
  const targets = new Map<string, { target: SceneNode; path: GUID[] } | undefined>()
  const records = new Map<string, KiwiNodeChange>()
  const findTarget = (targetId: string) => {
    const target = context.graph.getNode(targetId)
    if (!target || (target.id !== instance.id && !isDescendantOf(context, targetId, instance.id)))
      return undefined
    const path = instanceExportAddress(context.graph, instance, target, resolveGuid)
    return path ? { target, path } : undefined
  }
  const resolveTarget = (owner: SceneNode, nodeId: string) => {
    const targetId = nodeId || owner.id
    if (!targets.has(targetId)) targets.set(targetId, findTarget(targetId))
    const found = targets.get(targetId)
    return found && { target: found.target, path: [...found.path] }
  }
  const visit = (node: SceneNode): void => {
    if (node.type === 'INSTANCE')
      forEachInstanceOverride(node.instanceOverrides, (nodeId, field, value) => {
        const resolved = resolveTarget(node, nodeId)
        if (!resolved) return
        const claim = overrideClaim(
          { context, instance, target: resolved.target, value, records, writeNodeFields },
          field,
          resolved.path,
          localIdCounter
        )
        if (claim) result.push(claim)
      })
    if (node.type === 'INSTANCE' && node.id !== instance.id) {
      const resolved = resolveTarget(node, node.id)
      const assignments = resolved
        ? nestedPropertyAssignments(context, instance, node, localIdCounter)
        : []
      if (resolved && assignments.length > 0)
        result.push({ guidPath: { guids: resolved.path }, componentPropAssignments: assignments })
    }
    // Slot content the instance owns carries its own values; it has no component address.
    if (ownsSlotContent(context.graph, node)) return
    for (const child of context.graph.getChildren(node.id)) visit(child)
  }
  visit(instance)
  return result
}

function overridePathKey(payload: KiwiSymbolOverridePayload): string | null {
  const guids = payload.guidPath?.guids
  return guids?.length
    ? guids.map(({ sessionID, localID }) => `${sessionID}:${localID}`).join('/')
    : null
}

export function mergeOverrides(
  symbolOverrides: KiwiSymbolOverridePayload[],
  newOverrides: KiwiSymbolOverridePayload[]
): void {
  // The last override at each path, indexed once: instances can carry thousands of overrides.
  const lastAt = new Map<string, number>()
  symbolOverrides.forEach((existing, index) => {
    const key = overridePathKey(existing)
    if (key) lastAt.set(key, index)
  })
  for (const override of newOverrides) {
    const pathKey = overridePathKey(override)
    const existingIndex = pathKey ? (lastAt.get(pathKey) ?? -1) : -1
    if (existingIndex < 0) {
      if (pathKey) lastAt.set(pathKey, symbolOverrides.length)
      symbolOverrides.push(override)
    } else
      symbolOverrides[existingIndex] = {
        ...symbolOverrides[existingIndex],
        ...override,
        ...mergeVariableConsumptionMaps(symbolOverrides[existingIndex], override)
      }
  }
}
