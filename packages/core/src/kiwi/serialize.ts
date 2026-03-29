export const FIG_KIWI_DEFAULT_VERSION = 101

import { deflateSync, inflateSync } from 'fflate'

import { getGlyphOutlineCommandsSync } from '../clipboard-text-outlines'
import { getLoadedFontData, normalizeFontFamily, weightToStyle } from '../text/fonts'
import { encodeVectorNetworkBlob, buildStyleOverrideTable } from '../vector'
import { stringToGuid, VARIABLE_BINDING_FIELDS } from './convert'
import { sceneNodeToKiwiWithContext, type KiwiNodeChange } from './node-export'

import type { SceneGraph, SceneNode, CharacterStyleOverride } from '../scene-graph'
import type { Color, GUID, Matrix } from '../types'
import type { NodeChange, Paint, VariableConsumptionEntry } from './codec'

const fontDigestCache = new Map<string, Uint8Array>()
const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'
const TEXT_DIRECTION_PLUGIN_KEY = 'textDirection'
const LAYOUT_DIRECTION_PLUGIN_KEY = 'layoutDirection'

function upsertPluginData(node: SceneNode, key: string, value: string): void {
  const pluginData = node.pluginData.filter(
    (entry) => !(entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === key)
  )
  pluginData.push({ pluginId: OPEN_PENCIL_PLUGIN_ID, key, value })
  node.pluginData = pluginData
}

async function computeFontDigest(data: ArrayBuffer): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined') {
    const hash = await crypto.subtle.digest('SHA-1', data)
    return new Uint8Array(hash)
  }
  return new Uint8Array(20)
}

async function getFontDigest(family: string, style: string): Promise<Uint8Array | null> {
  const key = `${family}|${style}`
  const cached = fontDigestCache.get(key)
  if (cached) return cached
  const data = getLoadedFontData(family, style)
  if (!data) return null
  const digest = await computeFontDigest(data)
  fontDigestCache.set(key, digest)
  return digest
}

export async function buildFontDigestMap(graph: SceneGraph): Promise<Map<string, Uint8Array>> {
  const fontKeys = new Set<string>()
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'TEXT') continue
    const baseStyle = weightToStyle(node.fontWeight, node.italic)
    fontKeys.add(`${node.fontFamily}|${baseStyle}`)
    for (const run of node.styleRuns) {
      const family = run.style.fontFamily ?? node.fontFamily
      const weight = run.style.fontWeight ?? node.fontWeight
      const italic = run.style.italic ?? node.italic
      fontKeys.add(`${family}|${weightToStyle(weight, italic)}`)
    }
  }

  const result = new Map<string, Uint8Array>()
  for (const key of fontKeys) {
    const [family, style] = key.split('|')
    const digest = await getFontDigest(family, style)
    if (digest) result.set(key, digest)
  }
  return result
}

export function parseFigKiwiChunks(binary: Uint8Array): Uint8Array[] | null {
  const header = new TextDecoder().decode(binary.slice(0, 8))
  if (header !== 'fig-kiwi') return null

  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength)
  let offset = 12

  const chunks: Uint8Array[] = []
  while (offset < binary.length) {
    const chunkLen = view.getUint32(offset, true)
    offset += 4
    chunks.push(binary.slice(offset, offset + chunkLen))
    offset += chunkLen
  }
  return chunks.length >= 2 ? chunks : null
}

export function decompressFigKiwiData(compressed: Uint8Array): Uint8Array {
  try {
    return inflateSync(compressed)
  } catch {
    throw new Error('Failed to decompress fig-kiwi data')
  }
}

export async function decompressFigKiwiDataAsync(compressed: Uint8Array): Promise<Uint8Array> {
  try {
    return inflateSync(compressed)
  } catch {
    const fzstd = await import('fzstd')
    return fzstd.decompress(compressed)
  }
}

export function buildFigKiwi(
  schemaDeflated: Uint8Array,
  dataRaw: Uint8Array,
  version = FIG_KIWI_DEFAULT_VERSION
): Uint8Array {
  const dataDeflated = deflateSync(dataRaw)

  const total = 8 + 4 + 4 + schemaDeflated.length + 4 + dataDeflated.length
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)

  out.set(new TextEncoder().encode('fig-kiwi'), 0)
  view.setUint32(8, version, true)

  let offset = 12
  view.setUint32(offset, schemaDeflated.length, true)
  offset += 4
  out.set(schemaDeflated, offset)
  offset += schemaDeflated.length

  view.setUint32(offset, dataDeflated.length, true)
  offset += 4
  out.set(dataDeflated, offset)

  return out
}

export function mapToFigmaType(type: SceneNode['type']): string {
  switch (type) {
    case 'FRAME':
      return 'FRAME'
    case 'RECTANGLE':
      return 'RECTANGLE'
    case 'ROUNDED_RECTANGLE':
      return 'ROUNDED_RECTANGLE'
    case 'ELLIPSE':
      return 'ELLIPSE'
    case 'TEXT':
      return 'TEXT'
    case 'LINE':
      return 'LINE'
    case 'STAR':
      return 'STAR'
    case 'POLYGON':
      return 'REGULAR_POLYGON'
    case 'VECTOR':
      return 'VECTOR'
    case 'GROUP':
      return 'FRAME'
    case 'SECTION':
      return 'SECTION'
    case 'COMPONENT':
      return 'SYMBOL'
    case 'COMPONENT_SET':
      return 'SYMBOL'
    case 'INSTANCE':
      return 'INSTANCE'
    case 'CONNECTOR':
      return 'CONNECTOR'
    case 'SHAPE_WITH_TEXT':
      return 'SHAPE_WITH_TEXT'
    default:
      return 'RECTANGLE'
  }
}

export function fractionalPosition(index: number): string {
  return String.fromCharCode('!'.charCodeAt(0) + index)
}

function textLines(text: string): NonNullable<NodeChange['textData']>['lines'] {
  const lineCount = Math.max(1, text.split('\n').length)
  return Array.from({ length: lineCount }, () => ({ lineType: 'PLAIN' }))
}

function buildDerivedTextData(
  node: SceneNode,
  digestMap: Map<string, Uint8Array>
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
      key: { family: normalized, style, postscript: '' },
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

  const style = weightToStyle(node.fontWeight, node.italic)
  const glyphCommandLists = getGlyphOutlineCommandsSync(node.fontFamily, style, node.text, node.fontSize) ?? []
  const lineHeight = node.lineHeight ?? Math.ceil(node.fontSize * 1.2)
  const glyphAdvance = node.text.length > 0 ? node.width / Math.max(node.text.length, 1) : 0

  const glyphs = glyphCommandLists.map((commands, index) => ({
    commands,
    position: { x: index * glyphAdvance, y: lineHeight },
    fontSize: node.fontSize,
    firstCharacter: index,
    advance: glyphAdvance,
    rotation: 0
  }))

  const logicalIndexToCharacterOffsetMap = Array.from({ length: node.text.length + 1 }, (_, index) =>
    index * glyphAdvance
  )

  return {
    layoutSize: { x: node.width, y: node.height },
    baselines: [
      {
        firstCharacter: 0,
        endCharacter: Math.max(node.text.length - 1, 0),
        position: { x: 0, y: lineHeight },
        width: node.width,
        lineHeight,
        lineAscent: Math.max(lineHeight - (node.fontSize * 0.2), 0)
      }
    ],
    glyphs,
    fontMetaData: fontMeta,
    logicalIndexToCharacterOffsetMap,
    derivedLines: [{ directionality: 'LTR' }],
    truncationStartIndex: -1,
    truncatedHeight: -1
  }
}

function exportTextData(node: SceneNode): NodeChange['textData'] {
  const runs = node.styleRuns
  if (runs.length === 0) {
    return { characters: node.text, lines: textLines(node.text) }
  }

  const charIds = Array.from<number>({ length: node.text.length }).fill(0)
  const styleMap = new Map<string, { id: number; style: CharacterStyleOverride }>()
  let nextId = 1

  for (const run of runs) {
    const key = JSON.stringify(run.style)
    let entry = styleMap.get(key)
    if (!entry) {
      entry = { id: nextId++, style: run.style }
      styleMap.set(key, entry)
    }
    for (let i = run.start; i < run.start + run.length && i < charIds.length; i++) {
      charIds[i] = entry.id
    }
  }

  const overrideTable: NodeChange[] = []
  for (const { id, style } of styleMap.values()) {
    const override: Record<string, unknown> = { styleID: id }
    const weight = style.fontWeight ?? node.fontWeight
    const italic = style.italic ?? node.italic
    override.fontName = {
      family: normalizeFontFamily(style.fontFamily ?? node.fontFamily),
      style: weightToStyle(weight, italic),
      postscript: ''
    }
    if (style.fontSize !== undefined) override.fontSize = style.fontSize
    if (style.letterSpacing !== undefined) {
      override.letterSpacing = { value: style.letterSpacing, units: 'PIXELS' }
    }
    if (style.lineHeight !== undefined && style.lineHeight !== null) {
      override.lineHeight = { value: style.lineHeight, units: 'PIXELS' }
    }
    if (style.textDecoration) override.textDecoration = style.textDecoration
    if (style.fills && style.fills.length > 0) {
      override.fillPaints = style.fills.map(fillToKiwiPaint)
    }
    overrideTable.push(override as unknown as NodeChange)
  }

  return {
    characters: node.text,
    lines: textLines(node.text),
    characterStyleIDs: charIds,
    styleOverrideTable: overrideTable
  }
}

export function safeColor(c: { r: number; g: number; b: number; a?: number }): Color {
  return { r: c.r, g: c.g, b: c.b, a: c.a ?? 1 }
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
  if (f.imageHash) paint.image = { hash: f.imageHash }
  if (f.imageScaleMode) paint.imageScaleMode = f.imageScaleMode
  if (f.imageTransform) paint.transform = f.imageTransform
  return paint
}

function serializeCornerRadii(node: SceneNode, nc: KiwiNodeChange): void {
  if (node.cornerRadius > 0 || node.independentCorners) {
    nc.cornerRadius = node.cornerRadius
    nc.rectangleCornerRadiiIndependent = node.independentCorners
    nc.rectangleTopLeftCornerRadius = node.independentCorners
      ? node.topLeftRadius
      : node.cornerRadius
    nc.rectangleTopRightCornerRadius = node.independentCorners
      ? node.topRightRadius
      : node.cornerRadius
    nc.rectangleBottomLeftCornerRadius = node.independentCorners
      ? node.bottomLeftRadius
      : node.cornerRadius
    nc.rectangleBottomRightCornerRadius = node.independentCorners
      ? node.bottomRightRadius
      : node.cornerRadius
  }
  if (node.cornerSmoothing > 0) {
    nc.cornerSmoothing = node.cornerSmoothing
  }
}

function resolveTextAutoResize(node: SceneNode, graph: SceneGraph): SceneNode['textAutoResize'] {
  if (node.textAutoResize === 'NONE') return 'NONE'
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  if (
    parent &&
    parent.layoutMode !== 'NONE' &&
    parent.layoutMode !== 'GRID' &&
    node.layoutPositioning !== 'ABSOLUTE'
  ) {
    return 'NONE'
  }
  return node.textAutoResize
}

function serializeTextProps(
  node: SceneNode,
  nc: KiwiNodeChange,
  graph: SceneGraph,
  fontDigestMap?: Map<string, Uint8Array>
): void {
  upsertPluginData(node, TEXT_DIRECTION_PLUGIN_KEY, node.textDirection)
  nc.fontSize = node.fontSize
  nc.fontName = {
    family: normalizeFontFamily(node.fontFamily),
    style: weightToStyle(node.fontWeight, node.italic),
    postscript: ''
  }
  nc.textData = exportTextData(node)
  const autoResize = resolveTextAutoResize(node, graph)
  if (autoResize !== 'NONE') nc.textAutoResize = autoResize
  nc.textAlignHorizontal = node.textAlignHorizontal
  nc.textUserLayoutVersion = 4
  if (fontDigestMap) nc.derivedTextData = buildDerivedTextData(node, fontDigestMap)
  // Figma needs explicit lineHeight to compute text bounding boxes.
  // Without it (and without baselines/glyphs data), text gets 0 height.
  const lh = node.lineHeight != null ? node.lineHeight : Math.ceil(node.fontSize * 1.2)
  nc.lineHeight = { value: lh, units: 'PIXELS' }
  if (node.letterSpacing !== 0) nc.letterSpacing = { value: node.letterSpacing, units: 'PIXELS' }
  if (node.textDecoration !== 'NONE') {
    nc.textDecoration = node.textDecoration === 'UNDERLINE' ? 'UNDERLINE' : 'STRIKETHROUGH'
  }
}

function serializeLayoutProps(node: SceneNode, nc: KiwiNodeChange): void {
  upsertPluginData(node, LAYOUT_DIRECTION_PLUGIN_KEY, node.layoutDirection)
  if (node.layoutMode !== 'NONE' && node.layoutMode !== 'GRID') {
    nc.stackMode = node.layoutMode
    nc.stackSpacing = node.itemSpacing
    nc.stackVerticalPadding = node.paddingTop
    nc.stackHorizontalPadding = node.paddingLeft
    nc.stackPaddingBottom = node.paddingBottom
    nc.stackPaddingRight = node.paddingRight
    nc.stackPrimarySizing = node.primaryAxisSizing === 'HUG' ? 'RESIZE_TO_FIT' : 'FIXED'
    nc.stackCounterSizing = node.counterAxisSizing === 'HUG' ? 'RESIZE_TO_FIT' : 'FIXED'
    nc.stackPrimaryAlignItems = node.primaryAxisAlign
    nc.stackCounterAlignItems = node.counterAxisAlign
    if (node.layoutWrap === 'WRAP') nc.stackWrap = 'WRAP'
    if (node.counterAxisSpacing > 0) nc.stackCounterSpacing = node.counterAxisSpacing
    nc.bordersTakeSpace = node.strokesIncludedInLayout
  }
  if (node.layoutPositioning === 'ABSOLUTE') nc.stackPositioning = 'ABSOLUTE'
  if (node.layoutGrow > 0) nc.stackChildPrimaryGrow = node.layoutGrow
  if (node.layoutAlignSelf !== 'AUTO') {
    nc.stackChildAlignSelf = node.layoutAlignSelf
  }
}

function serializeGeometry(node: SceneNode, nc: KiwiNodeChange, blobs: Uint8Array[]): void {
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
  const typeMap: Record<string, string> = { COLOR: 'COLOR', BOOLEAN: 'BOOLEAN', STRING: 'STRING' }
  for (const [field, varId] of Object.entries(node.boundVariables)) {
    const kiwiField = VARIABLE_BINDING_FIELDS[field]
    if (!kiwiField) continue
    const variable = graph.variables.get(varId)
    if (!variable) continue
    const varGuid = varIdToGuid?.get(varId) ?? stringToGuid(varId)
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
  if (entries.length > 0) nc.variableConsumptionMap = { entries }
}

function computeExportTransform(node: SceneNode, graph: SceneGraph): Matrix {
  const sx = node.flipX ? -1 : 1
  const cos = Math.cos((node.rotation * Math.PI) / 180)
  const sin = Math.sin((node.rotation * Math.PI) / 180)

  // Auto-layout children should have (0,0) transform — Figma computes
  // their positions from the layout engine at render time.
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  const isAutoLayoutChild =
    parent &&
    parent.layoutMode !== 'NONE' &&
    parent.layoutMode !== 'GRID' &&
    node.layoutPositioning !== 'ABSOLUTE'

  return {
    m00: cos * sx,
    m01: -sin,
    m02: isAutoLayoutChild ? 0 : node.x,
    m10: sin * sx,
    m11: cos,
    m12: isAutoLayoutChild ? 0 : node.y
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
  varIdToGuid?: Map<string, GUID>
): KiwiNodeChange[] {
  return sceneNodeToKiwiWithContext(node, parentGuid, childIndex, localIdCounter, {
    graph,
    blobs,
    nodeIdToGuid,
    fontDigestMap,
    varIdToGuid,
    fractionalPosition,
    mapToFigmaType,
    fillToKiwiPaint,
    safeColor,
    computeExportTransform,
    serializeCornerRadii,
    serializeTextProps,
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
    ...extra
  }
}
