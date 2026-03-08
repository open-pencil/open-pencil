export const FIG_KIWI_VERSION = 106

import { deflateSync, inflateSync } from 'fflate'

import { weightToStyle } from './fonts'
import { encodeVectorNetworkBlob } from './vector'

import type { NodeChange, Paint } from './kiwi/codec'
import type { SceneGraph, SceneNode, CharacterStyleOverride } from './scene-graph'

type KiwiNodeChange = NodeChange & Record<string, unknown>

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
    throw new Error('Failed to decompress fig-kiwi data (try async variant for Zstd)')
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

export function buildFigKiwi(schemaDeflated: Uint8Array, dataRaw: Uint8Array): Uint8Array {
  const dataDeflated = deflateSync(dataRaw)

  const total = 8 + 4 + 4 + schemaDeflated.length + 4 + dataDeflated.length
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)

  out.set(new TextEncoder().encode('fig-kiwi'), 0)
  view.setUint32(8, FIG_KIWI_VERSION, true)

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

function exportTextData(node: SceneNode): NodeChange['textData'] {
  const runs = node.styleRuns
  if (runs.length === 0) {
    return { characters: node.text }
  }

  const charIds = new Array<number>(node.text.length).fill(0)
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
      family: style.fontFamily ?? node.fontFamily,
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
    overrideTable.push(override as unknown as NodeChange)
  }

  return {
    characters: node.text,
    characterStyleIDs: charIds,
    styleOverrideTable: overrideTable
  }
}

export function sceneNodeToKiwi(
  node: SceneNode,
  parentGuid: { sessionID: number; localID: number },
  childIndex: number,
  localIdCounter: { value: number },
  graph: SceneGraph,
  blobs: Uint8Array[]
): KiwiNodeChange[] {
  const localID = localIdCounter.value++
  const guid = { sessionID: 1, localID }
  const sx = node.flipX ? -1 : 1
  const cos = Math.cos((node.rotation * Math.PI) / 180)
  const sin = Math.sin((node.rotation * Math.PI) / 180)

  const fillPaints = node.fills.map((f) => {
    const paint: Paint = {
      type: f.type,
      color: f.color,
      opacity: f.opacity,
      visible: f.visible,
      blendMode: f.blendMode ?? 'NORMAL'
    }
    if (f.gradientStops) {
      paint.stops = f.gradientStops.map((s) => ({ color: s.color, position: s.position }))
    }
    if (f.gradientTransform) paint.transform = f.gradientTransform
    if (f.imageHash) paint.image = { hash: f.imageHash }
    if (f.imageScaleMode) paint.imageScaleMode = f.imageScaleMode
    if (f.imageTransform) paint.transform = f.imageTransform
    return paint
  })

  const strokePaints = node.strokes.map((s) => ({
    type: 'SOLID' as const,
    color: s.color,
    opacity: s.opacity,
    visible: s.visible,
    blendMode: 'NORMAL' as const
  }))

  const nc: KiwiNodeChange = {
    guid,
    parentIndex: { guid: parentGuid, position: fractionalPosition(childIndex) },
    type: mapToFigmaType(node.type),
    name: node.name,
    visible: node.visible,
    opacity: node.opacity,
    phase: 'CREATED',
    size: { x: node.width, y: node.height },
    transform: { m00: cos * sx, m01: -sin, m02: node.x, m10: sin * sx, m11: cos, m12: node.y },
    strokeWeight: node.strokes.length > 0 ? node.strokes[0].weight : 1,
    strokeAlign: node.strokes.length > 0 ? node.strokes[0].align : 'INSIDE'
  }

  if (node.independentStrokeWeights) {
    nc.borderStrokeWeightsIndependent = true
    nc.borderTopWeight = node.borderTopWeight
    nc.borderRightWeight = node.borderRightWeight
    nc.borderBottomWeight = node.borderBottomWeight
    nc.borderLeftWeight = node.borderLeftWeight
  }

  if (fillPaints.length > 0) nc.fillPaints = fillPaints
  if (strokePaints.length > 0) nc.strokePaints = strokePaints

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

  if (node.effects.length > 0) {
    nc.effects = node.effects.map((e) => ({
      type: e.type === 'LAYER_BLUR' ? 'FOREGROUND_BLUR' : e.type,
      color: e.color,
      offset: e.offset,
      radius: e.radius,
      spread: e.spread,
      visible: e.visible
    }))
  }

  if (node.type === 'TEXT') {
    nc.fontSize = node.fontSize
    nc.fontName = {
      family: node.fontFamily,
      style: weightToStyle(node.fontWeight, node.italic),
      postscript: ''
    }
    nc.textData = exportTextData(node)
    nc.textAutoResize = 'WIDTH_AND_HEIGHT'
    nc.textAlignHorizontal = node.textAlignHorizontal
    if (node.lineHeight != null) nc.lineHeight = { value: node.lineHeight, units: 'PIXELS' }
    if (node.letterSpacing !== 0) nc.letterSpacing = { value: node.letterSpacing, units: 'PIXELS' }
    if (node.textDecoration !== 'NONE') {
      nc.textDecoration = node.textDecoration === 'UNDERLINE' ? 'UNDERLINE' : 'STRIKETHROUGH'
    }
  }

  if (node.type === 'FRAME' || node.type === 'GROUP') {
    nc.frameMaskDisabled = node.type === 'GROUP'
    if (node.clipsContent) nc.clipsContent = true
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
    nc.stackPrimaryAlignItems = node.primaryAxisAlign
    nc.stackCounterAlignItems = node.counterAxisAlign
    if (node.layoutWrap === 'WRAP') nc.stackWrap = 'WRAP'
    if (node.counterAxisSpacing > 0) nc.stackCounterSpacing = node.counterAxisSpacing
  }

  if (node.layoutPositioning === 'ABSOLUTE') nc.stackPositioning = 'ABSOLUTE'
  if (node.layoutGrow > 0) nc.stackChildPrimaryGrow = node.layoutGrow

  if (node.vectorNetwork && node.type === 'VECTOR') {
    const blobIdx = blobs.length
    blobs.push(encodeVectorNetworkBlob(node.vectorNetwork))
    nc.vectorData = {
      vectorNetworkBlob: blobIdx,
      normalizedSize: { x: node.width, y: node.height }
    }
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

  const result: KiwiNodeChange[] = [nc]
  const children = graph.getChildren(node.id)
  for (let i = 0; i < children.length; i++) {
    result.push(...sceneNodeToKiwi(children[i], guid, i, localIdCounter, graph, blobs))
  }

  return result
}
