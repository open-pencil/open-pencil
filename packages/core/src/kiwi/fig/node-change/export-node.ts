import type { NodeChange, Paint } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Color, GUID, Matrix, Vector } from '@open-pencil/scene-graph/primitives'

/* eslint-disable max-lines */
import { bytesToHex } from '#core/bytes/hex'

import {
  applyExportSettingsPluginData,
  applyTextPathBoxPluginData,
  mergePluginData,
  NODE_TYPE_PLUGIN_KEY,
  serializePluginRelaunchData,
  upsertPluginData
} from './plugin-data'

export type KiwiNodeChange = NodeChange & Record<string, unknown>

type KiwiBooleanOperation = NonNullable<NodeChange['booleanOperation']>

function toKiwiBooleanOperation(operation: SceneNode['booleanOperation']): KiwiBooleanOperation {
  return operation === 'EXCLUDE' ? 'XOR' : (operation ?? 'UNION')
}

/**
 * Build a mapping from assetRef key strings ("key@version" or "key") to
 * variable GUIDs. This is used to convert colorVar.assetRef references in raw
 * paint data to guid references that resolveAliasId can resolve on reimport.
 */
export function buildAssetRefToVarGuidMap(
  graph: SceneGraph,
  varIdToGuid: Map<string, GUID>
): Map<string, GUID> {
  const map = new Map<string, GUID>()
  for (const [varId, variable] of graph.variables) {
    if (!variable.key) continue
    const guid = varIdToGuid.get(varId) ?? stringToGuid(varId)
    map.set(variable.key, guid)
    if (variable.version) {
      map.set(`${variable.key}@${variable.version}`, guid)
    }
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
  /** Maps "key@version" or "key" (from variable.key/version) → variable GUID.
   * Used to convert colorVar.assetRef references in raw paints to guid references. */
  assetRefToVarGuid?: Map<string, GUID>
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

function componentPropertyValue(value: string) {
  return { textValue: { characters: value } }
}

function componentPropertyTypeForKiwi(type: string) {
  if (type === 'BOOLEAN') return 'BOOL'
  if (type === 'VARIANT') return 'TEXT'
  return type
}

function parseGuidOrNull(value: string) {
  return /^\d+:\d+$/.test(value) ? stringToGuid(value) : null
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
  'componentPropAssignments',
  'sourceLibraryKey',
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
  if (node.type !== 'TEXT' || node.source.fig.kiwiNodeType !== 'TEXT_PATH') return false
  if ((node.figmaDerivedTextGlyphs?.length ?? 0) === 0 || node.textPathBox === null) return false
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
    node.source.fig.kiwiNodeType === 'TEXT_PATH' &&
    node.source.fig.rawTransform === null &&
    (node.figmaDerivedTextGlyphs?.length ?? 0) > 0
  )
}

function applyRawFigmaNodeFields(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange
): void {
  let rawFields = node.source.fig.rawNodeFields
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
      let paints = materialized[key]
      // Convert colorVar.assetRef references to guid references so that
      // resolveAliasId can resolve them on reimport. Raw paints from the
      // original .fig file use assetRef (library key/version) to refer to
      // variables, but on reimport buildAssetRefMap won't find the key unless
      // our VARIABLE NodeChanges also have key/version set. Even with that,
      // converting to guid is more robust — it works even for local variables
      // that don't have library keys.
      if (context.assetRefToVarGuid && context.assetRefToVarGuid.size > 0) {
        paints = convertColorVarAssetRefs(paints, context.assetRefToVarGuid)
      }
      nc[key] = paints
      continue
    }
    // Also convert colorVar.assetRef in raw effects (e.g. shadow color variables)
    if (
      key === 'effects' &&
      node.source.id &&
      context.assetRefToVarGuid &&
      context.assetRefToVarGuid.size > 0
    ) {
      const converted = convertColorVarAssetRefs(materialized[key], context.assetRefToVarGuid)
      nc[key] = converted
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

/**
 * Convert colorVar.assetRef references in paints to guid references.
 * Raw paint data from imported .fig files uses assetRef (library key) for
 * variable references. On reimport, buildAssetRefMap needs nc.key on VARIABLE
 * NodeChanges to resolve assetRefs. Converting from assetRef to guid makes the
 * reference resolvable regardless of whether key/version is present on the
 * VARIABLE NodeChange.
 */
function convertColorVarAssetRefs<T>(paints: T, assetRefToVarGuid: Map<string, GUID>): T {
  if (!Array.isArray(paints)) return paints
  const result = paints.map((paint: ColorVarCarrier) => {
    const colorVar = paint.colorVar
    const value = colorVar?.value
    const alias = value?.alias
    if (!colorVar || !value || !alias) return paint
    if (alias.guid) return paint
    const assetRef = alias.assetRef
    if (!assetRef?.key) return paint
    // Look up by key@version first, then by key alone
    const lookupKey = assetRef.version ? `${assetRef.key}@${assetRef.version}` : assetRef.key
    const guid = assetRefToVarGuid.get(lookupKey) ?? assetRefToVarGuid.get(assetRef.key)
    if (!guid) return paint
    return {
      ...paint,
      colorVar: {
        ...colorVar,
        value: {
          ...value,
          alias: { guid }
        }
      }
    }
  })
  // Check if any paint was actually changed (skip expensive JSON comparison)
  for (let i = 0; i < paints.length; i++) {
    if (result[i] !== paints[i]) return result as T
  }
  return paints
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
    if (node.source.fig.symbolOverrides.length > 0) {
      symbolData.symbolOverrides = materializeFigmaPayload(
        node.source.fig.symbolOverrides,
        context.blobs,
        {
          blobIndexByHex: context.blobIndexByHex,
          includePaintVariables: true,
          includeVariableMaps: true
        }
      )
    }
    if (node.source.fig.uniformScaleFactor != null) {
      symbolData.uniformScaleFactor = node.source.fig.uniformScaleFactor
    }
    nc.symbolData = symbolData as KiwiNodeChange['symbolData']
  }
  if (node.source.fig.componentPropAssignments.length > 0) {
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

function applyComponentMetadata(node: SceneNode, nc: KiwiNodeChange): void {
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
  const componentPropDefs = node.componentPropertyDefinitions
    .map((def) => {
      const id = parseGuidOrNull(def.id)
      return id
        ? {
            id,
            name: def.name,
            type: componentPropertyTypeForKiwi(def.type),
            initialValue: componentPropertyValue(def.defaultValue)
          }
        : null
    })
    .filter((def): def is NonNullable<typeof def> => def !== null)
  if (componentPropDefs.length > 0) nc.componentPropDefs = componentPropDefs

  const variantPropSpecs = node.variantPropSpecs
    .map((spec) => {
      const propDefId = parseGuidOrNull(spec.propDefId)
      return propDefId ? { propDefId, value: spec.value } : null
    })
    .filter((spec): spec is NonNullable<typeof spec> => spec !== null)
  if (variantPropSpecs.length > 0) nc.variantPropSpecs = variantPropSpecs
}

function exportNodeSize(node: SceneNode): Vector {
  // rawSize and rawTransform are a matched pair describing the ORIGINAL Figma
  // box. Editing a node (move/rotate) clears rawTransform, so exportNodeTransform
  // recomputes it from node dims via computeExportTransform. Pairing that
  // node-dims transform with an un-expanded rawSize disagrees about the box
  // (different origin, and for rotation a different centre) and the node drifts
  // on reimport. Use rawSize only while rawTransform still backs it; once edited,
  // size comes from node dims to match the recomputed transform.
  return node.source.fig.rawSize && node.source.fig.rawTransform
    ? { ...node.source.fig.rawSize }
    : { x: node.width, y: node.height }
}

function exportNodeTransform(context: SceneNodeToKiwiContext, node: SceneNode): Matrix {
  return node.source.fig.rawTransform
    ? { ...node.source.fig.rawTransform }
    : context.computeExportTransform(node)
}

function hasRawGeometryPayload(node: SceneNode): boolean {
  return (
    'fillGeometry' in node.source.fig.rawNodeFields ||
    'strokeGeometry' in node.source.fig.rawNodeFields
  )
}

function hasRawVectorPayload(node: SceneNode): boolean {
  return 'vectorData' in node.source.fig.rawNodeFields
}

const SUPPORTED_NORMALIZED_EFFECT_TYPES = new Set([
  'DROP_SHADOW',
  'INNER_SHADOW',
  'LAYER_BLUR',
  'BACKGROUND_BLUR',
  'FOREGROUND_BLUR'
])

function hasRawUnsupportedEffects(node: SceneNode): boolean {
  const effects = node.source.fig.rawNodeFields.effects
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
  if (node.horizontalConstraint !== 'MIN') nc.horizontalConstraint = node.horizontalConstraint
  if (node.verticalConstraint !== 'MIN') nc.verticalConstraint = node.verticalConstraint
  if (node.strokeCap !== 'NONE') nc.strokeCap = node.strokeCap
  if (node.strokeJoin !== 'MITER') nc.strokeJoin = node.strokeJoin
  if (!node.source.id && node.strokeMiterLimit !== 28.96) nc.miterLimit = node.strokeMiterLimit
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

  // Import maps TEXT_PATH → TEXT. Re-emit Kiwi type 41 only while path fidelity
  // remains (marker + baked glyphs). After the user edits characters we clear
  // both — exporting TEXT_PATH without glyphs would be a lie to Figma.
  const kiwiNodeType = node.source.fig.kiwiNodeType
  const exportType =
    kiwiNodeType === 'TEXT_PATH' &&
    node.type === 'TEXT' &&
    (node.figmaDerivedTextGlyphs?.length ?? 0) > 0
      ? 'TEXT_PATH'
      : context.mapToFigmaType(node.type)

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
  applyComponentMetadata(node, nc)
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

  applyExportSettingsPluginData(node)
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
