import { normalizeFontFamily, weightToStyle } from '@open-pencil/scene-graph'

import { effectiveFigmaRawNodeFields } from '../source-metadata'
import { fractionalPosition, mapToFigmaType } from './basics'
import { bytesToHex, hexToBytes } from './bytes'
import { VARIABLE_BINDING_FIELDS } from './convert'
import { buildDerivedTextData as buildSharedDerivedTextData } from './derived-text-data'
import { EMPTY_EXPORT_RUNTIME, type FigNodeChangeExportRuntime } from './export-runtime'
import { applyFontFeaturesToKiwi } from './font/features'
import { weightToFigmaStyle } from './font/style'
import { encodePathCommandsBlob } from './path-commands'
import {
  BOUND_VARIABLES_PLUGIN_KEY,
  LAYOUT_DIRECTION_PLUGIN_KEY,
  TEXT_DIRECTION_PLUGIN_KEY,
  upsertPluginData
} from './plugin-data'
import { buildStyleOverrideTable, encodeVectorNetworkBlob } from './vector-network'

export {
  buildFigKiwi,
  decompressFigKiwiDataAsync,
  FIG_KIWI_DEFAULT_VERSION,
  parseFigKiwiChunks
} from '@open-pencil/kiwi/fig/container'
import type { NodeChange, Paint, VariableConsumptionEntry } from '@open-pencil/kiwi/fig/codec'
import { guidToString, stringToGuid } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Color, GUID, JsonObject, Matrix } from '@open-pencil/scene-graph/primitives'

import {
  buildAssetRefToVarGuidMap,
  buildComponentPropIndex,
  sceneNodeToKiwiWithContext,
  type KiwiNodeChange
} from './export-node'
import { exportTextData, fontVariationToKiwi } from './text-data-export'

function textLines(text: string): NonNullable<NodeChange['textData']>['lines'] {
  const lineCount = Math.max(1, text.split('\n').length)
  return Array.from({ length: lineCount }, () => ({ lineType: 'PLAIN' }))
}

function appendGlyphBlob(
  blobs: Uint8Array[],
  glyphBlobMap: Map<string, number>,
  blob: Uint8Array
): number {
  const key = bytesToHex(blob)
  const existing = glyphBlobMap.get(key)
  if (existing !== undefined) return existing
  const index = blobs.push(blob) - 1
  glyphBlobMap.set(key, index)
  return index
}

function buildDerivedTextData(
  node: SceneNode,
  digestMap: Map<string, Uint8Array>,
  blobs: Uint8Array[],
  glyphBlobMap: Map<string, number>,
  runtime: FigNodeChangeExportRuntime
): NodeChange['derivedTextData'] {
  const fontMeta: NonNullable<NodeChange['derivedTextData']>['fontMetaData'] = []
  const seen = new Set<string>()

  const addFont = (family: string, weight: number, italic: boolean) => {
    const style = weightToStyle(weight, italic)
    const normalized = normalizeFontFamily(family)
    const key = `${normalized}|${style}`
    if (seen.has(key)) return
    seen.add(key)
    fontMeta.push({
      key: { family: normalized, style: weightToFigmaStyle(weight, italic), postscript: '' },
      fontLineHeight: 1.2,
      fontDigest: digestMap.get(key),
      fontStyle: italic ? 'ITALIC' : 'NORMAL',
      fontWeight: weight
    })
  }

  addFont(node.fontFamily, node.fontWeight, node.italic)
  for (const run of node.styleRuns) {
    addFont(
      run.style.fontFamily ?? node.fontFamily,
      run.style.fontWeight ?? node.fontWeight,
      run.style.italic ?? node.italic
    )
  }

  const lineHeight = node.lineHeight ?? Math.ceil(node.fontSize * 1.2)
  const glyphAdvance = node.text.length > 0 ? node.width / Math.max(node.text.length, 1) : 0

  const derivedGlyphs = node.figmaDerivedTextGlyphs ?? []
  const glyphs =
    derivedGlyphs.length > 0
      ? derivedGlyphs.map((glyph, index) => ({
          commandsBlob: appendGlyphBlob(blobs, glyphBlobMap, glyph.commandsBlob),
          position: { x: glyph.x, y: glyph.y },
          fontSize: glyph.fontSize,
          firstCharacter: index,
          advance:
            index + 1 < derivedGlyphs.length
              ? Math.max(derivedGlyphs[index + 1].x - glyph.x, 0)
              : glyphAdvance,
          rotation: 0
        }))
      : (
          runtime.getGlyphOutlineMetrics(
            node.fontFamily,
            weightToStyle(node.fontWeight, node.italic),
            node.text,
            node.fontSize
          ) ?? []
        ).map((glyph, index) => ({
          commandsBlob: appendGlyphBlob(
            blobs,
            glyphBlobMap,
            encodePathCommandsBlob(glyph.commands, node.fontSize)
          ),
          position: { x: glyph.x || index * glyphAdvance, y: lineHeight },
          fontSize: node.fontSize,
          firstCharacter: index,
          advance: glyph.advance || glyphAdvance,
          rotation: 0
        }))

  const logicalIndexToCharacterOffsetMap = Array.from(
    { length: node.text.length + 1 },
    (_, index) => index * glyphAdvance
  )

  return buildSharedDerivedTextData({
    node,
    glyphs,
    fontMetaData: fontMeta,
    baseline: lineHeight,
    width: node.width,
    lineHeight,
    lineAscent: Math.max(lineHeight - node.fontSize * 0.2, 0),
    logicalIndexToCharacterOffsetMap
  })
}

export function safeColor(c: Color | Omit<Color, 'a'>): Color {
  return { r: c.r, g: c.g, b: c.b, a: 'a' in c ? c.a : 1 }
}

function fillToKiwiPaint(f: SceneNode['fills'][number]): Paint {
  const paint: Paint = {
    type: f.type,
    color: safeColor(f.color),
    opacity: f.opacity,
    visible: f.visible,
    blendMode: f.blendMode ?? 'NORMAL'
  }
  if (f.gradientStops) {
    paint.stops = f.gradientStops.map((s) => ({ color: safeColor(s.color), position: s.position }))
  }
  if (f.gradientTransform) paint.transform = f.gradientTransform
  if (f.imageHash) paint.image = { hash: hexToBytes(f.imageHash) }
  if (f.imageScaleMode) paint.imageScaleMode = f.imageScaleMode
  if (f.imageTransform) paint.transform = f.imageTransform
  if (f.sourceNodeId) paint.sourceNodeId = stringToGuid(f.sourceNodeId)
  if (f.scale) paint.scale = f.scale
  if (f.spacing) paint.spacing = f.spacing
  if (f.patternSpacing) paint.patternSpacing = f.patternSpacing
  if (f.patternTileType) paint.patternTileType = f.patternTileType
  if (f.verticalAlignment) paint.verticalAlignment = f.verticalAlignment
  if (f.horizontalAlignment) paint.horizontalAlignment = f.horizontalAlignment
  if (f.noiseType) paint.noiseType = f.noiseType
  if (f.density !== undefined) paint.density = f.density
  if (f.noiseSize) paint.noiseSize = f.noiseSize
  if (f.customEffectId) paint.customEffectId = { guid: stringToGuid(f.customEffectId) }
  return paint
}

function serializeCornerRadii(node: SceneNode, nc: KiwiNodeChange): void {
  const anyIndividual =
    node.topLeftRadius > 0 ||
    node.topRightRadius > 0 ||
    node.bottomLeftRadius > 0 ||
    node.bottomRightRadius > 0
  if (node.cornerRadius > 0) nc.cornerRadius = node.cornerRadius
  // Always emit individual radii when present.  A node may have
  // independentCorners=false with non-zero individual values (e.g. imported
  // from Figma where the flag wasn't set but per-corner values exist).
  if (anyIndividual || node.independentCorners) {
    // For imported nodes, preserve the original independentCorners flag from
    // the raw Figma data. Figma may emit per-corner radii without setting the
    // independent flag (preserve rectangleCornerRadiiIndependent).
    const rawIndependent = node.source.id
      ? (effectiveFigmaRawNodeFields(node) as JsonObject | undefined)
          ?.rectangleCornerRadiiIndependent
      : undefined
    nc.rectangleCornerRadiiIndependent =
      typeof rawIndependent === 'boolean' ? rawIndependent : node.independentCorners
    nc.rectangleTopLeftCornerRadius = node.topLeftRadius
    nc.rectangleTopRightCornerRadius = node.topRightRadius
    nc.rectangleBottomLeftCornerRadius = node.bottomLeftRadius
    nc.rectangleBottomRightCornerRadius = node.bottomRightRadius
  }
  if (node.cornerSmoothing > 0 || 'cornerSmoothing' in effectiveFigmaRawNodeFields(node)) {
    nc.cornerSmoothing = node.cornerSmoothing
  }
}

function resolveTextAutoResize(node: SceneNode, graph: SceneGraph): SceneNode['textAutoResize'] {
  // For nodes imported from .fig files, preserve the original textAutoResize
  // value. Forcing 'HEIGHT' for fixed-height text inside auto-layout causes
  // layout drift on roundtrip.
  if (node.source.id) return node.textAutoResize
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  if (
    parent &&
    parent.layoutMode !== 'NONE' &&
    parent.layoutMode !== 'GRID' &&
    node.layoutPositioning !== 'ABSOLUTE'
  ) {
    return 'HEIGHT'
  }
  return node.textAutoResize
}

function serializeTextProps(
  node: SceneNode,
  nc: KiwiNodeChange,
  graph: SceneGraph,
  fontDigestMap: Map<string, Uint8Array> | undefined,
  blobs: Uint8Array[],
  glyphBlobMap: Map<string, number> | undefined,
  runtime: FigNodeChangeExportRuntime
): void {
  upsertPluginData(node, TEXT_DIRECTION_PLUGIN_KEY, node.textDirection)
  nc.fontSize = node.fontSize
  nc.fontName = {
    family: normalizeFontFamily(node.fontFamily),
    style: weightToFigmaStyle(node.fontWeight, node.italic),
    postscript: ''
  }
  nc.textData = exportTextData(node, textLines, fillToKiwiPaint)
  if (node.fontVariations.length > 0) {
    nc.fontVariations = node.fontVariations.map(fontVariationToKiwi)
  }
  const autoResize = resolveTextAutoResize(node, graph)
  nc.textAutoResize = autoResize
  nc.textAlignHorizontal = node.textAlignHorizontal
  nc.textAlignVertical = node.textAlignVertical
  nc.textUserLayoutVersion = 4
  nc.textExplicitLayoutVersion = 1
  nc.textBidiVersion = 1
  nc.textDecorationSkipInk = node.textDecorationSkipInk
  nc.fontVariantCommonLigatures = true
  nc.fontVariantContextualLigatures = true
  applyFontFeaturesToKiwi(nc, node.fontFeatures)
  nc.fontVersion = ''
  nc.emojiImageSet = 'APPLE'
  if (node.textCase !== 'ORIGINAL') nc.textCase = node.textCase
  if (node.textTruncation === 'ENDING') nc.textTruncation = 'ENDING'
  if (node.maxLines != null) nc.maxLines = node.maxLines
  if (fontDigestMap) {
    nc.derivedTextData = buildDerivedTextData(
      node,
      fontDigestMap,
      blobs,
      glyphBlobMap ?? new Map(),
      runtime
    )
  }
  if (node.leadingTrim !== 'NONE') nc.leadingTrim = node.leadingTrim
  if (node.lineHeight != null) nc.lineHeight = { value: node.lineHeight, units: 'PIXELS' }
  nc.letterSpacing = { value: node.letterSpacing, units: 'PIXELS' }
  if (node.textDecoration !== 'NONE') {
    nc.textDecoration = node.textDecoration === 'UNDERLINE' ? 'UNDERLINE' : 'STRIKETHROUGH'
  }
  if (node.textDecorationStyle !== 'SOLID') nc.textDecorationStyle = node.textDecorationStyle
  if (node.textDecorationThickness != null) {
    nc.textDecorationThickness = { value: node.textDecorationThickness, units: 'PIXELS' }
  }
  if (node.textUnderlineOffset != null) {
    nc.textUnderlineOffset = { value: node.textUnderlineOffset, units: 'PIXELS' }
  }
  if (node.textDecorationFills.length > 0) {
    nc.textDecorationFillPaints = node.textDecorationFills.map(fillToKiwiPaint)
  }
}

function normalizeStackMode(value: string | undefined): KiwiNodeChange['stackMode'] {
  return value === 'HORIZONTAL' || value === 'VERTICAL' || value === 'NONE' ? value : undefined
}

function normalizeStackSizing(value: string | undefined): KiwiNodeChange['stackPrimarySizing'] {
  return value === 'FIXED' ||
    value === 'RESIZE_TO_FIT' ||
    value === 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE'
    ? value
    : undefined
}

function normalizeStackJustify(value: string | undefined): string | undefined {
  return value === 'SPACE_EVENLY' ? 'SPACE_BETWEEN' : value
}

function normalizeStackCounterAlign(value: string | undefined): string | undefined {
  return value === 'SPACE_EVENLY' ? 'SPACE_BETWEEN' : value
}

function preserveTrailingPadding(
  explicitValue: number | undefined,
  leadingValue: number | undefined,
  baseValue: number | undefined,
  normalizedValue: number
): number | undefined {
  if (explicitValue !== undefined) return explicitValue
  const inheritedValue = leadingValue ?? baseValue ?? normalizedValue
  return normalizedValue !== inheritedValue ? normalizedValue : undefined
}

function serializeLayoutProps(node: SceneNode, nc: KiwiNodeChange): void {
  if (!node.source.id) upsertPluginData(node, LAYOUT_DIRECTION_PLUGIN_KEY, node.layoutDirection)
  const figLayout = node.source.fig.layout
  if (figLayout) {
    nc.stackMode = normalizeStackMode(figLayout.stackMode)
    nc.stackSpacing = figLayout.stackSpacing
    nc.stackPadding = figLayout.stackPadding
    nc.stackPaddingRight = preserveTrailingPadding(
      figLayout.stackPaddingRight,
      figLayout.stackHorizontalPadding,
      figLayout.stackPadding,
      node.paddingRight
    )
    nc.stackPaddingBottom = preserveTrailingPadding(
      figLayout.stackPaddingBottom,
      figLayout.stackVerticalPadding,
      figLayout.stackPadding,
      node.paddingBottom
    )
    nc.stackCounterAlign = normalizeStackCounterAlign(figLayout.stackCounterAlign)
    nc.stackJustify = normalizeStackJustify(figLayout.stackJustify)
    nc.stackCounterAlignItems = normalizeStackCounterAlign(figLayout.stackCounterAlignItems)
    nc.stackPrimaryAlignItems = normalizeStackJustify(figLayout.stackPrimaryAlignItems)
    // For imported nodes, figLayout captures the original kiwi NC values.
    // Preserve omitted sizing fields instead of materializing schema defaults.
    const stackPrimarySizing = normalizeStackSizing(figLayout.stackPrimarySizing)
    if (stackPrimarySizing) nc.stackPrimarySizing = stackPrimarySizing
    const stackCounterSizing = normalizeStackSizing(figLayout.stackCounterSizing)
    if (stackCounterSizing) nc.stackCounterSizing = stackCounterSizing
    nc.stackVerticalPadding = figLayout.stackVerticalPadding
    nc.stackHorizontalPadding = figLayout.stackHorizontalPadding
    nc.stackWrap = figLayout.stackWrap
    nc.stackPositioning = figLayout.stackPositioning
    nc.stackChildPrimaryGrow = figLayout.stackChildPrimaryGrow
    nc.stackChildAlignSelf = figLayout.stackChildAlignSelf
    nc.stackCounterSpacing = figLayout.stackCounterSpacing
    nc.bordersTakeSpace = figLayout.bordersTakeSpace
    if (figLayout.stackReverseZIndex) nc.stackReverseZIndex = true
    return
  }
  if (node.layoutMode !== 'NONE' && node.layoutMode !== 'GRID') {
    nc.stackMode = node.layoutMode
    nc.stackSpacing = node.itemSpacing
    nc.stackVerticalPadding = node.paddingTop
    nc.stackHorizontalPadding = node.paddingLeft
    nc.stackPaddingBottom = node.paddingBottom
    nc.stackPaddingRight = node.paddingRight
    nc.stackPrimarySizing = node.primaryAxisSizing === 'HUG' ? 'RESIZE_TO_FIT' : 'FIXED'
    nc.stackCounterSizing = node.counterAxisSizing === 'HUG' ? 'RESIZE_TO_FIT' : 'FIXED'
    nc.stackPrimaryAlignItems = normalizeStackJustify(node.primaryAxisAlign)
    nc.stackCounterAlignItems = normalizeStackCounterAlign(node.counterAxisAlign)
    if (node.layoutWrap === 'WRAP') nc.stackWrap = 'WRAP'
    if (node.counterAxisSpacing > 0) nc.stackCounterSpacing = node.counterAxisSpacing
    nc.bordersTakeSpace = node.strokesIncludedInLayout
  }
  if (node.itemReverseZIndex) nc.stackReverseZIndex = true
  if (node.layoutPositioning === 'ABSOLUTE') nc.stackPositioning = 'ABSOLUTE'
  if (node.layoutGrow > 0) nc.stackChildPrimaryGrow = node.layoutGrow
  if (node.layoutAlignSelf !== 'AUTO') {
    nc.stackChildAlignSelf = node.layoutAlignSelf
  }
}

function serializeGeometry(node: SceneNode, nc: KiwiNodeChange, blobs: Uint8Array[]): void {
  if (node.isMask) {
    nc.mask = true
    nc.maskType = node.maskType
    if (node.maskIsOutline) nc.maskIsOutline = true
  }
  if (node.vectorNetwork && node.type === 'VECTOR') {
    const { table, mirroringToId } = buildStyleOverrideTable(node.vectorNetwork)
    const blobIdx = blobs.length
    blobs.push(encodeVectorNetworkBlob(node.vectorNetwork, mirroringToId))
    const vectorData: Record<string, unknown> = {
      vectorNetworkBlob: blobIdx,
      normalizedSize: { x: node.width, y: node.height }
    }
    if (table.length > 0) {
      vectorData.styleOverrideTable = table
    }
    nc.vectorData = vectorData
  }
  if (node.fillGeometry.length > 0) {
    nc.fillGeometry = node.fillGeometry.map((g) => {
      const blobIdx = blobs.length
      blobs.push(g.commandsBlob)
      return { windingRule: g.windingRule, commandsBlob: blobIdx }
    })
  }
  if (node.strokeGeometry.length > 0) {
    nc.strokeGeometry = node.strokeGeometry.map((g) => {
      const blobIdx = blobs.length
      blobs.push(g.commandsBlob)
      return { windingRule: g.windingRule, commandsBlob: blobIdx }
    })
  }
}

function serializeVariableBindings(
  node: SceneNode,
  nc: KiwiNodeChange,
  graph: SceneGraph,
  varIdToGuid?: Map<string, GUID>
): void {
  if (Object.keys(node.boundVariables).length === 0) return
  const entries: VariableConsumptionEntry[] = []
  const roundtripBindings: Record<string, string> = {}
  const typeMap: Record<string, string> = { COLOR: 'COLOR', BOOLEAN: 'BOOLEAN', STRING: 'STRING' }
  for (const [field, varId] of Object.entries(node.boundVariables)) {
    const variable = graph.variables.get(varId)
    if (!variable) continue
    const varGuid = varIdToGuid?.get(varId) ?? stringToGuid(varId)
    roundtripBindings[field] = guidToString(varGuid)

    const kiwiField = VARIABLE_BINDING_FIELDS[field]
    if (!kiwiField) continue
    const resolvedType = typeMap[variable.type] ?? 'FLOAT'
    entries.push({
      variableData: {
        value: { alias: { guid: varGuid } },
        dataType: 'ALIAS',
        resolvedDataType: resolvedType
      },
      variableField: kiwiField
    })
  }
  if (Object.keys(roundtripBindings).length > 0) {
    upsertPluginData(node, BOUND_VARIABLES_PLUGIN_KEY, JSON.stringify(roundtripBindings))
  }
  if (entries.length > 0) nc.variableConsumptionMap = { entries }
}

function computeExportTransform(node: SceneNode): Matrix {
  const sx = node.flipX ? -1 : 1
  const cos = Math.cos((node.rotation * Math.PI) / 180)
  const sin = Math.sin((node.rotation * Math.PI) / 180)

  const m00 = cos * sx
  const m01 = -sin
  const m10 = sin * sx
  const m11 = cos
  const corners = [
    { x: 0, y: 0 },
    { x: node.width, y: 0 },
    { x: 0, y: node.height },
    { x: node.width, y: node.height }
  ].map((point) => ({
    x: m00 * point.x + m01 * point.y,
    y: m10 * point.x + m11 * point.y
  }))
  const offsetX = Math.min(...corners.map((point) => point.x))
  const offsetY = Math.min(...corners.map((point) => point.y))

  return {
    m00,
    m01,
    m02: node.x - offsetX,
    m10,
    m11,
    m12: node.y - offsetY
  }
}

export function sceneNodeToKiwi(
  node: SceneNode,
  parentGuid: GUID,
  childIndex: number,
  localIdCounter: { value: number },
  graph: SceneGraph,
  blobs: Uint8Array[],
  nodeIdToGuid?: Map<string, GUID>,
  fontDigestMap?: Map<string, Uint8Array>,
  varIdToGuid?: Map<string, GUID>,
  glyphBlobMap = new Map<string, number>(),
  blobIndexByHex?: Map<string, number>,
  assignedGuidValues?: Set<string>,
  runtime: FigNodeChangeExportRuntime = EMPTY_EXPORT_RUNTIME,
  componentPropertyDefinitionsById = buildComponentPropIndex(graph),
  modeIdToGuid?: Map<string, GUID>
): KiwiNodeChange[] {
  // Raw paints retain library asset refs; effects use this map because their
  // Kiwi schema accepts only GUID-backed aliases.
  const assetRefToVarGuid = varIdToGuid ? buildAssetRefToVarGuidMap(graph, varIdToGuid) : undefined
  return sceneNodeToKiwiWithContext(node, parentGuid, childIndex, localIdCounter, {
    graph,
    blobs,
    blobIndexByHex,
    nodeIdToGuid,
    assignedGuidValues,
    fontDigestMap,
    glyphBlobMap,
    varIdToGuid,
    modeIdToGuid,
    assetRefToVarGuid,
    componentPropertyDefinitionsById,
    fractionalPosition,
    mapToFigmaType,
    fillToKiwiPaint,
    safeColor,
    computeExportTransform,
    serializeCornerRadii,
    serializeTextProps: (textNode, nc, textGraph, digests, textBlobs, glyphs) =>
      serializeTextProps(textNode, nc, textGraph, digests, textBlobs, glyphs, runtime),
    serializeLayoutProps,
    serializeGeometry,
    serializeVariableBindings,
    sceneNodeToKiwi: sceneNodeToKiwiWithContext
  })
}

const IDENTITY_TRANSFORM = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
const DEFAULT_STROKE_WEIGHT = 1

export function makeDocumentNodeChange(
  guid: GUID,
  documentColorSpace: 'srgb' | 'display-p3' = 'display-p3'
): NodeChange & Record<string, unknown> {
  return {
    guid,
    type: 'DOCUMENT',
    name: 'Document',
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    transform: { ...IDENTITY_TRANSFORM },
    strokeWeight: DEFAULT_STROKE_WEIGHT,
    strokeAlign: 'CENTER',
    strokeJoin: 'MITER',
    documentColorProfile: documentColorSpace === 'display-p3' ? 'DISPLAY_P3' : 'SRGB'
  }
}

export function makeCanvasNodeChange(
  guid: GUID,
  parentGuid: GUID,
  position: string,
  name: string,
  extra?: Record<string, unknown>
): NodeChange & Record<string, unknown> {
  return {
    guid,
    parentIndex: { guid: parentGuid, position },
    type: 'CANVAS',
    name,
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    transform: { ...IDENTITY_TRANSFORM },
    strokeWeight: DEFAULT_STROKE_WEIGHT,
    strokeAlign: 'CENTER',
    strokeJoin: 'MITER',
    pageType: 'DESIGN',
    ...extra
  }
}
