import { SCENE_OVERRIDE_FIELDS } from '#fig/instance-overrides/fields'
import { effectiveFigmaRawNodeFields } from '#fig/source-metadata'

import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import { forEachInstanceOverride, type SceneNode } from '@open-pencil/scene-graph'
import type { GUID, Vector } from '@open-pencil/scene-graph/primitives'

import { instanceExportAddress } from '../instance-geometry'
import { mergeVariableConsumptionMaps, overrideVariableBindingEntry } from '../variable-bindings'
import {
  createFillPaints,
  createStrokePaints,
  getOrCreateNodeGuid,
  instanceGuidResolver,
  isDescendantOf,
  type KiwiSymbolOverridePayload,
  type SceneNodeToKiwiContext
} from './context'

function exportedTextStyleReference(context: SceneNodeToKiwiContext, id: string) {
  if (!context.styleReferences) {
    const references = new Map<
      string,
      { guid?: GUID; assetRef?: { key: string; version?: string } }
    >()
    for (const node of context.graph.getAllNodes()) {
      if (node.sharedStyleType !== 'TEXT' || !node.source.id) continue
      const raw = effectiveFigmaRawNodeFields(node)
      if (typeof raw.key !== 'string') continue
      const assetRef = {
        key: raw.key,
        ...(typeof raw.version === 'string' ? { version: raw.version } : {})
      }
      references.set(node.source.id, { assetRef })
    }
    context.styleReferences = references
  }
  const mapped = context.nodeIdToGuid?.get(id)
  if (mapped) return { guid: mapped }
  return context.styleReferences.get(id) ?? { guid: stringToGuid(id) }
}

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

/** Layout modes are dimensionless; sizing modes map to Figma's implicit-size vocabulary. */
function layoutModeClaim(raw: string, value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  if (raw === 'stackPrimarySizing' || raw === 'stackCounterSizing')
    return { [raw]: value === 'HUG' ? 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE' : 'FIXED' }
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
}

/**
 * The claim an instance override serializes to, by the kind of its scene field. This is the
 * export side of the same registry materialization records claims from.
 */
function registryClaim(
  field: keyof SceneNode,
  { context, instance, target, value }: ClaimInput
): Omit<KiwiSymbolOverridePayload, 'guidPath'> | undefined {
  const entry = SCENE_OVERRIDE_FIELDS.get(field)
  if (!entry) return undefined
  const { raw, field: definition } = entry
  switch (definition.kind) {
    case 'scalar':
      return { [raw]: target[field] }
    case 'visible':
      return { visible: target.visible }
    case 'text':
      return { textData: { characters: typeof value === 'string' ? value : target.text } }
    case 'text-style':
      return target.textStyleId
        ? { styleIdForText: exportedTextStyleReference(context, target.textStyleId) }
        : undefined
    case 'paint':
      return raw === 'fillPaints'
        ? { fillPaints: createFillPaints(context, target) }
        : { strokePaints: createStrokePaints(context, target) }
    case 'size':
      return { size: unscaledRootSize(instance, target) }
    case 'layout-distance':
      return layoutDistanceClaim(raw, target[field], instance)
    case 'layout-mode':
      return layoutModeClaim(raw, target[field])
    default:
      return undefined
  }
}

function paintBindingOverride(
  context: SceneNodeToKiwiContext,
  target: SceneNode,
  bindingField: string
): Partial<Pick<KiwiSymbolOverridePayload, 'fillPaints' | 'strokePaints'>> | undefined {
  if (/^fills\/\d+\/color$/.test(bindingField))
    return { fillPaints: createFillPaints(context, target) }
  if (/^strokes\/\d+\/color$/.test(bindingField))
    return { strokePaints: createStrokePaints(context, target) }
  return undefined
}

/** A binding override is a paint claim for paint colours and a consumption entry otherwise. */
function bindingClaim(
  { context, instance, target }: ClaimInput,
  field: string
): Omit<KiwiSymbolOverridePayload, 'guidPath'> | undefined {
  const bindingField = field.slice('boundVariables/'.length)
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
  input: ClaimInput,
  field: string,
  path: GUID[],
  counter: { value: number }
): KiwiSymbolOverridePayload | undefined {
  if (field === 'componentId')
    return exportedSwapOverride(input.context, input.target, path, counter)
  const claim = field.startsWith('boundVariables/')
    ? bindingClaim(input, field)
    : registryClaim(field as keyof SceneNode, input)
  return claim && { guidPath: { guids: path }, ...claim }
}

/** Every override recorded on this instance and on instances inside it, as full-path claims. */
export function serializeRuntimePropertyOverrides(
  context: SceneNodeToKiwiContext,
  instance: SceneNode,
  localIdCounter: { value: number }
): KiwiSymbolOverridePayload[] {
  const result: KiwiSymbolOverridePayload[] = []
  const resolveGuid = instanceGuidResolver(context, localIdCounter)
  const resolveTarget = (owner: SceneNode, nodeId: string) => {
    const targetId = nodeId || owner.id
    const target = context.graph.getNode(targetId)
    if (!target || (target.id !== instance.id && !isDescendantOf(context, targetId, instance.id)))
      return undefined
    const path = instanceExportAddress(context.graph, instance, target, resolveGuid)
    return path ? { target, path } : undefined
  }
  const visit = (node: SceneNode): void => {
    if (node.type === 'INSTANCE')
      forEachInstanceOverride(node.instanceOverrides, (nodeId, field, value) => {
        const resolved = resolveTarget(node, nodeId)
        if (!resolved) return
        const claim = overrideClaim(
          { context, instance, target: resolved.target, value },
          field,
          resolved.path,
          localIdCounter
        )
        if (claim) result.push(claim)
      })
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
  for (const override of newOverrides) {
    const pathKey = overridePathKey(override)
    let existingIndex = -1
    if (pathKey) {
      for (let index = symbolOverrides.length - 1; index >= 0; index--) {
        if (overridePathKey(symbolOverrides[index]) !== pathKey) continue
        existingIndex = index
        break
      }
    }
    if (existingIndex < 0) symbolOverrides.push(override)
    else
      symbolOverrides[existingIndex] = {
        ...symbolOverrides[existingIndex],
        ...override,
        ...mergeVariableConsumptionMaps(symbolOverrides[existingIndex], override)
      }
  }
}
