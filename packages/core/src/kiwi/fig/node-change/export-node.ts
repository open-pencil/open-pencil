import { bytesToHex } from '#core/bytes/hex'
import type { NodeChange, Paint, Effect as KiwiEffect } from '#core/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '#core/scene-graph'
import type { Color, GUID, Matrix, Vector } from '#core/types'

import { stringToGuid } from './guid'
import {
  mergePluginData,
  NODE_TYPE_PLUGIN_KEY,
  serializePluginRelaunchData,
  upsertPluginData
} from './plugin-data'

export type KiwiNodeChange = NodeChange & Record<string, unknown>

interface SceneNodeToKiwiContext {
  graph: SceneGraph
  blobs: Uint8Array[]
  blobIndexByHex?: Map<string, number>
  nodeIdToGuid?: Map<string, GUID>
  fontDigestMap?: Map<string, Uint8Array>
  glyphBlobMap?: Map<string, number>
  varIdToGuid?: Map<string, GUID>
  paintVariableColorMap?: Map<string, Color>
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

const DEFAULT_STROKE_WEIGHT = 1

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

const KIWI_COMPONENT_PROP_TYPE: Record<string, string> = {
  BOOLEAN: 'BOOL',
  TEXT: 'TEXT',
  INSTANCE_SWAP: 'INSTANCE_SWAP',
  VARIANT: 'VARIANT'
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

function isSupportedVariableMapEntry(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const entry = value as {
    variableData?: { dataType?: string; value?: { propRefValue?: unknown } }
  }
  const dataType = entry.variableData?.dataType
  return (
    (typeof dataType === 'string' && SUPPORTED_VARIABLE_DATA_TYPES.has(dataType)) ||
    !!entry.variableData?.value?.propRefValue
  )
}

function isPropRefVariableMapEntry(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const entry = value as {
    variableData?: { dataType?: string; value?: { propRefValue?: unknown } }
  }
  return entry.variableData?.dataType === 'PROP_REF' || !!entry.variableData?.value?.propRefValue
}

function materializeSafeVariableMap(
  value: unknown,
  blobs: Uint8Array[],
  options: MaterializeFigmaPayloadOptions,
  predicate: (value: unknown) => boolean
): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entries = (value as { entries?: unknown[] }).entries?.filter(predicate) ?? []
  if (entries.length === 0) return undefined
  return { entries: entries.map((entry) => materializeFigmaPayload(entry, blobs, options)) }
}

function paintVariableKey(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const assetRef = (
    value as { value?: { alias?: { assetRef?: { key?: unknown; version?: unknown } } } }
  ).value?.alias?.assetRef
  return typeof assetRef?.key === 'string'
    ? `${assetRef.key}:${typeof assetRef.version === 'string' ? assetRef.version : ''}`
    : null
}

interface MaterializeFigmaPayloadOptions {
  blobIndexByHex?: Map<string, number>
  includePaintVariables?: boolean
  includeVariableMaps?: boolean
  paintVariableColorMap?: Map<string, Color>
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
  const paintVariableColor = options.paintVariableColorMap?.get(
    paintVariableKey((value as { colorVar?: unknown }).colorVar) ?? ''
  )
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
  if (paintVariableColor) materialized.color = paintVariableColor
  return materialized
}

function collectPaintVariableColorCounts(
  value: unknown,
  counts: Map<string, Map<string, { color: Color; count: number }>>
): void {
  if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === 'object') collectPaintVariableColorCounts(item, counts)
    }
    return
  }

  const paint = value as { color?: Color; colorVar?: unknown }
  const key = paintVariableKey(paint.colorVar)
  if (key && paint.color) {
    const colorKey = [paint.color.r, paint.color.g, paint.color.b, paint.color.a]
      .map((component) => Math.round(component * 255))
      .join(',')
    const colorCounts = counts.get(key) ?? new Map<string, { color: Color; count: number }>()
    const current = colorCounts.get(colorKey)
    colorCounts.set(colorKey, { color: paint.color, count: (current?.count ?? 0) + 1 })
    counts.set(key, colorCounts)
  }

  for (const child of Object.values(value)) collectPaintVariableColorCounts(child, counts)
}

export function buildFigmaPaintVariableColorMap(graph: SceneGraph): Map<string, Color> {
  const counts = new Map<string, Map<string, { color: Color; count: number }>>()
  for (const node of graph.nodes.values()) {
    collectPaintVariableColorCounts(node.source.fig.rawNodeFields, counts)
    collectPaintVariableColorCounts(node.source.fig.symbolOverrides, counts)
    collectPaintVariableColorCounts(node.source.fig.componentPropAssignments, counts)
    collectPaintVariableColorCounts(node.source.fig.derivedSymbolData, counts)
  }

  const colors = new Map<string, Color>()
  for (const [key, colorCounts] of counts) {
    const [mostCommon] = [...colorCounts.values()].sort((a, b) => b.count - a.count)
    colors.set(key, mostCommon.color)
  }
  return colors
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
  if (!context.graph.getNode(nodeId)) return undefined
  const existing = context.nodeIdToGuid?.get(nodeId)
  if (existing) return existing
  const node = context.graph.getNode(nodeId)
  const importedGuid = node?.source.id ? parseGuidOrNull(node.source.id) : null
  const guid = importedGuid ?? { sessionID: 1, localID: localIdCounter.value++ }
  context.nodeIdToGuid?.set(nodeId, guid)
  return guid
}

function applyRawFigmaNodeFields(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange
): void {
  Object.assign(
    nc,
    materializeFigmaPayload(node.source.fig.rawNodeFields, context.blobs, {
      blobIndexByHex: context.blobIndexByHex
    })
  )
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
          includeVariableMaps: true,
          paintVariableColorMap: context.paintVariableColorMap
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
        includeVariableMaps: true,
        paintVariableColorMap: context.paintVariableColorMap
      }
    )
  }
  if (node.source.fig.derivedSymbolData.length > 0) {
    nc.derivedSymbolData = materializeFigmaPayload(
      node.source.fig.derivedSymbolData,
      context.blobs,
      {
        blobIndexByHex: context.blobIndexByHex,
        includeVariableMaps: true,
        paintVariableColorMap: context.paintVariableColorMap
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
            type: KIWI_COMPONENT_PROP_TYPE[def.type] ?? def.type,
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
  return node.source.fig.rawSize
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

  if (node.effects.length > 0) {
    nc.effects = node.effects.map((effect) => {
      const base = {
        type: effect.type === 'LAYER_BLUR' ? 'FOREGROUND_BLUR' : effect.type,
        radius: effect.radius,
        visible: effect.visible
      } as KiwiEffect
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        const shadow = effect
        base.color = context.safeColor(shadow.color)
        base.offset = shadow.offset
        base.spread = shadow.spread
        base.showShadowBehindNode = shadow.showShadowBehindNode
      }
      return base
    })
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

  const nc: KiwiNodeChange = {
    guid,
    parentIndex: {
      guid: parentGuid,
      position: node.source.orderKey ?? context.fractionalPosition(childIndex)
    },
    type: context.mapToFigmaType(node.type),
    name: node.name,
    visible: node.visible,
    opacity: node.opacity,
    phase: 'CREATED',
    size: exportNodeSize(node),
    transform: exportNodeTransform(context, node),
    strokeWeight: node.strokes[0]?.weight ?? DEFAULT_STROKE_WEIGHT,
    strokeAlign: node.strokes[0]?.align ?? 'INSIDE'
  }

  applyNodeVisualProps(context, node, nc)
  applyComponentMetadata(node, nc)
  applyInstancePayload(context, node, nc, localIdCounter)
  if (node.type === 'COMPONENT_SET') upsertPluginData(node, NODE_TYPE_PLUGIN_KEY, node.type)
  if (nc.type === 'CANVAS') nc.pageType = 'DESIGN'
  if (strokePaints.length > 0) nc.strokePaints = strokePaints

  context.serializeLayoutProps(node, nc)
  context.serializeGeometry(nodeForGeometryExport(node), nc, context.blobs)
  context.serializeVariableBindings(node, nc, context.graph, context.varIdToGuid)
  applyRawFigmaNodeFields(context, node, nc)

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
