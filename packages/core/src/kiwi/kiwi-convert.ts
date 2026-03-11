/* eslint-disable max-lines -- kiwi↔scene conversion helpers are tightly coupled */
import { normalizeColor } from '../color'
import { DEFAULT_FONT_FAMILY, DEFAULT_STROKE_MITER_LIMIT } from '../constants'
import { styleToWeight } from '../fonts'
import { decodeVectorNetworkBlob } from '../vector'
import type { Matrix, Vector } from '../types'

import type {
  SceneNode,
  NodeType,
  Fill,
  FillType,
  Stroke,
  Effect,
  BlendMode,
  ImageScaleMode,
  GradientTransform,
  StrokeCap,
  StrokeJoin,
  LayoutMode,
  LayoutSizing,
  LayoutAlign,
  LayoutAlignSelf,
  LayoutCounterAlign,
  ConstraintType,
  TextAutoResize,
  TextAlignVertical,
  TextCase,
  TextDecoration,
  ArcData,
  VectorNetwork,
  GeometryPath,
  StyleRun,
  CharacterStyleOverride,
  WindingRule
} from '../scene-graph'
import type { NodeChange, Paint, Effect as KiwiEffect, GUID } from './codec'



export function guidToString(guid: GUID): string {
  return `${guid.sessionID}:${guid.localID}`
}

export function stringToGuid(str: string): GUID {
  const [session, local] = str.split(':')
  return { sessionID: parseInt(session, 10), localID: parseInt(local, 10) }
}

export const VARIABLE_BINDING_FIELDS: Record<string, string> = {
  cornerRadius: 'CORNER_RADIUS',
  topLeftRadius: 'RECTANGLE_TOP_LEFT_CORNER_RADIUS',
  topRightRadius: 'RECTANGLE_TOP_RIGHT_CORNER_RADIUS',
  bottomLeftRadius: 'RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS',
  bottomRightRadius: 'RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS',
  strokeWeight: 'STROKE_WEIGHT',
  itemSpacing: 'STACK_SPACING',
  paddingLeft: 'STACK_PADDING_LEFT',
  paddingTop: 'STACK_PADDING_TOP',
  paddingRight: 'STACK_PADDING_RIGHT',
  paddingBottom: 'STACK_PADDING_BOTTOM',
  counterAxisSpacing: 'STACK_COUNTER_SPACING',
  visible: 'VISIBLE',
  opacity: 'OPACITY',
  width: 'WIDTH',
  height: 'HEIGHT',
  fontSize: 'FONT_SIZE',
  letterSpacing: 'LETTER_SPACING',
  lineHeight: 'LINE_HEIGHT'
}

export const VARIABLE_BINDING_FIELDS_INVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(VARIABLE_BINDING_FIELDS).map(([k, v]) => [v, k])
)

const convertColor = normalizeColor

function imageHashToString(hash: Record<string, number>): string {
  const bytes = Object.keys(hash)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => hash[Number(k)])
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function convertGradientTransform(t?: Matrix): GradientTransform | undefined {
  if (!t) return undefined
  return { m00: t.m00, m01: t.m01, m02: t.m02, m10: t.m10, m11: t.m11, m12: t.m12 }
}

export function convertFills(paints?: Paint[]): Fill[] {
  if (!paints) return []
  return paints.map((p) => {
    const base: Fill = {
      type: p.type as FillType,
      color: convertColor(p.color),
      opacity: p.opacity ?? 1,
      visible: p.visible ?? true,
      blendMode: (p.blendMode ?? 'NORMAL') as BlendMode
    }

    if (p.type.startsWith('GRADIENT') && p.stops) {
      base.gradientStops = p.stops.map((s) => ({
        color: convertColor(s.color),
        position: s.position
      }))
      if (p.transform) {
        base.gradientTransform = convertGradientTransform(p.transform)
      }
    }

    if (p.type === 'IMAGE') {
      if (p.image && typeof p.image === 'object') {
        const img = p.image as { hash: string | Record<string, number> }
        if (typeof img.hash === 'object') {
          base.imageHash = imageHashToString(img.hash)
        } else if (typeof img.hash === 'string') {
          base.imageHash = img.hash
        }
      }
      base.imageScaleMode = (p.imageScaleMode ?? 'FILL') as ImageScaleMode
      if (p.transform) {
        base.imageTransform = convertGradientTransform(p.transform)
      }
    }

    return base
  })
}

export function convertStrokes(
  paints?: Paint[],
  weight?: number,
  align?: string,
  cap?: string,
  join?: string,
  dashPattern?: number[]
): Stroke[] {
  if (!paints) return []
  return paints.map((p) => ({
    color: convertColor(p.color),
    weight: weight ?? 1,
    opacity: p.opacity ?? 1,
    visible: p.visible ?? true,
    align: (align === 'INSIDE'
      ? 'INSIDE'
      : (align === 'OUTSIDE'
        ? 'OUTSIDE'
        : 'CENTER')),
    cap: (cap ?? 'NONE') as StrokeCap,
    join: (join ?? 'MITER') as StrokeJoin,
    dashPattern: dashPattern ?? []
  }))
}

export function convertEffects(effects?: KiwiEffect[]): Effect[] {
  if (!effects) return []
  return effects.map((e) => ({
    type: e.type,
    color: convertColor(e.color),
    offset: e.offset ?? { x: 0, y: 0 },
    radius: e.radius ?? 0,
    spread: e.spread ?? 0,
    visible: e.visible ?? true,
    blendMode: (e.blendMode ?? 'NORMAL') as BlendMode
  }))
}

const NODE_TYPE_MAP: Record<string, NodeType | 'DOCUMENT' | 'VARIABLE'> = {
  DOCUMENT: 'DOCUMENT',
  VARIABLE: 'VARIABLE',
  CANVAS: 'CANVAS',
  FRAME: 'FRAME',
  RECTANGLE: 'RECTANGLE',
  ROUNDED_RECTANGLE: 'ROUNDED_RECTANGLE',
  ELLIPSE: 'ELLIPSE',
  TEXT: 'TEXT',
  LINE: 'LINE',
  STAR: 'STAR',
  REGULAR_POLYGON: 'POLYGON',
  VECTOR: 'VECTOR',
  BOOLEAN_OPERATION: 'VECTOR',
  GROUP: 'GROUP',
  SECTION: 'SECTION',
  COMPONENT: 'COMPONENT',
  COMPONENT_SET: 'COMPONENT_SET',
  INSTANCE: 'INSTANCE',
  SYMBOL: 'COMPONENT',
  CONNECTOR: 'CONNECTOR',
  SHAPE_WITH_TEXT: 'SHAPE_WITH_TEXT'
}

function mapNodeType(type?: string): NodeType | 'DOCUMENT' | 'VARIABLE' {
  if (type) return NODE_TYPE_MAP[type] ?? 'RECTANGLE'
  return 'RECTANGLE'
}

function mapStackMode(mode?: string): LayoutMode {
  switch (mode) {
    case 'HORIZONTAL':
      return 'HORIZONTAL'
    case 'VERTICAL':
      return 'VERTICAL'
    default:
      return 'NONE'
  }
}

export function mapStackSizing(sizing?: string): LayoutSizing {
  switch (sizing) {
    case 'RESIZE_TO_FIT':
    case 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE':
      return 'HUG'
    case 'FILL':
      return 'FILL'
    default:
      return 'FIXED'
  }
}

export function mapStackJustify(justify?: string): LayoutAlign {
  switch (justify) {
    case 'CENTER':
      return 'CENTER'
    case 'MAX':
      return 'MAX'
    case 'SPACE_BETWEEN':
      return 'SPACE_BETWEEN'
    default:
      return 'MIN'
  }
}

export function mapStackCounterAlign(align?: string): LayoutCounterAlign {
  switch (align) {
    case 'CENTER':
      return 'CENTER'
    case 'MAX':
      return 'MAX'
    case 'STRETCH':
      return 'STRETCH'
    case 'BASELINE':
      return 'BASELINE'
    default:
      return 'MIN'
  }
}

export function mapAlignSelf(align?: string): LayoutAlignSelf {
  switch (align) {
    case 'MIN':
      return 'MIN'
    case 'CENTER':
      return 'CENTER'
    case 'MAX':
      return 'MAX'
    case 'STRETCH':
      return 'STRETCH'
    case 'BASELINE':
      return 'BASELINE'
    default:
      return 'AUTO'
  }
}

function mapConstraint(c?: string): ConstraintType {
  switch (c) {
    case 'CENTER':
      return 'CENTER'
    case 'MAX':
      return 'MAX'
    case 'STRETCH':
      return 'STRETCH'
    case 'SCALE':
      return 'SCALE'
    default:
      return 'MIN'
  }
}

export function mapTextDecoration(d?: string): TextDecoration {
  switch (d) {
    case 'UNDERLINE':
      return 'UNDERLINE'
    case 'STRIKETHROUGH':
      return 'STRIKETHROUGH'
    default:
      return 'NONE'
  }
}

export function convertLineHeight(
  lh?: { value: number; units: string },
  fontSize?: number
): number | null {
  if (!lh) return null
  if (lh.units === 'PIXELS') return lh.value
  if (lh.units === 'PERCENT') return (lh.value / 100) * (fontSize ?? 14)
  if (lh.units === 'RAW') return lh.value * (fontSize ?? 14)
  return null
}

export function convertLetterSpacing(
  ls?: { value: number; units: string },
  fontSize?: number
): number {
  if (!ls) return 0
  if (ls.units === 'PIXELS') return ls.value
  if (ls.units === 'PERCENT') return (ls.value / 100) * (fontSize ?? 14)
  return ls.value
}

export function mapArcData(data?: Partial<ArcData>): ArcData | null {
  if (!data) return null
  return {
    startingAngle: data.startingAngle ?? 0,
    endingAngle: data.endingAngle ?? 2 * Math.PI,
    innerRadius: data.innerRadius ?? 0
  }
}

function convertStyleOverride(
  override: NodeChange,
  fallbackFontSize: number | undefined
): CharacterStyleOverride {
  const style: CharacterStyleOverride = {}
  if (override.fontName) {
    style.fontFamily = override.fontName.family
    style.fontWeight = styleToWeight(override.fontName.style)
    style.italic = override.fontName.style.toLowerCase().includes('italic')
  }
  if (override.fontSize !== undefined) style.fontSize = override.fontSize
  if (override.letterSpacing) {
    style.letterSpacing = convertLetterSpacing(override.letterSpacing, override.fontSize ?? fallbackFontSize)
  }
  if (override.lineHeight) {
    const lh = convertLineHeight(override.lineHeight, override.fontSize ?? fallbackFontSize)
    if (lh != null) style.lineHeight = lh
  }
  const deco = override.textDecoration
  if (deco) style.textDecoration = mapTextDecoration(deco)
  if (override.fillPaints) {
    const fills = convertFills(override.fillPaints)
    if (fills.length > 0) style.fills = fills
  }
  return style
}

function buildStyleMap(
  table: NodeChange[],
  fallbackFontSize: number | undefined
): Map<number, CharacterStyleOverride> {
  const styleMap = new Map<number, CharacterStyleOverride>()
  for (const override of table) {
    const id = override.styleID as number | undefined
    if (id === undefined) continue
    const style = convertStyleOverride(override, fallbackFontSize)
    if (Object.keys(style).length > 0) styleMap.set(id, style)
  }
  return styleMap
}

function collectStyleRuns(
  ids: number[],
  styleMap: Map<number, CharacterStyleOverride>
): StyleRun[] {
  const runs: StyleRun[] = []
  let currentId = ids[0]
  let start = 0

  for (let i = 1; i <= ids.length; i++) {
    if (i === ids.length || ids[i] !== currentId) {
      if (currentId !== 0) {
        const style = styleMap.get(currentId)
        if (style) runs.push({ start, length: i - start, style })
      }
      if (i < ids.length) {
        currentId = ids[i]
        start = i
      }
    }
  }
  return runs
}

export function importStyleRuns(nc: NodeChange): StyleRun[] {
  const td = nc.textData
  if (!td?.characterStyleIDs || !td.styleOverrideTable) return []

  const ids = td.characterStyleIDs
  if (ids.length === 0 || td.styleOverrideTable.length === 0) return []

  const styleMap = buildStyleMap(td.styleOverrideTable, nc.fontSize)
  if (styleMap.size === 0) return []

  return collectStyleRuns(ids, styleMap)
}

function resolveVectorNetwork(
  nc: NodeChange,
  blobs: Uint8Array[]
): VectorNetwork | null {
  const vectorData = nc.vectorData as
    | {
        vectorNetworkBlob?: number
        normalizedSize?: Vector
        styleOverrideTable?: Array<{ styleID: number; handleMirroring?: string }>
      }
    | undefined

  if (vectorData?.vectorNetworkBlob === undefined) return null
  const idx = vectorData.vectorNetworkBlob
  if (idx < 0 || idx >= blobs.length) return null

  try {
    const network = decodeVectorNetworkBlob(blobs[idx], vectorData.styleOverrideTable)

    const ns = vectorData.normalizedSize
    const nodeW = nc.size?.x ?? 0
    const nodeH = nc.size?.y ?? 0
    if (ns && nodeW > 0 && nodeH > 0 && (ns.x !== nodeW || ns.y !== nodeH)) {
      const sx = nodeW / ns.x
      const sy = nodeH / ns.y
      for (const v of network.vertices) {
        v.x *= sx
        v.y *= sy
      }
      for (const seg of network.segments) {
        seg.tangentStart = { x: seg.tangentStart.x * sx, y: seg.tangentStart.y * sy }
        seg.tangentEnd = { x: seg.tangentEnd.x * sx, y: seg.tangentEnd.y * sy }
      }
    }

    return network
  } catch {
    return null
  }
}

interface KiwiPath {
  windingRule?: string
  commandsBlob?: number
}

export function resolveGeometryPaths(
  paths: KiwiPath[] | undefined,
  blobs: Uint8Array[]
): GeometryPath[] {
  if (!paths || paths.length === 0) return []
  const result: GeometryPath[] = []
  for (const p of paths) {
    if (p.commandsBlob === undefined || p.commandsBlob < 0 || p.commandsBlob >= blobs.length)
      continue
    const blob = blobs[p.commandsBlob]
    if (blob.length === 0) continue
    result.push({
      windingRule: (p.windingRule === 'EVENODD' ? 'EVENODD' : 'NONZERO') as WindingRule,
      commandsBlob: blob
    })
  }
  return result
}

function extractBoundVariables(nc: NodeChange): Record<string, string> {
  const bindings: Record<string, string> = {}
  nc.fillPaints?.forEach((paint, i) => {
    if (paint.colorVariableBinding) {
      bindings[`fills/${i}/color`] = guidToString(paint.colorVariableBinding.variableID)
    }
  })
  nc.strokePaints?.forEach((paint, i) => {
    if (paint.colorVariableBinding) {
      bindings[`strokes/${i}/color`] = guidToString(paint.colorVariableBinding.variableID)
    }
  })
  return bindings
}

function convertTransformProps(nc: NodeChange): Pick<SceneNode, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'flipX' | 'flipY'> {
  const x = nc.transform?.m02 ?? 0
  const y = nc.transform?.m12 ?? 0
  const width = nc.size?.x ?? 100
  const height = nc.size?.y ?? 100

  let rotation = 0
  let flipX = false
  if (nc.transform) {
    const det = nc.transform.m00 * nc.transform.m11 - nc.transform.m01 * nc.transform.m10
    if (det < 0) flipX = true
    const sx = flipX ? -1 : 1
    rotation = Math.atan2(nc.transform.m10 * sx, nc.transform.m00 * sx) * (180 / Math.PI)
  }

  return { x, y, width, height, rotation, flipX, flipY: false }
}

function convertCornerProps(nc: NodeChange): Pick<SceneNode, 'cornerRadius' | 'topLeftRadius' | 'topRightRadius' | 'bottomRightRadius' | 'bottomLeftRadius' | 'independentCorners' | 'cornerSmoothing'> {
  return {
    cornerRadius: nc.cornerRadius ?? 0,
    topLeftRadius: nc.rectangleTopLeftCornerRadius ?? nc.cornerRadius ?? 0,
    topRightRadius: nc.rectangleTopRightCornerRadius ?? nc.cornerRadius ?? 0,
    bottomRightRadius: nc.rectangleBottomRightCornerRadius ?? nc.cornerRadius ?? 0,
    bottomLeftRadius: nc.rectangleBottomLeftCornerRadius ?? nc.cornerRadius ?? 0,
    independentCorners: nc.rectangleCornerRadiiIndependent ?? false,
    cornerSmoothing: nc.cornerSmoothing ?? 0
  }
}

function convertTextProps(nc: NodeChange): Pick<SceneNode, 'text' | 'fontSize' | 'fontFamily' | 'fontWeight' | 'italic' | 'textAlignHorizontal' | 'textAlignVertical' | 'textAutoResize' | 'textCase' | 'textDecoration' | 'lineHeight' | 'letterSpacing' | 'maxLines' | 'styleRuns' | 'textTruncation'> {
  return {
    text: nc.textData?.characters ?? '',
    fontSize: nc.fontSize ?? 14,
    fontFamily: nc.fontName?.family ?? DEFAULT_FONT_FAMILY,
    fontWeight: styleToWeight(nc.fontName?.style ?? ''),
    italic: nc.fontName?.style.toLowerCase().includes('italic') ?? false,
    textAlignHorizontal: (nc.textAlignHorizontal ?? 'LEFT') as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED',
    textAlignVertical: (nc.textAlignVertical ?? 'TOP') as TextAlignVertical,
    textAutoResize: (nc.textAutoResize ?? 'NONE') as TextAutoResize,
    textCase: (nc.textCase ?? 'ORIGINAL') as TextCase,
    textDecoration: mapTextDecoration(nc.textDecoration as string),
    lineHeight: convertLineHeight(nc.lineHeight, nc.fontSize),
    letterSpacing: convertLetterSpacing(nc.letterSpacing, nc.fontSize),
    maxLines: (nc.maxLines ?? null) as number | null,
    styleRuns: importStyleRuns(nc),
    textTruncation: (nc.textTruncation as string) === 'ENDING' ? 'ENDING' : 'DISABLED'
  }
}

function convertLayoutPadding(nc: NodeChange): Pick<SceneNode, 'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight'> {
  return {
    paddingTop: nc.stackVerticalPadding ?? nc.stackPadding ?? 0,
    paddingBottom: nc.stackPaddingBottom ?? nc.stackVerticalPadding ?? nc.stackPadding ?? 0,
    paddingLeft: nc.stackHorizontalPadding ?? nc.stackPadding ?? 0,
    paddingRight: nc.stackPaddingRight ?? nc.stackHorizontalPadding ?? nc.stackPadding ?? 0
  }
}

function convertLayoutProps(nc: NodeChange): Pick<SceneNode, 'layoutMode' | 'itemSpacing' | 'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight' | 'primaryAxisSizing' | 'counterAxisSizing' | 'primaryAxisAlign' | 'counterAxisAlign' | 'layoutWrap' | 'counterAxisSpacing' | 'layoutPositioning' | 'layoutGrow' | 'layoutAlignSelf' | 'counterAxisAlignContent' | 'itemReverseZIndex' | 'strokesIncludedInLayout'> {
  return {
    layoutMode: mapStackMode(nc.stackMode),
    itemSpacing: nc.stackSpacing ?? 0,
    ...convertLayoutPadding(nc),
    primaryAxisSizing: mapStackSizing(nc.stackPrimarySizing),
    counterAxisSizing: mapStackSizing(nc.stackCounterSizing),
    primaryAxisAlign: mapStackJustify(nc.stackPrimaryAlignItems ?? nc.stackJustify),
    counterAxisAlign: mapStackCounterAlign(nc.stackCounterAlignItems ?? nc.stackCounterAlign),
    layoutWrap: nc.stackWrap === 'WRAP' ? 'WRAP' : 'NO_WRAP',
    counterAxisSpacing: nc.stackCounterSpacing ?? 0,
    layoutPositioning: nc.stackPositioning === 'ABSOLUTE' ? 'ABSOLUTE' : 'AUTO',
    layoutGrow: nc.stackChildPrimaryGrow ?? 0,
    layoutAlignSelf: mapAlignSelf(nc.stackChildAlignSelf),
    counterAxisAlignContent: (nc.stackCounterAlignContent as string) === 'SPACE_BETWEEN' ? 'SPACE_BETWEEN' : 'AUTO',
    itemReverseZIndex: (nc.stackReverseZIndex ?? false) as boolean,
    strokesIncludedInLayout: (nc.strokesIncludedInLayout ?? false) as boolean
  }
}

function convertVectorAndStrokeProps(nc: NodeChange, blobs: Uint8Array[]): Pick<SceneNode, 'vectorNetwork' | 'fillGeometry' | 'strokeGeometry' | 'arcData' | 'strokeCap' | 'strokeJoin' | 'dashPattern' | 'borderTopWeight' | 'borderRightWeight' | 'borderBottomWeight' | 'borderLeftWeight' | 'independentStrokeWeights' | 'strokeMiterLimit'> {
  return {
    vectorNetwork: resolveVectorNetwork(nc, blobs),
    fillGeometry: resolveGeometryPaths(nc.fillGeometry, blobs),
    strokeGeometry: resolveGeometryPaths(nc.strokeGeometry, blobs),
    arcData: mapArcData(nc.arcData as Partial<ArcData> | undefined),
    strokeCap: (nc.strokeCap ?? 'NONE') as StrokeCap,
    strokeJoin: (nc.strokeJoin ?? 'MITER') as StrokeJoin,
    dashPattern: nc.dashPattern ?? [],
    borderTopWeight: (nc.borderTopWeight ?? 0) as number,
    borderRightWeight: (nc.borderRightWeight ?? 0) as number,
    borderBottomWeight: (nc.borderBottomWeight ?? 0) as number,
    borderLeftWeight: (nc.borderLeftWeight ?? 0) as number,
    independentStrokeWeights: (nc.borderStrokeWeightsIndependent ?? false) as boolean,
    strokeMiterLimit: DEFAULT_STROKE_MITER_LIMIT
  }
}

export function nodeChangeToProps(
  nc: NodeChange,
  blobs: Uint8Array[]
): Partial<SceneNode> & { nodeType: NodeType | 'DOCUMENT' | 'VARIABLE' } {
  let nodeType = mapNodeType(nc.type)
  if (nodeType === 'FRAME' && isComponentSet(nc)) nodeType = 'COMPONENT_SET'

  return {
    nodeType,
    name: nc.name ?? nodeType,
    ...convertTransformProps(nc),
    opacity: nc.opacity ?? 1,
    visible: nc.visible ?? true,
    locked: nc.locked ?? false,
    blendMode: (nc.blendMode as Fill['blendMode']) ?? 'PASS_THROUGH',
    fills: convertFills(nc.fillPaints),
    strokes: convertStrokes(nc.strokePaints, nc.strokeWeight, nc.strokeAlign, nc.strokeCap, nc.strokeJoin, nc.dashPattern ?? []),
    effects: convertEffects(nc.effects),
    ...convertCornerProps(nc),
    ...convertTextProps(nc),
    horizontalConstraint: mapConstraint(nc.horizontalConstraint as string),
    verticalConstraint: mapConstraint(nc.verticalConstraint as string),
    ...convertLayoutProps(nc),
    ...convertVectorAndStrokeProps(nc, blobs),
    minWidth: (nc.minWidth ?? null) as number | null,
    maxWidth: (nc.maxWidth ?? null) as number | null,
    minHeight: (nc.minHeight ?? null) as number | null,
    maxHeight: (nc.maxHeight ?? null) as number | null,
    isMask: (nc.isMask ?? false) as boolean,
    maskType: (nc.maskType ?? 'ALPHA') as 'ALPHA' | 'VECTOR' | 'LUMINANCE',
    expanded: true,
    autoRename: (nc.autoRename ?? true) as boolean,
    boundVariables: extractBoundVariables(nc),
    clipsContent: nc.frameMaskDisabled === false,
    componentId: extractSymbolId(nc)
  }
}

function isComponentSet(nc: NodeChange): boolean {
  const defs = nc.componentPropDefs as Array<{ type?: string }> | undefined
  if (!defs?.length) return false
  return defs.some((d) => d.type === 'VARIANT')
}

export function sortChildren(
  children: string[],
  parentNc: NodeChange,
  nodeMap: Map<string, NodeChange>
): void {
  const stackMode = parentNc.stackMode as string | undefined
  if (stackMode === 'HORIZONTAL' || stackMode === 'VERTICAL') {
    const axis = stackMode === 'HORIZONTAL' ? 'm02' : 'm12'
    children.sort((a, b) => {
      const aT = nodeMap.get(a)?.transform?.[axis] ?? 0
      const bT = nodeMap.get(b)?.transform?.[axis] ?? 0
      return aT - bT
    })
  } else {
    children.sort((a, b) => {
      const aPos = nodeMap.get(a)?.parentIndex?.position ?? ''
      const bPos = nodeMap.get(b)?.parentIndex?.position ?? ''
      return aPos < bPos ? -1 : (aPos > bPos ? 1 : 0)
    })
  }
}

function extractSymbolId(nc: NodeChange): string {
  const sd = nc.symbolData as
    | { symbolID?: GUID }
    | undefined
  if (!sd?.symbolID) return ''
  return guidToString(sd.symbolID)
}

