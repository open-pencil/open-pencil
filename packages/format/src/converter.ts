/**
 * Converter bidirectionnel : scene graph OpenPencil ↔ format .design
 *
 * toDesign()  : SceneNode[] + Variables → DesignDocument
 * toGraph()   : DesignDocument → SceneNode[]
 *
 * @module @verso/format
 */

// Note: we use structural typing — no direct import of @verso/core to keep the package independent.
// The caller passes SceneNode/Variable objects that match these interfaces.

import type {
  DesignDocument,
  DesignNode,
  FrameNode,
  RectangleNode,
  EllipseNode,
  TextNode,
  LineNode,
  PathNode,
  PolygonNode,
  GroupNode,
  RefNode,
  DesignVariable,
  Fill as DesignFill,
  SolidFill,
  GradientFill,
  GradientStop as DesignGradientStop,
  Stroke as DesignStroke,
  Effect as DesignEffect,
  ShadowEffect,
  BlurEffect,
  Padding,
  NodeType as DesignNodeType,
  DocumentMeta,
} from './schema.js';

// ─── Types structurels (compatible avec @verso/core sans import direct) ─────

/** Color as used in OpenPencil scene graph (RGBA 0-1) */
interface GraphColor { r: number; g: number; b: number; a: number }

/** Fill as used in OpenPencil scene graph */
interface GraphFill {
  type: string // 'SOLID' | 'GRADIENT_LINEAR' | ...
  color: GraphColor
  opacity: number
  visible: boolean
  gradientStops?: Array<{ color: GraphColor; position: number }>
  imageHash?: string
  imageScaleMode?: string
}

/** Stroke as used in OpenPencil scene graph */
interface GraphStroke {
  color: GraphColor
  weight: number
  opacity: number
  visible: boolean
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  dashPattern?: number[]
}

/** Effect as used in OpenPencil scene graph */
interface GraphEffect {
  type: string // 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR'
  color: GraphColor
  offset: { x: number; y: number }
  radius: number
  spread: number
  visible: boolean
}

/** SceneNode as used in OpenPencil scene graph (subset of fields we need) */
interface GraphNode {
  id: string
  type: string
  name: string
  parentId: string | null
  childIds: string[]
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fills: GraphFill[]
  strokes: GraphStroke[]
  effects: GraphEffect[]
  opacity: number
  cornerRadius: number
  topLeftRadius: number
  topRightRadius: number
  bottomRightRadius: number
  bottomLeftRadius: number
  independentCorners: boolean
  visible: boolean
  locked: boolean
  clipsContent: boolean
  blendMode: string
  text: string
  fontSize: number
  fontFamily: string
  fontWeight: number
  italic: boolean
  textAlignHorizontal: string
  textAlignVertical: string
  textAutoResize: string
  lineHeight: number | null
  letterSpacing: number
  maxLines: number | null
  layoutMode: string
  primaryAxisAlign: string
  counterAxisAlign: string
  itemSpacing: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  componentId: string | null
  pointCount: number
  arcData: { startingAngle: number; endingAngle: number; innerRadius: number } | null
  boundVariables: Record<string, string>
  vectorNetwork: unknown
}

/** Variable as used in OpenPencil */
interface GraphVariable {
  id: string
  name: string
  type: string // 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  valuesByMode: Record<string, unknown>
  description: string
}

/** Variable collection */
interface GraphVariableCollection {
  id: string
  name: string
  modes: Array<{ modeId: string; name: string }>
  defaultModeId: string
  variableIds: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function colorToHex(c: GraphColor): string {
  const r = Math.round(c.r * 255).toString(16).padStart(2, '0')
  const g = Math.round(c.g * 255).toString(16).padStart(2, '0')
  const b = Math.round(c.b * 255).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

function hexToColor(hex: string): GraphColor {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
    a: 1,
  }
}

function convertGraphFillToDesign(fill: GraphFill): DesignFill | null {
  if (!fill.visible) return null
  if (fill.type === 'SOLID') {
    const hex = colorToHex(fill.color)
    if (fill.opacity < 1) {
      return { type: 'color', color: hex, opacity: fill.opacity } satisfies SolidFill
    }
    return hex
  }
  if (fill.type.startsWith('GRADIENT_')) {
    const gradientType = fill.type === 'GRADIENT_LINEAR' ? 'linear'
      : fill.type === 'GRADIENT_RADIAL' ? 'radial' : 'angular'
    return {
      type: 'gradient',
      gradientType: gradientType as GradientFill['gradientType'],
      stops: (fill.gradientStops ?? []).map((s) => ({
        color: colorToHex(s.color),
        position: s.position,
      } satisfies DesignGradientStop)),
      opacity: fill.opacity,
    } satisfies GradientFill
  }
  if (fill.type === 'IMAGE' && fill.imageHash) {
    return {
      type: 'image',
      src: fill.imageHash,
      mode: (fill.imageScaleMode?.toLowerCase() ?? 'fill') as 'fill' | 'fit' | 'stretch' | 'tile',
      opacity: fill.opacity,
    }
  }
  return colorToHex(fill.color)
}

function convertDesignFillToGraph(fill: DesignFill): GraphFill {
  if (typeof fill === 'string') {
    return { type: 'SOLID', color: hexToColor(fill), opacity: 1, visible: true }
  }
  if ('type' in fill) {
    if (fill.type === 'color') {
      const hex = typeof fill.color === 'string' ? fill.color : '#000000'
      return {
        type: 'SOLID',
        color: hexToColor(hex),
        opacity: typeof fill.opacity === 'number' ? fill.opacity : 1,
        visible: true,
      }
    }
    if (fill.type === 'gradient') {
      const typeMap: Record<string, string> = { linear: 'GRADIENT_LINEAR', radial: 'GRADIENT_RADIAL', angular: 'GRADIENT_ANGULAR' }
      return {
        type: typeMap[fill.gradientType] ?? 'GRADIENT_LINEAR',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: typeof fill.opacity === 'number' ? fill.opacity : 1,
        visible: true,
        gradientStops: fill.stops.map((s) => ({
          color: hexToColor(typeof s.color === 'string' ? s.color : '#000000'),
          position: typeof s.position === 'number' ? s.position : 0,
        })),
      }
    }
    if (fill.type === 'image') {
      return {
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: typeof fill.opacity === 'number' ? fill.opacity : 1,
        visible: true,
        imageHash: fill.src,
        imageScaleMode: fill.mode.toUpperCase(),
      }
    }
  }
  return { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
}

function convertGraphStrokeToDesign(stroke: GraphStroke): DesignStroke | null {
  if (!stroke.visible) return null
  const positionMap: Record<string, 'inside' | 'center' | 'outside'> = {
    INSIDE: 'inside', CENTER: 'center', OUTSIDE: 'outside',
  }
  const style = stroke.dashPattern && stroke.dashPattern.length > 0
    ? (stroke.dashPattern[0] === stroke.dashPattern[1] ? 'dotted' : 'dashed') as const
    : 'solid' as const
  return {
    color: colorToHex(stroke.color),
    width: stroke.weight,
    style,
    position: positionMap[stroke.align] ?? 'center',
    opacity: stroke.opacity,
  }
}

function convertDesignStrokeToGraph(stroke: DesignStroke): GraphStroke {
  const alignMap: Record<string, 'INSIDE' | 'CENTER' | 'OUTSIDE'> = {
    inside: 'INSIDE', center: 'CENTER', outside: 'OUTSIDE',
  }
  const dashPattern = stroke.style === 'dashed' ? [4, 4] : stroke.style === 'dotted' ? [2, 2] : []
  return {
    color: hexToColor(typeof stroke.color === 'string' ? stroke.color : '#000000'),
    weight: typeof stroke.width === 'number' ? stroke.width : 1,
    opacity: typeof stroke.opacity === 'number' ? stroke.opacity : 1,
    visible: true,
    align: alignMap[stroke.position ?? 'center'] ?? 'CENTER',
    dashPattern,
  }
}

function convertGraphEffectToDesign(effect: GraphEffect): DesignEffect | null {
  if (!effect.visible) return null
  if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
    return {
      type: 'shadow',
      color: colorToHex(effect.color),
      offsetX: effect.offset.x,
      offsetY: effect.offset.y,
      blur: effect.radius,
      spread: effect.spread,
      inner: effect.type === 'INNER_SHADOW',
    } satisfies ShadowEffect
  }
  if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR' || effect.type === 'FOREGROUND_BLUR') {
    return { type: 'blur', radius: effect.radius } satisfies BlurEffect
  }
  return null
}

function convertDesignEffectToGraph(effect: DesignEffect): GraphEffect {
  if (effect.type === 'shadow') {
    const s = effect as ShadowEffect
    return {
      type: s.inner ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: hexToColor(typeof s.color === 'string' ? s.color : '#000000'),
      offset: { x: typeof s.offsetX === 'number' ? s.offsetX : 0, y: typeof s.offsetY === 'number' ? s.offsetY : 4 },
      radius: typeof s.blur === 'number' ? s.blur : 8,
      spread: typeof s.spread === 'number' ? s.spread : 0,
      visible: true,
    }
  }
  const b = effect as BlurEffect
  return {
    type: 'LAYER_BLUR',
    color: { r: 0, g: 0, b: 0, a: 0 },
    offset: { x: 0, y: 0 },
    radius: typeof b.radius === 'number' ? b.radius : 4,
    spread: 0,
    visible: true,
  }
}

function mapNodeType(graphType: string): DesignNodeType {
  const map: Record<string, DesignNodeType> = {
    FRAME: 'frame', RECTANGLE: 'rectangle', ROUNDED_RECTANGLE: 'rectangle',
    ELLIPSE: 'ellipse', TEXT: 'text', LINE: 'line', VECTOR: 'path',
    POLYGON: 'polygon', STAR: 'polygon', GROUP: 'group', SECTION: 'group',
    COMPONENT: 'frame', COMPONENT_SET: 'frame', INSTANCE: 'ref',
  }
  return map[graphType] ?? 'frame'
}

function mapDesignTypeToGraph(designType: string, reusable?: boolean): string {
  if (reusable) return 'COMPONENT'
  const map: Record<string, string> = {
    frame: 'FRAME', rectangle: 'RECTANGLE', ellipse: 'ELLIPSE', text: 'TEXT',
    line: 'LINE', path: 'VECTOR', polygon: 'POLYGON', group: 'GROUP',
    ref: 'INSTANCE', note: 'FRAME', context: 'FRAME',
  }
  return map[designType] ?? 'FRAME'
}

// ─── toDesign : SceneNode[] → DesignDocument ────────────────────────────────

interface ToDesignOptions {
  name?: string
  nodeMap: Map<string, GraphNode>
  variables?: GraphVariable[]
  collections?: GraphVariableCollection[]
}

function convertNodeToDesign(node: GraphNode, opts: ToDesignOptions): DesignNode {
  const children: DesignNode[] = []
  for (const childId of node.childIds) {
    const child = opts.nodeMap.get(childId)
    if (child) children.push(convertNodeToDesign(child, opts))
  }

  const fills = node.fills.map(convertGraphFillToDesign).filter((f): f is DesignFill => f !== null)
  const fill = fills.length === 0 ? undefined : fills.length === 1 ? fills[0] : fills
  const strokes = node.strokes.map(convertGraphStrokeToDesign).filter((s): s is DesignStroke => s !== null)
  const stroke = strokes[0]
  const effects = node.effects.map(convertGraphEffectToDesign).filter((e): e is DesignEffect => e !== null)
  const effect = effects.length === 0 ? undefined : effects.length === 1 ? effects[0] : effects

  const cornerRadius = node.independentCorners
    ? [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius] as [number, number, number, number]
    : node.cornerRadius > 0 ? node.cornerRadius : undefined

  const base = {
    id: node.id,
    type: mapNodeType(node.type) as DesignNodeType,
    name: node.name || undefined,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation || undefined,
    opacity: node.opacity < 1 ? node.opacity : undefined,
    enabled: node.visible === false ? false : undefined,
    fill,
    stroke,
    effect,
    reusable: node.type === 'COMPONENT' ? true : undefined,
    metadata: node.locked ? { locked: true } : undefined,
  }

  const designType = mapNodeType(node.type)

  if (designType === 'frame' || designType === 'group') {
    const layoutMap: Record<string, 'horizontal' | 'vertical' | undefined> = {
      HORIZONTAL: 'horizontal', VERTICAL: 'vertical', NONE: undefined,
    }
    const justifyMap: Record<string, string> = {
      MIN: 'start', CENTER: 'center', MAX: 'end', SPACE_BETWEEN: 'space-between',
    }
    const alignMap: Record<string, string> = {
      MIN: 'start', CENTER: 'center', MAX: 'end', STRETCH: 'stretch',
    }

    const hasPadding = node.paddingTop || node.paddingRight || node.paddingBottom || node.paddingLeft
    let padding: Padding | undefined
    if (hasPadding) {
      if (node.paddingTop === node.paddingRight && node.paddingRight === node.paddingBottom && node.paddingBottom === node.paddingLeft) {
        padding = node.paddingTop
      } else if (node.paddingTop === node.paddingBottom && node.paddingRight === node.paddingLeft) {
        padding = [node.paddingTop, node.paddingRight]
      } else {
        padding = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
      }
    }

    return {
      ...base,
      type: designType,
      layout: layoutMap[node.layoutMode],
      gap: node.itemSpacing || undefined,
      padding,
      justifyContent: justifyMap[node.primaryAxisAlign] as FrameNode['justifyContent'],
      alignItems: alignMap[node.counterAxisAlign] as FrameNode['alignItems'],
      clip: node.clipsContent || undefined,
      cornerRadius,
      children: children.length > 0 ? children : undefined,
    } as FrameNode | GroupNode
  }

  if (designType === 'text') {
    const alignMap: Record<string, string> = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' }
    return {
      ...base,
      type: 'text',
      content: node.text,
      fontSize: node.fontSize,
      fontFamily: node.fontFamily,
      fontWeight: String(node.fontWeight),
      fontStyle: node.italic ? 'italic' : undefined,
      textAlign: alignMap[node.textAlignHorizontal] as TextNode['textAlign'],
      lineHeight: node.lineHeight ?? undefined,
      letterSpacing: node.letterSpacing || undefined,
      maxLines: node.maxLines ?? undefined,
    } as TextNode
  }

  if (designType === 'rectangle') {
    return { ...base, type: 'rectangle', cornerRadius } as RectangleNode
  }

  if (designType === 'ellipse') {
    return {
      ...base,
      type: 'ellipse',
      innerRadius: node.arcData?.innerRadius,
      startAngle: node.arcData?.startingAngle,
      sweepAngle: node.arcData ? node.arcData.endingAngle - node.arcData.startingAngle : undefined,
    } as EllipseNode
  }

  if (designType === 'polygon') {
    return { ...base, type: 'polygon', polygonCount: node.pointCount || 3, cornerRadius: typeof cornerRadius === 'number' ? cornerRadius : undefined } as PolygonNode
  }

  if (designType === 'line') {
    return { ...base, type: 'line' } as LineNode
  }

  if (designType === 'path') {
    return { ...base, type: 'path', geometry: '', fillRule: 'nonzero' } as PathNode
  }

  if (designType === 'ref') {
    return { ...base, type: 'ref', ref: node.componentId ?? '' } as RefNode
  }

  return base as DesignNode
}

function convertVariables(
  variables: GraphVariable[],
  collections: GraphVariableCollection[],
): { variables: Record<string, DesignVariable>; themes: Record<string, string[]> } {
  const result: Record<string, DesignVariable> = {}
  const themes: Record<string, string[]> = {}

  for (const collection of collections) {
    if (collection.modes.length > 1) {
      themes[collection.name] = collection.modes.map((m) => m.name)
    }
  }

  for (const v of variables) {
    const typeMap: Record<string, 'color' | 'number' | 'string' | 'boolean'> = {
      COLOR: 'color', FLOAT: 'number', STRING: 'string', BOOLEAN: 'boolean',
    }
    const designType = typeMap[v.type] ?? 'string'

    const modeEntries = Object.entries(v.valuesByMode)
    if (modeEntries.length === 1) {
      const val = modeEntries[0]?.[1]
      if (val && typeof val === 'object' && 'r' in val) {
        result[v.name] = { type: 'color', value: colorToHex(val as GraphColor), description: v.description || undefined }
      } else {
        result[v.name] = { type: designType, value: val as string | number | boolean, description: v.description || undefined }
      }
    } else {
      result[v.name] = { type: designType, value: String(modeEntries[0]?.[1] ?? ''), description: v.description || undefined }
    }
  }

  return { variables: result, themes }
}

/**
 * Convert an OpenPencil scene graph to a .design document
 */
export function toDesign(opts: ToDesignOptions): DesignDocument {
  const rootNodes: DesignNode[] = []
  for (const [, node] of opts.nodeMap) {
    if (node.parentId === null || !opts.nodeMap.has(node.parentId)) {
      if (node.type !== 'CANVAS') {
        rootNodes.push(convertNodeToDesign(node, opts))
      } else {
        // Canvas children are the top-level pages
        for (const childId of node.childIds) {
          const child = opts.nodeMap.get(childId)
          if (child) rootNodes.push(convertNodeToDesign(child, opts))
        }
      }
    }
  }

  const { variables, themes } = opts.variables && opts.collections
    ? convertVariables(opts.variables, opts.collections)
    : { variables: {}, themes: {} }

  const now = new Date().toISOString()
  const meta: DocumentMeta = {
    name: opts.name ?? 'Untitled',
    created: now,
    modified: now,
    generator: 'verso/0.1.0',
  }

  return {
    version: '0.1.0',
    meta,
    variables: Object.keys(variables).length > 0 ? variables : undefined,
    themes: Object.keys(themes).length > 0 ? themes : undefined,
    children: rootNodes,
  }
}

// ─── toGraph : DesignDocument → GraphNode[] ─────────────────────────────────

let nextConvertId = 10000

function designNodeToGraph(node: DesignNode, parentId: string | null): GraphNode[] {
  const result: GraphNode[] = []
  const id = node.id ?? `conv:${nextConvertId++}`

  const fills: GraphFill[] = []
  if (node.fill !== undefined) {
    const fillArray = Array.isArray(node.fill) ? node.fill : [node.fill]
    for (const f of fillArray) {
      fills.push(convertDesignFillToGraph(f))
    }
  }

  const strokes: GraphStroke[] = node.stroke ? [convertDesignStrokeToGraph(node.stroke)] : []
  const effects: GraphEffect[] = []
  if (node.effect) {
    const effectArray = Array.isArray(node.effect) ? node.effect : [node.effect]
    for (const e of effectArray) {
      effects.push(convertDesignEffectToGraph(e))
    }
  }

  const childIds: string[] = []
  if ('children' in node && Array.isArray((node as Record<string, unknown>).children)) {
    for (const child of (node as FrameNode).children ?? []) {
      const childNodes = designNodeToGraph(child, id)
      for (const cn of childNodes) {
        childIds.push(cn.id)
        result.push(cn)
      }
    }
  }

  const layoutMap: Record<string, string> = { horizontal: 'HORIZONTAL', vertical: 'VERTICAL' }
  const justifyMap: Record<string, string> = { start: 'MIN', center: 'CENTER', end: 'MAX', 'space-between': 'SPACE_BETWEEN' }
  const alignMap: Record<string, string> = { start: 'MIN', center: 'CENTER', end: 'MAX', stretch: 'STRETCH' }

  const frame = node as FrameNode
  let padTop = 0, padRight = 0, padBottom = 0, padLeft = 0
  if ('padding' in node && frame.padding !== undefined) {
    const p = frame.padding
    if (typeof p === 'number') { padTop = padRight = padBottom = padLeft = p }
    else if (Array.isArray(p) && p.length === 2) { padTop = padBottom = p[0] as number; padRight = padLeft = p[1] as number }
    else if (Array.isArray(p) && p.length === 4) { padTop = p[0] as number; padRight = p[1] as number; padBottom = p[2] as number; padLeft = p[3] as number }
  }

  const cornerRadius = 'cornerRadius' in node
    ? (typeof frame.cornerRadius === 'number' ? frame.cornerRadius : 0)
    : 0

  const graphNode: GraphNode = {
    id,
    type: mapDesignTypeToGraph(node.type, node.reusable),
    name: node.name ?? node.type,
    parentId,
    childIds,
    x: typeof node.x === 'number' ? node.x : 0,
    y: typeof node.y === 'number' ? node.y : 0,
    width: typeof node.width === 'number' ? node.width : 100,
    height: typeof node.height === 'number' ? node.height : 100,
    rotation: typeof node.rotation === 'number' ? node.rotation : 0,
    fills,
    strokes,
    effects,
    opacity: typeof node.opacity === 'number' ? node.opacity : 1,
    cornerRadius,
    topLeftRadius: cornerRadius,
    topRightRadius: cornerRadius,
    bottomRightRadius: cornerRadius,
    bottomLeftRadius: cornerRadius,
    independentCorners: false,
    visible: node.enabled !== false,
    locked: false,
    clipsContent: 'clip' in node ? !!(node as FrameNode).clip : false,
    blendMode: 'NORMAL',
    text: node.type === 'text' ? (node as TextNode).content as string : '',
    fontSize: node.type === 'text' ? ((node as TextNode).fontSize as number ?? 16) : 16,
    fontFamily: node.type === 'text' ? ((node as TextNode).fontFamily as string ?? 'Inter') : 'Inter',
    fontWeight: node.type === 'text' ? parseInt((node as TextNode).fontWeight as string ?? '400', 10) : 400,
    italic: node.type === 'text' ? (node as TextNode).fontStyle === 'italic' : false,
    textAlignHorizontal: node.type === 'text' ? ({ left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED' }[(node as TextNode).textAlign ?? 'left'] ?? 'LEFT') : 'LEFT',
    textAlignVertical: 'TOP',
    textAutoResize: 'WIDTH_AND_HEIGHT',
    lineHeight: null,
    letterSpacing: 0,
    maxLines: null,
    layoutMode: frame.layout ? (layoutMap[frame.layout] ?? 'NONE') : 'NONE',
    primaryAxisAlign: frame.justifyContent ? (justifyMap[frame.justifyContent] ?? 'MIN') : 'MIN',
    counterAxisAlign: frame.alignItems ? (alignMap[frame.alignItems] ?? 'MIN') : 'MIN',
    itemSpacing: typeof frame.gap === 'number' ? frame.gap : 0,
    paddingTop: padTop,
    paddingRight: padRight,
    paddingBottom: padBottom,
    paddingLeft: padLeft,
    componentId: node.type === 'ref' ? (node as RefNode).ref : null,
    pointCount: node.type === 'polygon' ? (node as PolygonNode).polygonCount : 3,
    arcData: null,
    boundVariables: {},
    vectorNetwork: null,
  }

  result.unshift(graphNode)
  return result
}

/**
 * Convert a .design document to OpenPencil scene graph nodes
 */
export function toGraph(doc: DesignDocument): GraphNode[] {
  const allNodes: GraphNode[] = []
  for (const child of doc.children) {
    allNodes.push(...designNodeToGraph(child, null))
  }
  return allNodes
}
