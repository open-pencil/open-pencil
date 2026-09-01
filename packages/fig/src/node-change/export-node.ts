import type { NodeChange, Paint } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import type {
  ComponentPropertyDefinition,
  ComponentPropertyReferenceField,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import { DEFAULT_STROKE_MITER_LIMIT, forEachInstanceOverride } from '@open-pencil/scene-graph'
import type { Color, GUID, Matrix, Vector } from '@open-pencil/scene-graph/primitives'

import { effectiveFigmaRawNodeFields, effectiveFigmaSourcePayload } from '../source-metadata'
/* eslint-disable max-lines */
import { bytesToHex } from './bytes'
import { exportCanvasGuides } from './canvas-guides'
import {
  applyExportSettingsPluginData,
  applyLibrarySourcePluginData,
  applyTextPathBoxPluginData,
  mergePluginData,
  NODE_TYPE_PLUGIN_KEY,
  serializePluginRelaunchData,
  upsertPluginData
} from './plugin-data'

export type KiwiNodeChange = NodeChange & Record<string, unknown>

type KiwiBooleanOperation = NonNullable<NodeChange['booleanOperation']>

interface KiwiSymbolOverridePayload {
  guidPath?: { guids?: GUID[] }
  textData?: { characters?: string }
  fillPaints?: Paint[]
  [key: string]: unknown
}

function toKiwiBooleanOperation(operation: SceneNode['booleanOperation']): KiwiBooleanOperation {
  return operation === 'EXCLUDE' ? 'XOR' : (operation ?? 'UNION')
}

/** Resolve effect variable asset refs when the Kiwi effect schema requires GUID aliases. */
export function buildAssetRefToVarGuidMap(
  graph: SceneGraph,
  varIdToGuid: Map<string, GUID>
): Map<string, GUID> {
  const map = new Map<string, GUID>()
  for (const [varId, variable] of graph.variables) {
    if (!variable.key) continue
    const guid = varIdToGuid.get(varId) ?? stringToGuid(varId)
    map.set(variable.key, guid)
    if (variable.version) map.set(`${variable.key}@${variable.version}`, guid)
  }
  return map
}

interface SceneNodeToKiwiContext {
  graph: SceneGraph
  blobs: Uint8Array[]
  blobIndexByHex?: Map<string, number>
  nodeIdToGuid?: Map<string, GUID>
  /** Reverse index of assigned GUID values ("sessionID:localID") for O(1)
   *  collision detection. Populated alongside every nodeIdToGuid.set() call. */
  assignedGuidValues?: Set<string>
  fontDigestMap?: Map<string, Uint8Array>
  glyphBlobMap?: Map<string, number>
  varIdToGuid?: Map<string, GUID>
  modeIdToGuid?: Map<string, GUID>
  /** Variable GUIDs used only where raw effect aliases cannot retain asset refs. */
  assetRefToVarGuid?: Map<string, GUID>
  /** GUIDs minted for component property IDs (e.g. "prop:abc123") that aren't
   *  already Figma-GUID-shaped, keyed by the original ID so refs/assignments/
   *  variantPropSpecs pointing at the same property reuse the same GUID. */
  propertyIdToGuid: Map<string, GUID>
  componentPropertyDefinitionsById: ReadonlyMap<string, ComponentPropertyDefinition>
  fractionalPosition: (index: number) => string
  mapToFigmaType: (type: SceneNode['type']) => string
  fillToKiwiPaint: (fill: SceneNode['fills'][number]) => Paint
  safeColor: (color: Color) => Color
  computeExportTransform: (node: SceneNode) => Matrix
  serializeCornerRadii: (node: SceneNode, nc: KiwiNodeChange) => void
  serializeTextProps: (
    node: SceneNode,
    nc: KiwiNodeChange,
    graph: SceneGraph,
    fontDigestMap: Map<string, Uint8Array> | undefined,
    blobs: Uint8Array[],
    glyphBlobMap: Map<string, number> | undefined
  ) => void
  serializeLayoutProps: (node: SceneNode, nc: KiwiNodeChange) => void
  serializeGeometry: (node: SceneNode, nc: KiwiNodeChange, blobs: Uint8Array[]) => void
  serializeVariableBindings: (
    node: SceneNode,
    nc: KiwiNodeChange,
    graph: SceneGraph,
    varIdToGuid?: Map<string, GUID>
  ) => void
  sceneNodeToKiwi: (
    node: SceneNode,
    parentGuid: GUID,
    childIndex: number,
    localIdCounter: { value: number },
    context: SceneNodeToKiwiContext
  ) => KiwiNodeChange[]
}

function applyColorVariableBinding(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  paint: Paint,
  field: string
): Paint {
  const variableId = node.boundVariables[field]
  if (!variableId) return paint
  return {
    ...paint,
    colorVariableBinding: {
      variableID: context.varIdToGuid?.get(variableId) ?? stringToGuid(variableId)
    }
  }
}

function createStrokePaints(context: SceneNodeToKiwiContext, node: SceneNode): Paint[] {
  return node.strokes.map((stroke, index) =>
    applyColorVariableBinding(
      context,
      node,
      {
        type: 'SOLID',
        color: context.safeColor(stroke.color),
        opacity: stroke.opacity,
        visible: stroke.visible,
        blendMode: 'NORMAL'
      },
      `strokes/${index}/color`
    )
  )
}

function componentPropertyTypeForKiwi(type: string) {
  if (type === 'BOOLEAN') return 'BOOL'
  return type
}

function componentPropertyValue(
  type: string,
  value: string,
  context: SceneNodeToKiwiContext,
  localIdCounter: { value: number }
) {
  if (type === 'BOOLEAN') return { boolValue: value === 'true' }
  if (type === 'INSTANCE_SWAP') {
    const target = context.graph.getNode(value)
    const guid = target
      ? getOrCreateNodeGuid(context, target.id, localIdCounter)
      : parseGuidOrNull(value)
    return guid ? { guidValue: guid } : { textValue: { characters: value } }
  }
  return { textValue: { characters: value } }
}

function parseGuidOrNull(value: string) {
  return /^\d+:\d+$/.test(value) ? stringToGuid(value) : null
}

function serializeVariableModes(
  node: SceneNode,
  variableIdToGuid?: Map<string, GUID>,
  modeIdToGuid?: Map<string, GUID>
): NonNullable<KiwiNodeChange['variableModeBySetMap']> | undefined {
  const entries = Object.entries(node.variableModes).flatMap(([collectionId, modeId]) => {
    const collectionGuid = variableIdToGuid?.get(collectionId) ?? parseGuidOrNull(collectionId)
    const modeGuid = modeIdToGuid?.get(modeId) ?? parseGuidOrNull(modeId)
    if (!collectionGuid || !modeGuid) return []
    return [{ variableSetID: { guid: collectionGuid }, variableModeID: modeGuid }]
  })
  return entries.length > 0 ? { entries } : undefined
}

const FIGMA_PAYLOAD_VARIABLE_MAP_FIELDS = new Set([
  'variableConsumptionMap',
  'parameterConsumptionMap'
])
const FIGMA_PAYLOAD_PAINT_VARIABLE_FIELDS = new Set(['colorVar', 'opacityVar'])

const SUPPORTED_VARIABLE_DATA_TYPES = new Set([
  'BOOLEAN',
  'FLOAT',
  'STRING',
  'ALIAS',
  'COLOR',
  'SYMBOL_ID',
  'TEXT_DATA',
  'PROP_REF'
])

interface FigmaPayloadVariableMap {
  entries?: unknown[]
}

interface FigmaPayloadVariableMapEntry {
  variableData?: { dataType?: string; value?: { propRefValue?: unknown } }
}

interface ColorVarCarrier {
  colorVar?: {
    value?: {
      alias?: {
        guid?: GUID
        assetRef?: { key: string; version?: string }
      }
    }
  }
}

function isFigmaPayloadVariableMap(value: unknown): value is FigmaPayloadVariableMap {
  return !!value && typeof value === 'object' && !Array.isArray(value) && 'entries' in value
}

function isFigmaPayloadVariableMapEntry(value: unknown): value is FigmaPayloadVariableMapEntry {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isSupportedVariableMapEntry(value: unknown): boolean {
  if (!isFigmaPayloadVariableMapEntry(value)) return false
  const entry = value
  const dataType = entry.variableData?.dataType
  return (
    (typeof dataType === 'string' && SUPPORTED_VARIABLE_DATA_TYPES.has(dataType)) ||
    !!entry.variableData?.value?.propRefValue
  )
}

function isPropRefVariableMapEntry(value: unknown): boolean {
  if (!isFigmaPayloadVariableMapEntry(value)) return false
  const entry = value
  return entry.variableData?.dataType === 'PROP_REF' || !!entry.variableData?.value?.propRefValue
}

function materializeSafeVariableMap(
  value: unknown,
  blobs: Uint8Array[],
  options: MaterializeFigmaPayloadOptions,
  predicate: (value: unknown) => boolean
): unknown {
  if (!isFigmaPayloadVariableMap(value)) return undefined
  const entries = value.entries?.filter(predicate) ?? []
  if (entries.length === 0) return undefined
  return { entries: entries.map((entry) => materializeFigmaPayload(entry, blobs, options)) }
}

interface MaterializeFigmaPayloadOptions {
  blobIndexByHex?: Map<string, number>
  includePaintVariables?: boolean
  includeVariableMaps?: boolean
}

function materializeFigmaBlob(
  value: { __openPencilFigmaBlob?: Uint8Array | Record<string, number> },
  blobs: Uint8Array[],
  options: MaterializeFigmaPayloadOptions
): number {
  const blob = value.__openPencilFigmaBlob
  const bytes = blob instanceof Uint8Array ? blob : new Uint8Array(Object.values(blob ?? {}))
  const key = bytesToHex(bytes)
  const existing = options.blobIndexByHex?.get(key)
  if (existing !== undefined) return existing
  const index = blobs.length
  blobs.push(bytes)
  options.blobIndexByHex?.set(key, index)
  return index
}

function normalizeFigmaPayloadValue(key: string, value: unknown): unknown {
  if (key === 'stackCounterAlignItems' && value === 'STRETCH') return 'MIN'
  if (
    (key === 'stackJustify' ||
      key === 'stackPrimaryAlignItems' ||
      key === 'stackCounterAlign' ||
      key === 'stackCounterAlignItems') &&
    value === 'SPACE_EVENLY'
  ) {
    return 'SPACE_BETWEEN'
  }
  return value
}

function materializeFigmaPayload(
  value: unknown,
  blobs: Uint8Array[],
  options: MaterializeFigmaPayloadOptions = {}
): unknown {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value))
    return value.map((item) => materializeFigmaPayload(item, blobs, options))
  if (!value || typeof value !== 'object') return value
  if ('__openPencilFigmaBlob' in value) {
    return materializeFigmaBlob(
      value as { __openPencilFigmaBlob?: Uint8Array | Record<string, number> },
      blobs,
      options
    )
  }

  const materialized: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (FIGMA_PAYLOAD_PAINT_VARIABLE_FIELDS.has(key) && !options.includePaintVariables) continue
    if (FIGMA_PAYLOAD_VARIABLE_MAP_FIELDS.has(key)) {
      const variableMap = materializeSafeVariableMap(
        child,
        blobs,
        options,
        options.includeVariableMaps ? isSupportedVariableMapEntry : isPropRefVariableMapEntry
      )
      if (variableMap !== undefined) materialized[key] = variableMap
      continue
    }
    materialized[key] = normalizeFigmaPayloadValue(
      key,
      materializeFigmaPayload(child, blobs, options)
    )
  }
  return materialized
}

function resolveInstanceComponentId(context: SceneNodeToKiwiContext, componentId: string): string {
  const seen = new Set<string>()
  let currentId = componentId
  while (!seen.has(currentId)) {
    seen.add(currentId)
    const node = context.graph.getNode(currentId)
    if (node?.type !== 'INSTANCE' || !node.componentId) return currentId
    currentId = node.componentId
  }
  return componentId
}

function getOrCreateNodeGuid(
  context: SceneNodeToKiwiContext,
  nodeId: string,
  localIdCounter: { value: number }
): GUID | undefined {
  const node = context.graph.getNode(nodeId)
  if (!node) return undefined
  const existing = context.nodeIdToGuid?.get(nodeId)
  if (existing) return existing
  const importedGuid = node.source.id ? parseGuidOrNull(node.source.id) : null

  // When source.id maps to a GUID value that is already assigned to a
  // different node (e.g. two nodes from different canvases with the same
  // source.id "1:94"), fall back to the counter to avoid collisions.
  if (importedGuid && context.assignedGuidValues) {
    const key = `${importedGuid.sessionID}:${importedGuid.localID}`
    if (context.assignedGuidValues.has(key)) {
      const guid: GUID = { sessionID: 1, localID: localIdCounter.value++ }
      context.nodeIdToGuid?.set(nodeId, guid)
      context.assignedGuidValues.add(`${guid.sessionID}:${guid.localID}`)
      return guid
    }
  }

  const guid = importedGuid ?? { sessionID: 1, localID: localIdCounter.value++ }
  context.nodeIdToGuid?.set(nodeId, guid)
  context.assignedGuidValues?.add(`${guid.sessionID}:${guid.localID}`)
  return guid
}

/**
 * Component property IDs ("prop:abc123") never match the Figma GUID shape,
 * so parseGuidOrNull always rejects them — mint a stable synthetic GUID from
 * the shared node-id counter instead, memoized so every def/ref/assignment/
 * variantPropSpec pointing at the same property ID round-trips consistently.
 */
function getOrCreatePropertyGuid(
  context: SceneNodeToKiwiContext,
  propertyId: string,
  localIdCounter: { value: number }
): GUID {
  const existing = context.propertyIdToGuid.get(propertyId)
  if (existing) return existing
  const parsed = parseGuidOrNull(propertyId)
  if (parsed) return parsed
  const guid = { sessionID: 1, localID: localIdCounter.value++ }
  context.propertyIdToGuid.set(propertyId, guid)
  context.assignedGuidValues?.add(`${guid.sessionID}:${guid.localID}`)
  return guid
}

function isDescendantOf(context: SceneNodeToKiwiContext, nodeId: string, ancestorId: string) {
  let current = context.graph.getNode(nodeId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    current = context.graph.getNode(current.parentId)
  }
  return false
}

function serializeTextOverrides(
  context: SceneNodeToKiwiContext,
  instance: SceneNode,
  localIdCounter: { value: number }
): KiwiSymbolOverridePayload[] {
  const result: KiwiSymbolOverridePayload[] = []
  forEachInstanceOverride(instance.instanceOverrides, (nodeId, field, value) => {
    if (field !== 'text' || typeof value !== 'string' || !nodeId) return
    const target = context.graph.getNode(nodeId)
    if (!target || !isDescendantOf(context, nodeId, instance.id)) return
    const targetGuid = resolveOverrideTargetGuid(context, target, localIdCounter)
    if (targetGuid)
      result.push({ guidPath: { guids: [targetGuid] }, textData: { characters: value } })
  })
  return result
}

/**
 * Resolves the descendant-node identity a symbol override applies to: the
 * GUID of the corresponding node inside the target's own main component
 * (cloneNodeProps stamps componentId with that node's id on every clone).
 */
function resolveOverrideTargetGuid(
  context: SceneNodeToKiwiContext,
  target: SceneNode,
  localIdCounter: { value: number }
): GUID | undefined {
  const sourceId = target.componentId
  if (!sourceId) return undefined
  const source = context.graph.getNode(sourceId)
  const overrideGuid = source?.overrideKey ? parseGuidOrNull(source.overrideKey) : null
  return overrideGuid ?? getOrCreateNodeGuid(context, sourceId, localIdCounter)
}

function serializeFillOverrides(
  context: SceneNodeToKiwiContext,
  instance: SceneNode,
  localIdCounter: { value: number }
): KiwiSymbolOverridePayload[] {
  const result: KiwiSymbolOverridePayload[] = []
  forEachInstanceOverride(instance.instanceOverrides, (nodeId, field) => {
    if (field !== 'fills' || !nodeId) return
    const target = context.graph.getNode(nodeId)
    if (!target || !isDescendantOf(context, nodeId, instance.id)) return
    const targetGuid = resolveOverrideTargetGuid(context, target, localIdCounter)
    if (targetGuid)
      result.push({
        guidPath: { guids: [targetGuid] },
        fillPaints: target.fills.map((fill) => context.fillToKiwiPaint(fill))
      })
  })
  return result
}

function overridePathKey(payload: KiwiSymbolOverridePayload): string | null {
  const guids = payload.guidPath?.guids
  return guids?.length
    ? guids.map(({ sessionID, localID }) => `${sessionID}:${localID}`).join('/')
    : null
}

function mergeOverrides(
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
    else symbolOverrides[existingIndex] = { ...symbolOverrides[existingIndex], ...override }
  }
}

/**
 * Fields that are ALWAYS set by explicit serialization and must NOT be
 * overwritten by rawNodeFields (which may contain stale Figma defaults).
 * rawNodeFields is a fallback for fields NOT covered by the explicit path.
 *
 * Additionally, applyRawFigmaNodeFields skips any key already present on `nc`,
 * so conditionally-set fields (fontVariations, derivedTextData, strokeJoin,
 * strokeWeight, miterLimit, etc.) are automatically protected when set.
 *
 * NOTE: fillGeometry, strokeGeometry, and vectorData are deliberately NOT
 * listed here. When nodeForGeometryExport suppresses explicit serialization
 * (because raw geometry exists), rawNodeFields must supply these fields.
 */
const RAW_FIELDS_OVERRIDE_BLOCKLIST = new Set([
  // Fields that are structurally dangerous if overwritten by stale raw data:
  'pageType',
  'derivedSymbolData',
  'derivedSymbolDataLayoutVersion',
  'sourceLibraryKey',
  'minSize',
  'maxSize',
  // Variable consumption maps: explicit serialization always sets these when
  // bindings exist, and our VARIABLE_BINDING_FIELDS mapping may produce different
  // kiwi field names than the original raw data for library variable references.
  'variableConsumptionMap',
  'parameterConsumptionMap'
])

/**
 * Resize reflowed this path-text node (glyphs regenerated, strokeGeometry
 * cleared). The raw strokeGeometry silhouettes are still at the pre-resize
 * size, so exporting them would paint stale full-size outlines.
 */
function isReflowedStrokedPathText(node: SceneNode): boolean {
  if (node.type !== 'TEXT' || node.textPathData === null) return false
  if ((node.derivedTextGlyphs?.length ?? 0) === 0 || node.textPathBox === null) return false
  if (node.strokeGeometry.length !== 0) return false
  // Only when the node has stroke paint but its baked silhouettes were
  // cleared by reflow (see resize.ts). Fill-only path text (no stroke paint,
  // so strokeGeometry is always empty) is untouched and keeps its raw
  // derivedTextData verbatim.
  //
  // This must key off live node.strokes, not rawNodeFields.strokeGeometry:
  // clearResizedRawGeometry (resize.ts) deletes that raw field on every
  // resize commit, so it's already gone by the time a reflowed node reaches
  // export and can never be used to detect reflow here.
  return node.strokes.length > 0
}

/**
 * An imported path-text node that was edited after import — moving/rotating
 * clears rawTransform (see clearEditedSourceMetadata), so the transform + size
 * are recomputed from the node's post-expand box (exportNodeTransform /
 * exportNodeSize). But the raw derivedTextData + baked silhouettes are still the
 * PRE-expand (un-shifted) payload — exporting them against the shifted box
 * re-triggers the import expand on reimport and drifts the node. Rebuild
 * derivedTextData from the live (shifted) glyphs and re-derive silhouettes,
 * exactly like the reflow path. rawTransform === null is the "edited" signal;
 * pristine nodes keep rawTransform and their raw payload verbatim.
 */
function isEditedPathText(node: SceneNode): boolean {
  return (
    node.type === 'TEXT' &&
    node.textPathData !== null &&
    // "Edited" = the raw transform no longer backs the node. Editing does not
    // clear source.fig.rawTransform directly; effectiveFigmaSourcePayload
    // derives it from source.editedFields, so ask that, not the raw field.
    effectiveFigmaSourcePayload(node).rawTransform === null &&
    (node.derivedTextGlyphs?.length ?? 0) > 0
  )
}

function applyRawFigmaNodeFields(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange
): void {
  let rawFields = effectiveFigmaRawNodeFields(node)
  if (isReflowedStrokedPathText(node) || isEditedPathText(node)) {
    // Strip before materializing so the stale blobs never enter the file:
    // silhouettes are re-derived from glyphs by Figma/reimport, and
    // derivedTextData was rebuilt from the reflowed glyphs by
    // serializeTextProps (raw would clobber the new positions).
    rawFields = { ...rawFields }
    delete rawFields.strokeGeometry
    delete rawFields.derivedTextData
  }
  const materialized = materializeFigmaPayload(rawFields, context.blobs, {
    blobIndexByHex: context.blobIndexByHex,
    includePaintVariables: true,
    includeVariableMaps: true
  }) as Partial<KiwiNodeChange>
  for (const key of Object.keys(materialized) as (keyof KiwiNodeChange)[]) {
    if (RAW_FIELDS_OVERRIDE_BLOCKLIST.has(String(key))) continue
    // For paint arrays on imported nodes, the raw NC data preserves the
    // original opacity/color.a split (e.g. opacity=0 for invisible strokes).
    // The scene model may lose this distinction for instance children whose
    // strokes are resolved from component overrides. Prefer the raw data.
    if ((key === 'fillPaints' || key === 'strokePaints') && node.source.id) {
      nc[key] = materialized[key]
      continue
    }
    if (
      key === 'effects' &&
      node.source.id &&
      context.assetRefToVarGuid &&
      context.assetRefToVarGuid.size > 0
    ) {
      nc[key] = convertColorVarAssetRefs(materialized[key], context.assetRefToVarGuid)
      continue
    }
    if (key === 'derivedTextData' && node.source.id) {
      nc.derivedTextData = materialized.derivedTextData
      continue
    }
    if (key === 'textDecorationFillPaints' && node.source.id) {
      nc.textDecorationFillPaints = materialized.textDecorationFillPaints
      continue
    }
    // Skip any key already set on nc — explicit serialization takes priority
    if (key in nc) continue
    nc[key] = materialized[key]
  }
}

/** Convert asset refs only for payloads whose Kiwi schema rejects asset-ref aliases. */
function convertColorVarAssetRefs<T>(values: T, assetRefToVarGuid: Map<string, GUID>): T {
  if (!Array.isArray(values)) return values
  const converted = values.map((value: ColorVarCarrier) => {
    const colorVar = value.colorVar
    const alias = colorVar?.value?.alias
    if (!colorVar || !alias || alias.guid || !alias.assetRef?.key) return value
    const assetRef = alias.assetRef
    const lookupKey = assetRef.version ? `${assetRef.key}@${assetRef.version}` : assetRef.key
    const guid = assetRefToVarGuid.get(lookupKey) ?? assetRefToVarGuid.get(assetRef.key)
    if (!guid) return value
    return {
      ...value,
      colorVar: {
        ...colorVar,
        value: { ...colorVar.value, alias: { guid } }
      }
    }
  })
  return converted.some((value, index) => value !== values[index]) ? (converted as T) : values
}

function applyInstancePayload(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange,
  localIdCounter: { value: number }
): void {
  if (node.type !== 'INSTANCE' || !node.componentId) return
  const symbolID = getOrCreateNodeGuid(
    context,
    resolveInstanceComponentId(context, node.componentId),
    localIdCounter
  )
  if (symbolID) {
    const symbolData: Record<string, unknown> = { symbolID }
    const symbolOverrides: KiwiSymbolOverridePayload[] = []
    if (node.source.fig.symbolOverrides.length > 0) {
      symbolOverrides.push(
        ...(materializeFigmaPayload(node.source.fig.symbolOverrides, context.blobs, {
          blobIndexByHex: context.blobIndexByHex,
          includePaintVariables: true,
          includeVariableMaps: true
        }) as KiwiSymbolOverridePayload[])
      )
    }
    mergeOverrides(symbolOverrides, serializeTextOverrides(context, node, localIdCounter))
    mergeOverrides(symbolOverrides, serializeFillOverrides(context, node, localIdCounter))
    if (symbolOverrides.length > 0) symbolData.symbolOverrides = symbolOverrides
    if (node.source.fig.uniformScaleFactor != null) {
      symbolData.uniformScaleFactor = node.source.fig.uniformScaleFactor
    }
    nc.symbolData = symbolData as KiwiNodeChange['symbolData']
  }
  if (
    node.source.fig.componentPropAssignments.length > 0 &&
    !node.source.editedFields.includes('componentPropertyAssignments')
  ) {
    nc.componentPropAssignments = materializeFigmaPayload(
      node.source.fig.componentPropAssignments,
      context.blobs,
      {
        blobIndexByHex: context.blobIndexByHex,
        includePaintVariables: true,
        includeVariableMaps: true
      }
    )
  }
  if (node.source.fig.derivedSymbolData.length > 0) {
    nc.derivedSymbolData = materializeFigmaPayload(
      node.source.fig.derivedSymbolData,
      context.blobs,
      {
        blobIndexByHex: context.blobIndexByHex,
        includePaintVariables: true,
        includeVariableMaps: true
      }
    )
  }
  if (node.source.fig.derivedSymbolDataLayoutVersion != null) {
    nc.derivedSymbolDataLayoutVersion = node.source.fig.derivedSymbolDataLayoutVersion
  }
}

function componentPropertyPreferredValues(
  definition: ComponentPropertyDefinition,
  context: SceneNodeToKiwiContext
) {
  if (definition.type === 'INSTANCE_SWAP' && definition.preferredValues?.length) {
    return {
      instanceSwapValues: definition.preferredValues.map((value) => {
        const target = context.graph.getNode(value)
        const key = target?.componentKey || target?.sourceLibraryKey || value
        return { type: 'COMPONENT', key }
      })
    }
  }
  if (definition.type === 'VARIANT' && definition.variantOptions?.length) {
    return { stringValues: [...definition.variantOptions] }
  }
  return undefined
}

function componentPropertyNodeField(field: ComponentPropertyReferenceField): string {
  if (field === 'TEXT') return 'TEXT_DATA'
  if (field === 'INSTANCE_SWAP') return 'OVERRIDDEN_SYMBOL_ID'
  return 'VISIBLE'
}

export function buildComponentPropIndex(
  graph: SceneGraph
): ReadonlyMap<string, ComponentPropertyDefinition> {
  const definitions = new Map<string, ComponentPropertyDefinition>()
  for (const candidate of graph.getAllNodes()) {
    for (const definition of candidate.componentPropertyDefinitions) {
      if (!definitions.has(definition.id)) definitions.set(definition.id, definition)
    }
  }
  return definitions
}

function shouldSerializeRawBackedField(
  node: SceneNode,
  rawField: string,
  hasValue: boolean,
  alreadySerialized = false
): boolean {
  return hasValue && !(rawField in effectiveFigmaRawNodeFields(node)) && !alreadySerialized
}

function applyComponentMetadata(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange,
  localIdCounter: { value: number }
): void {
  if (node.componentKey) nc.componentKey = node.componentKey
  if (node.sourceLibraryKey) nc.sourceLibraryKey = node.sourceLibraryKey
  const publishId = node.publishId ? parseGuidOrNull(node.publishId) : null
  const overrideKey = node.overrideKey ? parseGuidOrNull(node.overrideKey) : null
  if (publishId) nc.publishID = publishId
  if (overrideKey) nc.overrideKey = overrideKey
  if (node.sharedSymbolVersion) nc.sharedSymbolVersion = node.sharedSymbolVersion
  if (node.publishedVersion) nc.publishedVersion = node.publishedVersion
  if (node.type === 'COMPONENT_SET' || node.isPublishable) nc.isPublishable = node.isPublishable
  if (node.type === 'COMPONENT' || node.isSymbolPublishable) {
    nc.isSymbolPublishable = node.isSymbolPublishable
  }
  if (node.symbolDescription) nc.symbolDescription = node.symbolDescription
  if (node.symbolLinks.length > 0) nc.symbolLinks = structuredClone(node.symbolLinks)
  const componentPropDefs = node.componentPropertyDefinitions.map((def) => ({
    id: getOrCreatePropertyGuid(context, def.id, localIdCounter),
    name: def.name,
    type: componentPropertyTypeForKiwi(def.type),
    initialValue: componentPropertyValue(def.type, def.defaultValue, context, localIdCounter),
    preferredValues: componentPropertyPreferredValues(def, context)
  }))
  if (shouldSerializeRawBackedField(node, 'componentPropDefs', componentPropDefs.length > 0)) {
    nc.componentPropDefs = componentPropDefs
  }

  const componentPropRefs = node.componentPropertyReferences.map((ref) => ({
    defID: getOrCreatePropertyGuid(context, ref.propertyId, localIdCounter),
    componentPropNodeField: componentPropertyNodeField(ref.field)
  }))
  if (shouldSerializeRawBackedField(node, 'componentPropRefs', componentPropRefs.length > 0)) {
    nc.componentPropRefs = componentPropRefs
  }

  const componentPropAssignments = Object.entries(node.componentPropertyAssignments)
    .map(([propertyId, value]) => {
      const definition = context.componentPropertyDefinitionsById.get(propertyId)
      if (!definition) return null
      return {
        defID: getOrCreatePropertyGuid(context, propertyId, localIdCounter),
        value: componentPropertyValue(definition.type, value, context, localIdCounter)
      }
    })
    .filter((assignment): assignment is NonNullable<typeof assignment> => assignment !== null)
  if (
    shouldSerializeRawBackedField(
      node,
      'componentPropAssignments',
      componentPropAssignments.length > 0,
      Boolean(nc.componentPropAssignments)
    )
  ) {
    nc.componentPropAssignments = componentPropAssignments
  }

  const variantPropSpecs = node.variantPropSpecs.map((spec) => ({
    propDefId: getOrCreatePropertyGuid(context, spec.propDefId, localIdCounter),
    value: spec.value
  }))
  if (shouldSerializeRawBackedField(node, 'variantPropSpecs', variantPropSpecs.length > 0)) {
    nc.variantPropSpecs = variantPropSpecs
  }
}

function exportNodeSize(node: SceneNode): Vector {
  // rawSize and rawTransform are a matched pair describing the ORIGINAL Figma
  // box. Once the transform no longer backs the node, exportNodeTransform
  // recomputes it from node dims via computeExportTransform; pairing that with
  // an un-expanded rawSize disagrees about the box (for rotation, a different
  // centre) and the node drifts on reimport. Use rawSize only while the
  // transform still backs it.
  const payload = effectiveFigmaSourcePayload(node)
  return payload.rawSize && payload.rawTransform
    ? { ...payload.rawSize }
    : { x: node.width, y: node.height }
}

function exportNodeTransform(context: SceneNodeToKiwiContext, node: SceneNode): Matrix {
  const rawTransform = effectiveFigmaSourcePayload(node).rawTransform
  return rawTransform ? { ...rawTransform } : context.computeExportTransform(node)
}

function hasRawGeometryPayload(node: SceneNode): boolean {
  const rawNodeFields = effectiveFigmaRawNodeFields(node)
  return 'fillGeometry' in rawNodeFields || 'strokeGeometry' in rawNodeFields
}

function hasRawVectorPayload(node: SceneNode): boolean {
  return 'vectorData' in effectiveFigmaRawNodeFields(node)
}

const SUPPORTED_NORMALIZED_EFFECT_TYPES = new Set([
  'DROP_SHADOW',
  'INNER_SHADOW',
  'LAYER_BLUR',
  'BACKGROUND_BLUR',
  'FOREGROUND_BLUR'
])

function hasRawUnsupportedEffects(node: SceneNode): boolean {
  const effects = effectiveFigmaRawNodeFields(node).effects
  return (
    Array.isArray(effects) &&
    effects.some(
      (effect) =>
        effect &&
        typeof effect === 'object' &&
        'type' in effect &&
        !SUPPORTED_NORMALIZED_EFFECT_TYPES.has(String(effect.type))
    )
  )
}

function nodeForGeometryExport(node: SceneNode): SceneNode {
  if (!hasRawGeometryPayload(node) && !hasRawVectorPayload(node)) return node
  return {
    ...node,
    fillGeometry: hasRawGeometryPayload(node) ? [] : node.fillGeometry,
    strokeGeometry: hasRawGeometryPayload(node) ? [] : node.strokeGeometry,
    vectorNetwork: hasRawVectorPayload(node) ? null : node.vectorNetwork
  }
}

function applySharedStyleProps(node: SceneNode, nc: KiwiNodeChange): void {
  if (node.fillStyleId) nc.styleIdForFill = { guid: stringToGuid(node.fillStyleId) }
  if (node.strokeStyleId) nc.styleIdForStrokeFill = { guid: stringToGuid(node.strokeStyleId) }
  if (node.textStyleId) nc.styleIdForText = { guid: stringToGuid(node.textStyleId) }
  if (node.effectStyleId) nc.styleIdForEffect = { guid: stringToGuid(node.effectStyleId) }
  if (node.gridStyleId) nc.styleIdForGrid = { guid: stringToGuid(node.gridStyleId) }
  if (node.layoutGrids.length > 0) nc.layoutGrids = structuredClone(node.layoutGrids)
  if (node.guides.length > 0) nc.guides = exportCanvasGuides(node.guides)
}

function applyNodeVisualProps(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange
): void {
  if (node.independentStrokeWeights) {
    nc.borderStrokeWeightsIndependent = true
    nc.borderTopWeight = node.borderTopWeight
    nc.borderRightWeight = node.borderRightWeight
    nc.borderBottomWeight = node.borderBottomWeight
    nc.borderLeftWeight = node.borderLeftWeight
  }

  if (node.fills.length > 0) {
    nc.fillPaints = node.fills.map((fill, index) =>
      applyColorVariableBinding(
        context,
        node,
        context.fillToKiwiPaint(fill),
        `fills/${index}/color`
      )
    )
  }

  context.serializeCornerRadii(node, nc)

  if (node.effects.length > 0 && !hasRawUnsupportedEffects(node)) {
    nc.effects = node.effects.map((effect) => ({
      type: effect.type === 'LAYER_BLUR' ? 'FOREGROUND_BLUR' : effect.type,
      color: context.safeColor(effect.color),
      offset: effect.offset,
      radius: effect.radius,
      spread: effect.spread,
      visible: effect.visible,
      blendMode: effect.blendMode ?? 'NORMAL',
      showShadowBehindNode: effect.showShadowBehindNode
    }))
  }

  if (node.type === 'TEXT') {
    context.serializeTextProps(
      node,
      nc,
      context.graph,
      context.fontDigestMap,
      context.blobs,
      context.glyphBlobMap
    )
  }

  if (node.type !== 'VECTOR') nc.frameMaskDisabled = !node.clipsContent
  applySharedStyleProps(node, nc)
  if (node.horizontalConstraint !== 'MIN') nc.horizontalConstraint = node.horizontalConstraint
  if (node.verticalConstraint !== 'MIN') nc.verticalConstraint = node.verticalConstraint
  if (node.strokeCap !== 'NONE') nc.strokeCap = node.strokeCap
  const rawNodeFields = effectiveFigmaRawNodeFields(node)
  if (node.strokeJoin !== 'MITER' || 'strokeJoin' in rawNodeFields) {
    nc.strokeJoin = node.strokeJoin
  }
  if (node.strokeMiterLimit !== DEFAULT_STROKE_MITER_LIMIT || 'miterLimit' in rawNodeFields) {
    nc.miterLimit = node.strokeMiterLimit
  }
  if (node.dashPattern.length > 0) nc.dashPattern = node.dashPattern
  if (node.arcData) {
    nc.arcData = {
      startingAngle: node.arcData.startingAngle,
      endingAngle: node.arcData.endingAngle,
      innerRadius: node.arcData.innerRadius
    }
  }
  if (!node.autoRename) nc.autoRename = false
}

/**
 * Import maps TEXT_PATH → TEXT. Re-emit Kiwi type 41 only while path fidelity
 * remains (materialized path data + baked glyphs). After an edit that cannot
 * reflow glyphs, invalidation clears the path data so export falls back to TEXT.
 */
function exportKiwiNodeType(node: SceneNode, context: SceneNodeToKiwiContext): string {
  const isPathText =
    node.textPathData !== null && node.type === 'TEXT' && (node.derivedTextGlyphs?.length ?? 0) > 0
  return isPathText ? 'TEXT_PATH' : context.mapToFigmaType(node.type)
}

export function sceneNodeToKiwiWithContext(
  node: SceneNode,
  parentGuid: GUID,
  childIndex: number,
  localIdCounter: { value: number },
  context: SceneNodeToKiwiContext
): KiwiNodeChange[] {
  const guid = getOrCreateNodeGuid(context, node.id, localIdCounter) ?? {
    sessionID: 1,
    localID: localIdCounter.value++
  }

  const strokePaints = createStrokePaints(context, node)

  const exportType = exportKiwiNodeType(node, context)

  const nc: KiwiNodeChange = {
    guid,
    parentIndex: {
      guid: parentGuid,
      position: node.source.orderKey ?? context.fractionalPosition(childIndex)
    },
    type: exportType,
    name: node.name,
    visible: node.visible,
    opacity: node.opacity,
    phase: 'CREATED',
    size: exportNodeSize(node),
    transform: exportNodeTransform(context, node)
  }
  if (node.sharedStyleType) nc.styleType = node.sharedStyleType
  if (node.type === 'GROUP') {
    nc.resizeToFit = true
  }
  // Only set strokeWeight/strokeAlign when the node has strokes in the scene
  // model. For imported nodes without strokes but with raw strokeWeight data
  // (e.g. text nodes, instance children with scaled strokes), the raw value
  // must be allowed to flow through via applyRawFigmaNodeFields.
  if (node.strokes.length > 0) {
    nc.strokeWeight = node.strokes[0].weight
    nc.strokeAlign = node.strokes[0].align
  }
  if (node.locked) nc.locked = true

  applyNodeVisualProps(context, node, nc)
  applyComponentMetadata(context, node, nc, localIdCounter)
  applyInstancePayload(context, node, nc, localIdCounter)
  if (node.type === 'COMPONENT_SET') upsertPluginData(node, NODE_TYPE_PLUGIN_KEY, node.type)
  if (nc.type === 'CANVAS') nc.pageType = 'DESIGN'
  if (node.type === 'BOOLEAN_OPERATION')
    nc.booleanOperation = toKiwiBooleanOperation(node.booleanOperation)
  if (strokePaints.length > 0) nc.strokePaints = strokePaints

  context.serializeLayoutProps(node, nc)
  context.serializeGeometry(nodeForGeometryExport(node), nc, context.blobs)
  context.serializeVariableBindings(node, nc, context.graph, context.varIdToGuid)
  applyRawFigmaNodeFields(context, node, nc)
  const variableModeBySetMap = serializeVariableModes(
    node,
    context.varIdToGuid,
    context.modeIdToGuid
  )
  if (variableModeBySetMap) nc.variableModeBySetMap = variableModeBySetMap

  applyExportSettingsPluginData(node)
  applyLibrarySourcePluginData(node)
  applyTextPathBoxPluginData(node)
  const pluginData = mergePluginData(node.pluginData)
  if (pluginData.length > 0) nc.pluginData = pluginData
  if (node.pluginRelaunchData.length > 0) {
    nc.pluginRelaunchData = serializePluginRelaunchData(node.pluginRelaunchData)
  }

  const result: KiwiNodeChange[] = [nc]
  const children =
    node.type === 'INSTANCE'
      ? []
      : context.graph.getChildren(node.id).filter((child) => !child.internalOnly)
  for (let i = 0; i < children.length; i++) {
    result.push(...context.sceneNodeToKiwi(children[i], guid, i, localIdCounter, context))
  }
  return result
}
