import { SCENE_OVERRIDE_FIELDS } from '#fig/instance-overrides/fields'

import { stringToGuid, UNSET_GUID } from '@open-pencil/kiwi/fig/guid'
import { normalizeFontFamily, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import type { GUID, Vector } from '@open-pencil/scene-graph/primitives'

import { weightToFigmaStyle } from '../font/style'
import { forEachExportedOverride, instanceExportAddress } from '../instance/geometry'
import { mergeVariableConsumptionMaps, overrideVariableBindingEntry } from '../variable/bindings'
import {
  buildStyleReferences,
  createFillPaints,
  createStrokePaints,
  getOrCreateNodeGuid,
  instanceGuidResolver,
  type KiwiSymbolOverridePayload,
  type SceneNodeToKiwiContext,
  type StyleReference
} from './context'
import { kiwiEffects } from './effects'
import { fillsOwnSizingAxis } from './fill-sizing'
import { normalizeStackCounterAlignItems, normalizeStackJustify } from './layout-values'
import { exportedNode } from './resolved-bindings'
import { serializeVariableModes } from './variable-modes'

function exportedStyleReference(context: SceneNodeToKiwiContext, id: string): StyleReference {
  context.styleReferences ??= buildStyleReferences(context.graph)
  const mapped = context.nodeIdToGuid?.get(id)
  if (mapped) return { guid: mapped }
  return context.styleReferences.get(id) ?? { guid: stringToGuid(id) }
}

/** The uniform scale an instance draws its component at; claims are written without it. */
function instanceScale(instance: SceneNode): number {
  const scale = instance.componentScale
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid instance uniform scale')
  return scale
}

function unscaledRootSize(instance: SceneNode, target: SceneNode): Vector {
  const scale = instanceScale(instance)
  return { x: target.width / scale, y: target.height / scale }
}

/** A length, or a list of them, in the instance's own space. */
function unscaledLength(value: unknown, scale: number): unknown {
  if (typeof value === 'number') return value / scale
  if (Array.isArray(value))
    return value.map((item: unknown) => (typeof item === 'number' ? item / scale : item))
  return value
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
      return {
        [raw]: definition.length
          ? unscaledLength(target[field], instanceScale(instance))
          : target[field]
      }
    case 'visible':
      return { visible: target.visible }
    case 'text':
      return { textData: { characters: typeof value === 'string' ? value : target.text } }
    case 'text-style':
      return target.textStyleId
        ? { styleIdForText: exportedStyleReference(context, target.textStyleId) }
        : undefined
    case 'style': {
      const id = target[field]
      // A style the instance took off is the unset GUID, as Figma writes it.
      return {
        [raw]: typeof id === 'string' ? exportedStyleReference(context, id) : { guid: UNSET_GUID }
      }
    }
    case 'effects':
      return { effects: kiwiEffects(context, target.effects, instanceScale(instance)) }
    case 'layout-align':
      return raw === 'stackPrimaryAlignItems'
        ? { stackPrimaryAlignItems: normalizeStackJustify(target.primaryAxisAlign) }
        : { stackCounterAlignItems: normalizeStackCounterAlignItems(target.counterAxisAlign) }
    case 'positioning':
      return { stackPositioning: target.layoutPositioning }
    case 'font':
      return {
        fontName: {
          family: normalizeFontFamily(target.fontFamily),
          style: weightToFigmaStyle(target.fontWeight, target.italic),
          postscript: ''
        }
      }
    case 'text-length': {
      const value = target[field]
      return typeof value === 'number'
        ? { [raw]: { value: value / instanceScale(instance), units: 'PIXELS' } }
        : undefined
    }
    case 'text-decoration':
      return { textDecoration: target.textDecoration }
    case 'variable-modes':
      return {
        variableModeBySetMap: serializeVariableModes(
          target,
          context.varIdToGuid,
          context.modeIdToGuid
        ) ?? { entries: [] }
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
  claimed: ClaimInput,
  field: string,
  path: GUID[],
  counter: { value: number }
): KiwiSymbolOverridePayload | undefined {
  const input = {
    ...claimed,
    target: exportedNode(claimed.context, claimed.target)
  }
  if (field === 'componentId')
    return exportedSwapOverride(input.context, input.target, path, counter)
  const claim = field.startsWith('boundVariables/')
    ? bindingClaim(input, field)
    : registryClaim(field as keyof SceneNode, input)
  return claim && { guidPath: { guids: path }, ...claim }
}

/** Every override this instance records, as full-path claims. */
export function serializeRuntimePropertyOverrides(
  context: SceneNodeToKiwiContext,
  instance: SceneNode,
  localIdCounter: { value: number }
): KiwiSymbolOverridePayload[] {
  const result: KiwiSymbolOverridePayload[] = []
  const resolveGuid = instanceGuidResolver(context, localIdCounter)
  forEachExportedOverride(context.graph, instance, (target, field, value) => {
    // The record names the component an instance shows; only its layers' swaps are claims.
    if (target === instance && field === 'componentId') return
    const address = instanceExportAddress(instance, target, resolveGuid)
    if (!address) return
    const claim = overrideClaim(
      { context, instance, target, value },
      field,
      address,
      localIdCounter
    )
    if (claim) result.push(claim)
  })
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
