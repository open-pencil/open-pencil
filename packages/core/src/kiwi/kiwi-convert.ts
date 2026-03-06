import { BLACK, DEFAULT_FONT_FAMILY, DEFAULT_STROKE_MITER_LIMIT } from '../constants'
import { styleToWeight } from '../fonts'
import { decodeVectorNetworkBlob } from '../vector'

import type {
  SceneNode,
  NodeType,
  Fill,
  FillType,
  Stroke,
  Effect,
  Color,
  BlendMode,
  ImageScaleMode,
  GradientTransform,
  StrokeCap,
  StrokeJoin,
  LayoutMode,
  LayoutSizing,
  LayoutAlign,
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

function ext(nc: NodeChange): Record<string, unknown> {
  return nc as unknown as Record<string, unknown>
}

export function guidToString(guid: GUID): string {
  return `${guid.sessionID}:${guid.localID}`
}

function convertColor(color?: Partial<Color>): Color {
  if (!color) return { ...BLACK }
  return { r: color.r ?? 0, g: color.g ?? 0, b: color.b ?? 0, a: color.a ?? 1 }
}

function imageHashToString(hash: Record<string, number>): string {
  const bytes = Object.keys(hash)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => hash[Number(k)])
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function convertGradientTransform(t?: {
  m00: number
  m01: number
  m02: number
  m10: number
  m11: number
  m12: number
}): GradientTransform | undefined {
  if (!t) return undefined
  return { m00: t.m00, m01: t.m01, m02: t.m02, m10: t.m10, m11: t.m11, m12: t.m12 }
}

export function convertFills(paints?: Paint[]): Fill[] {
  if (!paints) return []
  return paints.map((p) => {
    const base: Fill = {
      type: (p.type ?? 'SOLID') as FillType,
      color: convertColor(p.color),
      opacity: p.opacity ?? 1,
      visible: p.visible ?? true,
      blendMode: (p.blendMode ?? 'NORMAL') as BlendMode
    }

    if (p.type?.startsWith('GRADIENT') && p.stops) {
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
      base.imageScaleMode = (p.imageScaleMode as ImageScaleMode) ?? 'FILL'
      if (p.transform) {
        base.imageTransform = convertGradientTransform(p.transform)
      }
    }

    return base
  })
}

function convertStrokes(
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
      : align === 'OUTSIDE'
        ? 'OUTSIDE'
        : 'CENTER') as Stroke['align'],
    cap: (cap ?? 'NONE') as StrokeCap,
    join: (join ?? 'MITER') as StrokeJoin,
    dashPattern: dashPattern ?? []
  }))
}

function convertEffects(effects?: KiwiEffect[]): Effect[] {
  if (!effects) return []
  return effects.map((e) => ({
    type: e.type as Effect['type'],
    color: convertColor(e.color),
    offset: e.offset ?? { x: 0, y: 0 },
    radius: e.radius ?? 0,
    spread: e.spread ?? 0,
    visible: e.visible ?? true,
    blendMode: (e.blendMode as BlendMode) ?? 'NORMAL'
  }))
}

function mapNodeType(type?: string): NodeType | 'DOCUMENT' | 'VARIABLE' {
  switch (type) {
    case 'DOCUMENT':
      return 'DOCUMENT'
    case 'VARIABLE':
      return 'VARIABLE'
    case 'CANVAS':
      return 'CANVAS'
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
    case 'REGULAR_POLYGON':
      return 'POLYGON'
    case 'VECTOR':
      return 'VECTOR'
    case 'BOOLEAN_OPERATION':
      return 'VECTOR'
    case 'GROUP':
      return 'GROUP'
    case 'SECTION':
      return 'SECTION'
    case 'COMPONENT':
      return 'COMPONENT'
    case 'COMPONENT_SET':
      return 'COMPONENT_SET'
    case 'INSTANCE':
      return 'INSTANCE'
    case 'SYMBOL':
      return 'COMPONENT'
    case 'CONNECTOR':
      return 'CONNECTOR'
    case 'SHAPE_WITH_TEXT':
      return 'SHAPE_WITH_TEXT'
    default:
      return 'RECTANGLE'
  }
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

function mapStackSizing(sizing?: string): LayoutSizing {
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

function mapStackJustify(justify?: string): LayoutAlign {
  switch (justify) {
    case 'CENTER':
      return 'CENTER'
    case 'MAX':
      return 'MAX'
    case 'SPACE_BETWEEN':
    case 'SPACE_EVENLY':
      return 'SPACE_BETWEEN'
    default:
      return 'MIN'
  }
}

function mapStackCounterAlign(align?: string): LayoutCounterAlign {
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

function mapTextDecoration(d?: string): TextDecoration {
  switch (d) {
    case 'UNDERLINE':
      return 'UNDERLINE'
    case 'STRIKETHROUGH':
      return 'STRIKETHROUGH'
    default:
      return 'NONE'
  }
}

function convertLineHeight(
  lh?: { value: number; units: string },
  fontSize?: number
): number | null {
  if (!lh) return null
  if (lh.units === 'PIXELS') return lh.value
  if (lh.units === 'PERCENT') return (lh.value / 100) * (fontSize ?? 14)
  return null
}

function convertLetterSpacing(
  ls?: { value: number; units: string },
  fontSize?: number
): number {
  if (!ls) return 0
  if (ls.units === 'PIXELS') return ls.value
  if (ls.units === 'PERCENT') return (ls.value / 100) * (fontSize ?? 14)
  return ls.value
}

function mapArcData(data?: Record<string, number>): ArcData | null {
  if (!data) return null
  return {
    startingAngle: data.startingAngle ?? 0,
    endingAngle: data.endingAngle ?? 2 * Math.PI,
    innerRadius: data.innerRadius ?? 0
  }
}

function importStyleRuns(nc: NodeChange): StyleRun[] {
  const td = nc.textData
  if (!td?.characterStyleIDs || !td.styleOverrideTable) return []

  const ids = td.characterStyleIDs
  const table = td.styleOverrideTable
  if (ids.length === 0 || table.length === 0) return []

  const styleMap = new Map<number, CharacterStyleOverride>()
  for (const override of table) {
    const id = (override as unknown as Record<string, unknown>).styleID as number | undefined
    if (id === undefined) continue
    const style: CharacterStyleOverride = {}
    if (override.fontName) {
      style.fontFamily = override.fontName.family
      style.fontWeight = styleToWeight(override.fontName.style ?? '')
      style.italic = override.fontName.style?.toLowerCase().includes('italic') ?? false
    }
    if (override.fontSize !== undefined) style.fontSize = override.fontSize
    if (override.letterSpacing) style.letterSpacing = override.letterSpacing.value
    if (override.lineHeight) {
      const lh = convertLineHeight(override.lineHeight, override.fontSize)
      if (lh != null) style.lineHeight = lh
    }
    const deco = ext(override).textDecoration as string | undefined
    if (deco) style.textDecoration = mapTextDecoration(deco)
    if (Object.keys(style).length > 0) styleMap.set(id, style)
  }

  if (styleMap.size === 0) return []

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

function resolveVectorNetwork(
  nc: NodeChange,
  blobs: Uint8Array[]
): VectorNetwork | null {
  const vectorData = (nc as unknown as Record<string, unknown>).vectorData as
    | {
        vectorNetworkBlob?: number
        normalizedSize?: { x: number; y: number }
        styleOverrideTable?: Array<{ styleID: number; handleMirroring?: string }>
      }
    | undefined

  if (!vectorData || vectorData.vectorNetworkBlob === undefined) return null
  const idx = vectorData.vectorNetworkBlob
  if (idx < 0 || idx >= blobs.length) return null

  try {
    const network = decodeVectorNetworkBlob(blobs[idx], vectorData.styleOverrideTable)
    if (!network) return null

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
    if (!blob || blob.length === 0) continue
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

export function nodeChangeToProps(
  nc: NodeChange,
  blobs: Uint8Array[]
): Partial<SceneNode> & { nodeType: NodeType | 'DOCUMENT' | 'VARIABLE' } {
  let nodeType = mapNodeType(nc.type)
  if (nodeType === 'FRAME' && isComponentSet(nc)) nodeType = 'COMPONENT_SET'

  const x = nc.transform?.m02 ?? 0
  const y = nc.transform?.m12 ?? 0
  const width = nc.size?.x ?? 100
  const height = nc.size?.y ?? 100

  let rotation = 0
  let flipX = false
  let flipY = false
  if (nc.transform) {
    const det = nc.transform.m00 * nc.transform.m11 - nc.transform.m01 * nc.transform.m10
    if (det < 0) flipX = true
    const sx = flipX ? -1 : 1
    rotation = Math.atan2(nc.transform.m10 * sx, nc.transform.m00 * sx) * (180 / Math.PI)
  }

  const dashPattern = (ext(nc).dashPattern as number[]) ?? []

  return {
    nodeType,
    name: nc.name ?? nodeType,
    x,
    y,
    width,
    height,
    rotation,
    flipX,
    flipY,
    opacity: nc.opacity ?? 1,
    visible: nc.visible ?? true,
    locked: nc.locked ?? false,
    blendMode: (ext(nc).blendMode as Fill['blendMode']) ?? 'PASS_THROUGH',
    fills: convertFills(nc.fillPaints),
    strokes: convertStrokes(
      nc.strokePaints,
      nc.strokeWeight,
      nc.strokeAlign,
      nc.strokeCap,
      nc.strokeJoin,
      dashPattern
    ),
    effects: convertEffects(nc.effects),
    cornerRadius: nc.cornerRadius ?? 0,
    topLeftRadius: nc.rectangleTopLeftCornerRadius ?? nc.cornerRadius ?? 0,
    topRightRadius: nc.rectangleTopRightCornerRadius ?? nc.cornerRadius ?? 0,
    bottomRightRadius: nc.rectangleBottomRightCornerRadius ?? nc.cornerRadius ?? 0,
    bottomLeftRadius: nc.rectangleBottomLeftCornerRadius ?? nc.cornerRadius ?? 0,
    independentCorners: nc.rectangleCornerRadiiIndependent ?? false,
    cornerSmoothing: nc.cornerSmoothing ?? 0,
    text: nc.textData?.characters ?? '',
    fontSize: nc.fontSize ?? 14,
    fontFamily: nc.fontName?.family ?? DEFAULT_FONT_FAMILY,
    fontWeight: styleToWeight(nc.fontName?.style ?? ''),
    italic: nc.fontName?.style?.toLowerCase().includes('italic') ?? false,
    textAlignHorizontal:
      (nc.textAlignHorizontal as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED') ?? 'LEFT',
    textAlignVertical: (ext(nc).textAlignVertical as TextAlignVertical) ?? 'TOP',
    textAutoResize: (ext(nc).textAutoResize as TextAutoResize) ?? 'NONE',
    textCase: (ext(nc).textCase as TextCase) ?? 'ORIGINAL',
    textDecoration: mapTextDecoration(ext(nc).textDecoration as string),
    lineHeight: convertLineHeight(nc.lineHeight, nc.fontSize),
    letterSpacing: convertLetterSpacing(nc.letterSpacing, nc.fontSize),
    maxLines: (ext(nc).maxLines as number) ?? null,
    styleRuns: importStyleRuns(nc),
    horizontalConstraint: mapConstraint(ext(nc).horizontalConstraint as string),
    verticalConstraint: mapConstraint(ext(nc).verticalConstraint as string),
    layoutMode: mapStackMode(nc.stackMode),
    itemSpacing: nc.stackSpacing ?? 0,
    paddingTop: nc.stackVerticalPadding ?? nc.stackPadding ?? 0,
    paddingBottom: nc.stackPaddingBottom ?? nc.stackVerticalPadding ?? nc.stackPadding ?? 0,
    paddingLeft: nc.stackHorizontalPadding ?? nc.stackPadding ?? 0,
    paddingRight: nc.stackPaddingRight ?? nc.stackHorizontalPadding ?? nc.stackPadding ?? 0,
    primaryAxisSizing: mapStackSizing(nc.stackPrimarySizing),
    counterAxisSizing: mapStackSizing(nc.stackCounterSizing),
    primaryAxisAlign: mapStackJustify(nc.stackPrimaryAlignItems ?? nc.stackJustify),
    counterAxisAlign: mapStackCounterAlign(nc.stackCounterAlignItems ?? nc.stackCounterAlign),
    layoutWrap: ext(nc).stackWrap === 'WRAP' ? 'WRAP' : 'NO_WRAP',
    counterAxisSpacing: (ext(nc).stackCounterSpacing as number) ?? 0,
    layoutPositioning: ext(nc).stackPositioning === 'ABSOLUTE' ? 'ABSOLUTE' : 'AUTO',
    layoutGrow: (ext(nc).stackChildPrimaryGrow as number) ?? 0,
    layoutAlignSelf: (ext(nc).stackChildAlignSelf as string) === 'STRETCH' ? 'STRETCH' : 'AUTO',
    vectorNetwork: resolveVectorNetwork(nc, blobs),
    fillGeometry: resolveGeometryPaths(nc.fillGeometry, blobs),
    strokeGeometry: resolveGeometryPaths(nc.strokeGeometry, blobs),
    arcData: mapArcData(ext(nc).arcData as Record<string, number> | undefined),
    strokeCap: (nc.strokeCap ?? 'NONE') as StrokeCap,
    strokeJoin: (nc.strokeJoin ?? 'MITER') as StrokeJoin,
    dashPattern,
    borderTopWeight: (ext(nc).borderTopWeight as number) ?? 0,
    borderRightWeight: (ext(nc).borderRightWeight as number) ?? 0,
    borderBottomWeight: (ext(nc).borderBottomWeight as number) ?? 0,
    borderLeftWeight: (ext(nc).borderLeftWeight as number) ?? 0,
    independentStrokeWeights: (ext(nc).borderStrokeWeightsIndependent as boolean) ?? false,
    strokeMiterLimit: DEFAULT_STROKE_MITER_LIMIT,
    minWidth: (ext(nc).minWidth as number) ?? null,
    maxWidth: (ext(nc).maxWidth as number) ?? null,
    minHeight: (ext(nc).minHeight as number) ?? null,
    maxHeight: (ext(nc).maxHeight as number) ?? null,
    isMask: (ext(nc).isMask as boolean) ?? false,
    maskType: ((ext(nc).maskType as string) ?? 'ALPHA') as 'ALPHA' | 'VECTOR' | 'LUMINANCE',
    counterAxisAlignContent:
      (ext(nc).stackCounterAlignContent as string) === 'SPACE_BETWEEN' ? 'SPACE_BETWEEN' : 'AUTO',
    itemReverseZIndex: (ext(nc).stackReverseZIndex as boolean) ?? false,
    strokesIncludedInLayout: (ext(nc).strokesIncludedInLayout as boolean) ?? false,
    expanded: true,
    textTruncation: (ext(nc).textTruncation as string) === 'ENDING' ? 'ENDING' : 'DISABLED',
    autoRename: (ext(nc).autoRename as boolean) ?? true,
    boundVariables: extractBoundVariables(nc),
    clipsContent: nc.frameMaskDisabled === false,
    componentId: extractSymbolId(nc)
  }
}

function isComponentSet(nc: NodeChange): boolean {
  const defs = ext(nc).componentPropDefs as Array<{ type?: string }> | undefined
  if (!defs?.length) return false
  return defs.some((d) => d.type === 'VARIANT')
}

export function sortChildren(
  children: string[],
  parentNc: NodeChange,
  nodeMap: Map<string, NodeChange>
): void {
  const stackMode = (parentNc as unknown as Record<string, unknown>).stackMode as string | undefined
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
      return aPos < bPos ? -1 : aPos > bPos ? 1 : 0
    })
  }
}

function extractSymbolId(nc: NodeChange): string {
  const sd = (nc as unknown as Record<string, unknown>).symbolData as
    | { symbolID?: GUID }
    | undefined
  if (!sd?.symbolID) return ''
  return guidToString(sd.symbolID)
}

export function convertOverrideToProps(ov: Record<string, unknown>): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}

  if (ov.textData != null) {
    const td = ov.textData as { characters?: string }
    if (td.characters != null) updates.text = td.characters
    const runs = importStyleRuns(ov as unknown as NodeChange)
    if (runs.length > 0) updates.styleRuns = runs
  }
  if (ov.fillPaints != null) updates.fills = convertFills(ov.fillPaints as Paint[])
  if (ov.strokePaints != null)
    updates.strokes = convertStrokes(
      ov.strokePaints as Paint[],
      ov.strokeWeight as number | undefined,
      ov.strokeAlign as string | undefined
    )
  if (ov.effects != null) updates.effects = convertEffects(ov.effects as KiwiEffect[])
  if (ov.visible != null) updates.visible = ov.visible as boolean
  if (ov.opacity != null) updates.opacity = ov.opacity as number
  if (ov.name != null) updates.name = ov.name as string
  if (ov.locked != null) updates.locked = ov.locked as boolean

  if (ov.size != null) {
    const sz = ov.size as { x?: number; y?: number }
    if (sz.x != null) updates.width = sz.x
    if (sz.y != null) updates.height = sz.y
  }

  if (ov.cornerRadius != null) updates.cornerRadius = ov.cornerRadius as number
  if (ov.rectangleTopLeftCornerRadius != null)
    updates.topLeftRadius = ov.rectangleTopLeftCornerRadius as number
  if (ov.rectangleTopRightCornerRadius != null)
    updates.topRightRadius = ov.rectangleTopRightCornerRadius as number
  if (ov.rectangleBottomRightCornerRadius != null)
    updates.bottomRightRadius = ov.rectangleBottomRightCornerRadius as number
  if (ov.rectangleBottomLeftCornerRadius != null)
    updates.bottomLeftRadius = ov.rectangleBottomLeftCornerRadius as number
  if (ov.rectangleCornerRadiiIndependent != null)
    updates.independentCorners = ov.rectangleCornerRadiiIndependent as boolean

  if (ov.stackSpacing != null) updates.itemSpacing = ov.stackSpacing as number
  if (ov.stackPrimarySizing != null)
    updates.primaryAxisSizing = mapStackSizing(ov.stackPrimarySizing as string)
  if (ov.stackCounterSizing != null)
    updates.counterAxisSizing = mapStackSizing(ov.stackCounterSizing as string)
  if (ov.stackPrimaryAlignItems != null)
    updates.primaryAxisAlign = mapStackJustify(ov.stackPrimaryAlignItems as string)
  if (ov.stackCounterAlignItems != null)
    updates.counterAxisAlign = mapStackCounterAlign(ov.stackCounterAlignItems as string)
  if (ov.stackChildPrimaryGrow != null) updates.layoutGrow = ov.stackChildPrimaryGrow as number
  if (ov.stackChildAlignSelf != null)
    updates.layoutAlignSelf =
      (ov.stackChildAlignSelf as string) === 'STRETCH' ? 'STRETCH' : 'AUTO'
  if (ov.stackPositioning != null)
    updates.layoutPositioning =
      (ov.stackPositioning as string) === 'ABSOLUTE' ? 'ABSOLUTE' : 'AUTO'
  if (ov.stackVerticalPadding != null) {
    updates.paddingTop = ov.stackVerticalPadding as number
    if (ov.stackPaddingBottom == null) updates.paddingBottom = ov.stackVerticalPadding as number
  }
  if (ov.stackHorizontalPadding != null) {
    updates.paddingLeft = ov.stackHorizontalPadding as number
    if (ov.stackPaddingRight == null) updates.paddingRight = ov.stackHorizontalPadding as number
  }
  if (ov.stackPaddingBottom != null) updates.paddingBottom = ov.stackPaddingBottom as number
  if (ov.stackPaddingRight != null) updates.paddingRight = ov.stackPaddingRight as number

  if (ov.strokeWeight != null && !ov.strokePaints) {
    updates.strokes = updates.strokes ?? []
  }
  if (ov.strokeAlign != null && updates.strokes) {
    const align = (
      ov.strokeAlign === 'INSIDE' ? 'INSIDE' : ov.strokeAlign === 'OUTSIDE' ? 'OUTSIDE' : 'CENTER'
    ) as Stroke['align']
    for (const s of updates.strokes) s.align = align
  }
  if (ov.borderTopWeight != null) updates.borderTopWeight = ov.borderTopWeight as number
  if (ov.borderRightWeight != null) updates.borderRightWeight = ov.borderRightWeight as number
  if (ov.borderBottomWeight != null) updates.borderBottomWeight = ov.borderBottomWeight as number
  if (ov.borderLeftWeight != null) updates.borderLeftWeight = ov.borderLeftWeight as number
  if (ov.borderStrokeWeightsIndependent != null)
    updates.independentStrokeWeights = ov.borderStrokeWeightsIndependent as boolean

  if (ov.fontName != null) {
    const fn = ov.fontName as { family?: string; style?: string }
    if (fn.family) updates.fontFamily = fn.family
    if (fn.style) {
      updates.fontWeight = styleToWeight(fn.style)
      updates.italic = fn.style.toLowerCase().includes('italic')
    }
  }
  if (ov.fontSize != null) updates.fontSize = ov.fontSize as number
  if (ov.textAlignHorizontal != null)
    updates.textAlignHorizontal = ov.textAlignHorizontal as SceneNode['textAlignHorizontal']
  if (ov.textAutoResize != null) updates.textAutoResize = ov.textAutoResize as TextAutoResize
  if (ov.lineHeight != null)
    updates.lineHeight = convertLineHeight(
      ov.lineHeight as NodeChange['lineHeight'],
      ov.fontSize as number | undefined
    )
  if (ov.letterSpacing != null)
    updates.letterSpacing = convertLetterSpacing(
      ov.letterSpacing as NodeChange['letterSpacing'],
      ov.fontSize as number | undefined
    )
  if (ov.maxLines != null) updates.maxLines = ov.maxLines as number | null
  if (ov.textTruncation != null)
    updates.textTruncation =
      (ov.textTruncation as string) === 'ENDING' ? 'ENDING' : 'DISABLED'
  if (ov.textDecoration != null)
    updates.textDecoration = mapTextDecoration(ov.textDecoration as string)

  if (ov.arcData != null)
    updates.arcData = mapArcData(ov.arcData as Record<string, number> | undefined)
  if (ov.frameMaskDisabled != null) updates.clipsContent = ov.frameMaskDisabled === false

  return updates
}
