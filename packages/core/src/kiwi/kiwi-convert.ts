import { normalizeColor } from '../color'
import { DEFAULT_FONT_FAMILY } from '../constants'
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
      : (align === 'OUTSIDE'
        ? 'OUTSIDE'
        : 'CENTER')),
    cap: (cap ?? 'NONE') as StrokeCap,
    join: (join ?? 'MITER') as StrokeJoin,
    dashPattern: dashPattern ?? []
  }))
}

function convertEffects(effects?: KiwiEffect[]): Effect[] {
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
  if (lh.units === 'RAW') return lh.value * (fontSize ?? 14)
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

function mapArcData(data?: Partial<ArcData>): ArcData | null {
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
    const id = override.styleID as number | undefined
    if (id === undefined) continue
    const style: CharacterStyleOverride = {}
    if (override.fontName) {
      style.fontFamily = override.fontName.family
      style.fontWeight = styleToWeight(override.fontName.style)
      style.italic = override.fontName.style.toLowerCase().includes('italic')
    }
    if (override.fontSize !== undefined) style.fontSize = override.fontSize
    if (override.letterSpacing) {
      style.letterSpacing = convertLetterSpacing(override.letterSpacing, override.fontSize ?? nc.fontSize)
    }
    if (override.lineHeight) {
      const lh = convertLineHeight(override.lineHeight, override.fontSize ?? nc.fontSize)
      if (lh != null) style.lineHeight = lh
    }
    const deco = override.textDecoration
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

export function nodeChangeToProps(
  nc: NodeChange,
  blobs: Uint8Array[]
): Partial<SceneNode> & { nodeType: NodeType | 'DOCUMENT' | 'VARIABLE' } {
  let nodeType = mapNodeType(nc.type)
  if (nodeType === 'FRAME' && isComponentSet(nc)) nodeType = 'COMPONENT_SET'

  // Build props sparsely — only include values that differ from COLD_DEFAULTS.
  // With the prototype-backed SceneNode, omitted properties fall through to
  // the shared default, saving per-node allocation.
  const props: Partial<SceneNode> & { nodeType: NodeType | 'DOCUMENT' | 'VARIABLE' } = { nodeType } as any

  // Always set spatial properties (hot path)
  props.name = nc.name ?? nodeType
  props.x = nc.transform?.m02 ?? 0
  props.y = nc.transform?.m12 ?? 0
  props.width = nc.size?.x ?? 100
  props.height = nc.size?.y ?? 100

  if (nc.transform) {
    const det = nc.transform.m00 * nc.transform.m11 - nc.transform.m01 * nc.transform.m10
    if (det < 0) props.flipX = true
    const sx = props.flipX ? -1 : 1
    const r = Math.atan2(nc.transform.m10 * sx, nc.transform.m00 * sx) * (180 / Math.PI)
    if (r !== 0) props.rotation = r
  }

  // Scalar properties — only set if non-default
  if (nc.opacity != null && nc.opacity !== 1) props.opacity = nc.opacity
  if (nc.visible === false) props.visible = false
  if (nc.locked) props.locked = true

  const bm = nc.blendMode as string | undefined
  if (bm && bm !== 'PASS_THROUGH') props.blendMode = bm as Fill['blendMode']

  // Arrays — only create if non-empty
  const fills = convertFills(nc.fillPaints)
  if (fills.length > 0) props.fills = fills
  const dashPattern = nc.dashPattern ?? []
  const strokes = convertStrokes(nc.strokePaints, nc.strokeWeight, nc.strokeAlign, nc.strokeCap, nc.strokeJoin, dashPattern)
  if (strokes.length > 0) props.strokes = strokes
  const effects = convertEffects(nc.effects)
  if (effects.length > 0) props.effects = effects

  // Corner radii
  const cr = nc.cornerRadius ?? 0
  if (cr !== 0) props.cornerRadius = cr
  const tlr = nc.rectangleTopLeftCornerRadius ?? cr
  if (tlr !== 0) props.topLeftRadius = tlr
  const trr = nc.rectangleTopRightCornerRadius ?? cr
  if (trr !== 0) props.topRightRadius = trr
  const brr = nc.rectangleBottomRightCornerRadius ?? cr
  if (brr !== 0) props.bottomRightRadius = brr
  const blr = nc.rectangleBottomLeftCornerRadius ?? cr
  if (blr !== 0) props.bottomLeftRadius = blr
  if (nc.rectangleCornerRadiiIndependent) props.independentCorners = true
  const cs = nc.cornerSmoothing ?? 0
  if (cs !== 0) props.cornerSmoothing = cs

  // Text properties
  const text = nc.textData?.characters ?? ''
  if (text !== '') props.text = text
  if (nc.fontSize != null && nc.fontSize !== 14) props.fontSize = nc.fontSize
  const ff = nc.fontName?.family
  if (ff && ff !== DEFAULT_FONT_FAMILY) props.fontFamily = ff
  const fw = styleToWeight(nc.fontName?.style ?? '')
  if (fw !== 400) props.fontWeight = fw
  if (nc.fontName?.style?.toLowerCase().includes('italic')) props.italic = true
  const tah = nc.textAlignHorizontal as string | undefined
  if (tah && tah !== 'LEFT') props.textAlignHorizontal = tah as SceneNode['textAlignHorizontal']
  const tav = nc.textAlignVertical as string | undefined
  if (tav && tav !== 'TOP') props.textAlignVertical = tav as TextAlignVertical
  const tar = nc.textAutoResize as string | undefined
  if (tar && tar !== 'NONE') props.textAutoResize = tar as TextAutoResize
  const tc = nc.textCase as string | undefined
  if (tc && tc !== 'ORIGINAL') props.textCase = tc as TextCase
  const td = mapTextDecoration(nc.textDecoration as string)
  if (td !== 'NONE') props.textDecoration = td
  const lh = convertLineHeight(nc.lineHeight, nc.fontSize)
  if (lh != null) props.lineHeight = lh
  const ls = convertLetterSpacing(nc.letterSpacing, nc.fontSize)
  if (ls !== 0) props.letterSpacing = ls
  const ml = (nc.maxLines as number) ?? null
  if (ml != null) props.maxLines = ml
  const sr = importStyleRuns(nc)
  if (sr.length > 0) props.styleRuns = sr

  // Constraints
  const hc = mapConstraint(nc.horizontalConstraint as string)
  if (hc !== 'MIN') props.horizontalConstraint = hc
  const vc = mapConstraint(nc.verticalConstraint as string)
  if (vc !== 'MIN') props.verticalConstraint = vc

  // Layout
  const lm = mapStackMode(nc.stackMode)
  if (lm !== 'NONE') props.layoutMode = lm
  const is = nc.stackSpacing ?? 0
  if (is !== 0) props.itemSpacing = is
  const pt = nc.stackVerticalPadding ?? nc.stackPadding ?? 0
  if (pt !== 0) props.paddingTop = pt
  const pb = nc.stackPaddingBottom ?? nc.stackVerticalPadding ?? nc.stackPadding ?? 0
  if (pb !== 0) props.paddingBottom = pb
  const pl = nc.stackHorizontalPadding ?? nc.stackPadding ?? 0
  if (pl !== 0) props.paddingLeft = pl
  const pr = nc.stackPaddingRight ?? nc.stackHorizontalPadding ?? nc.stackPadding ?? 0
  if (pr !== 0) props.paddingRight = pr
  const pas = mapStackSizing(nc.stackPrimarySizing)
  if (pas !== 'FIXED') props.primaryAxisSizing = pas
  const cas = mapStackSizing(nc.stackCounterSizing)
  if (cas !== 'FIXED') props.counterAxisSizing = cas
  const paa = mapStackJustify(nc.stackPrimaryAlignItems ?? nc.stackJustify)
  if (paa !== 'MIN') props.primaryAxisAlign = paa
  const caa = mapStackCounterAlign(nc.stackCounterAlignItems ?? nc.stackCounterAlign)
  if (caa !== 'MIN') props.counterAxisAlign = caa
  if (nc.stackWrap === 'WRAP') props.layoutWrap = 'WRAP'
  const csp = nc.stackCounterSpacing ?? 0
  if (csp !== 0) props.counterAxisSpacing = csp
  if (nc.stackPositioning === 'ABSOLUTE') props.layoutPositioning = 'ABSOLUTE'
  const lg = nc.stackChildPrimaryGrow ?? 0
  if (lg !== 0) props.layoutGrow = lg
  if ((nc.stackChildAlignSelf as string) === 'STRETCH') props.layoutAlignSelf = 'STRETCH'

  // Geometry
  const vn = resolveVectorNetwork(nc, blobs)
  if (vn) props.vectorNetwork = vn
  const fg = resolveGeometryPaths(nc.fillGeometry, blobs)
  if (fg.length > 0) props.fillGeometry = fg
  const sg = resolveGeometryPaths(nc.strokeGeometry, blobs)
  if (sg.length > 0) props.strokeGeometry = sg
  const ad = mapArcData(nc.arcData as Partial<ArcData> | undefined)
  if (ad) props.arcData = ad

  // Stroke detail
  const sc = (nc.strokeCap ?? 'NONE') as StrokeCap
  if (sc !== 'NONE') props.strokeCap = sc
  const sj = (nc.strokeJoin ?? 'MITER') as StrokeJoin
  if (sj !== 'MITER') props.strokeJoin = sj
  if (dashPattern.length > 0) props.dashPattern = dashPattern

  // Border weights
  const btw = (nc.borderTopWeight ?? 0) as number
  if (btw !== 0) props.borderTopWeight = btw
  const brw = (nc.borderRightWeight ?? 0) as number
  if (brw !== 0) props.borderRightWeight = brw
  const bbw = (nc.borderBottomWeight ?? 0) as number
  if (bbw !== 0) props.borderBottomWeight = bbw
  const blw = (nc.borderLeftWeight ?? 0) as number
  if (blw !== 0) props.borderLeftWeight = blw
  if ((nc.borderStrokeWeightsIndependent as boolean)) props.independentStrokeWeights = true

  // Min/max dimensions
  const mnw = (nc.minWidth ?? null) as number | null
  if (mnw != null) props.minWidth = mnw
  const mxw = (nc.maxWidth ?? null) as number | null
  if (mxw != null) props.maxWidth = mxw
  const mnh = (nc.minHeight ?? null) as number | null
  if (mnh != null) props.minHeight = mnh
  const mxh = (nc.maxHeight ?? null) as number | null
  if (mxh != null) props.maxHeight = mxh

  // Masks
  if ((nc.isMask as boolean)) props.isMask = true
  const mt = (nc.maskType as string) ?? 'ALPHA'
  if (mt !== 'ALPHA') props.maskType = mt as 'ALPHA' | 'VECTOR' | 'LUMINANCE'

  // Misc layout
  if ((nc.stackCounterAlignContent as string) === 'SPACE_BETWEEN') props.counterAxisAlignContent = 'SPACE_BETWEEN'
  if ((nc.stackReverseZIndex as boolean)) props.itemReverseZIndex = true
  if ((nc.strokesIncludedInLayout as boolean)) props.strokesIncludedInLayout = true
  if ((nc.textTruncation as string) === 'ENDING') props.textTruncation = 'ENDING'
  if ((nc.autoRename as boolean) === false) props.autoRename = false

  // Bound variables
  const bv = extractBoundVariables(nc)
  if (Object.keys(bv).length > 0) props.boundVariables = bv

  // Clipping & component
  if (nc.frameMaskDisabled === false) props.clipsContent = true
  const cid = extractSymbolId(nc)
  if (cid !== '') props.componentId = cid

  return props
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
    const align =
      ov.strokeAlign === 'INSIDE' ? 'INSIDE' : (ov.strokeAlign === 'OUTSIDE' ? 'OUTSIDE' : 'CENTER')
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
    updates.arcData = mapArcData(ov.arcData as Partial<ArcData> | undefined)
  if (ov.frameMaskDisabled != null) updates.clipsContent = ov.frameMaskDisabled === false

  return updates
}
