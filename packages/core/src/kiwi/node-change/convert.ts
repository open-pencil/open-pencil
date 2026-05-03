/* eslint-disable max-lines -- kiwi↔scene conversion helpers are tightly coupled */
import { DEFAULT_FONT_FAMILY, DEFAULT_STROKE_MITER_LIMIT } from '#core/constants'
import { styleToWeight } from '#core/text/fonts'

import { guidToString } from './guid'
import { convertEffects, convertFills, convertStrokes } from './paint'
import { importStyleRuns } from './style-runs'
export { importStyleRuns } from './style-runs'
import { convertLetterSpacing, convertLineHeight, mapTextDecoration } from './text-values'
export { convertEffects, convertFills, convertStrokes, setVariableColorResolver } from './paint'
export { convertLetterSpacing, convertLineHeight, mapTextDecoration } from './text-values'
import {
  extractBoundVariables,
  extractPluginData,
  extractPluginRelaunchData,
  extractSharedPluginData,
  getOpenPencilPluginValue,
  LAYOUT_DIRECTION_PLUGIN_KEY,
  TEXT_DIRECTION_PLUGIN_KEY
} from './plugin-data'
import { resolveGeometryPaths, resolveVectorNetwork } from './vector-geometry'
export { resolveGeometryPaths } from './vector-geometry'

import type { NodeChange } from '#core/kiwi/binary/codec'
import type {
  SceneNode,
  NodeType,
  Fill,
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
  ArcData,
  VectorNetwork
} from '#core/scene-graph'
import type { GUID } from '#core/types'

export { guidToString, stringToGuid } from './guid'

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
    case 'SPACE_EVENLY':
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

export function mapArcData(data?: Partial<ArcData>): ArcData | null {
  if (!data) return null
  return {
    startingAngle: data.startingAngle ?? 0,
    endingAngle: data.endingAngle ?? 2 * Math.PI,
    innerRadius: data.innerRadius ?? 0
  }
}

function convertTransformProps(
  nc: NodeChange
): Pick<SceneNode, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'flipX' | 'flipY'> {
  const width = nc.size?.x ?? 100
  const height = nc.size?.y ?? 100

  let x = nc.transform?.m02 ?? 0
  let y = nc.transform?.m12 ?? 0
  let rotation = 0
  let flipX = false
  if (nc.transform) {
    const t = nc.transform
    const det = t.m00 * t.m11 - t.m01 * t.m10
    if (det < 0) flipX = true
    const sx = flipX ? -1 : 1
    rotation = Math.atan2(t.m10 * sx, t.m00 * sx) * (180 / Math.PI)

    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: 0, y: height },
      { x: width, y: height }
    ].map((point) => ({
      x: t.m00 * point.x + t.m01 * point.y + t.m02,
      y: t.m10 * point.x + t.m11 * point.y + t.m12
    }))
    x = Math.min(...corners.map((point) => point.x))
    y = Math.min(...corners.map((point) => point.y))
  }

  return { x, y, width, height, rotation, flipX, flipY: false }
}

function convertCornerProps(
  nc: NodeChange
): Pick<
  SceneNode,
  | 'cornerRadius'
  | 'topLeftRadius'
  | 'topRightRadius'
  | 'bottomRightRadius'
  | 'bottomLeftRadius'
  | 'independentCorners'
  | 'cornerSmoothing'
> {
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

function convertTextProps(
  nc: NodeChange
): Pick<
  SceneNode,
  | 'text'
  | 'fontSize'
  | 'fontFamily'
  | 'fontWeight'
  | 'italic'
  | 'textAlignHorizontal'
  | 'textAlignVertical'
  | 'textAutoResize'
  | 'textCase'
  | 'textDecoration'
  | 'lineHeight'
  | 'letterSpacing'
  | 'maxLines'
  | 'styleRuns'
  | 'textTruncation'
  | 'textDirection'
> {
  return {
    text: nc.textData?.characters ?? '',
    fontSize: nc.fontSize ?? 14,
    fontFamily: nc.fontName?.family ?? DEFAULT_FONT_FAMILY,
    fontWeight: styleToWeight(nc.fontName?.style ?? ''),
    italic: nc.fontName?.style.toLowerCase().includes('italic') ?? false,
    textAlignHorizontal: (nc.textAlignHorizontal ?? 'LEFT') as
      | 'LEFT'
      | 'CENTER'
      | 'RIGHT'
      | 'JUSTIFIED',
    textAlignVertical: (nc.textAlignVertical ?? 'TOP') as TextAlignVertical,
    textAutoResize: (nc.textAutoResize ?? 'NONE') as TextAutoResize,
    textCase: (nc.textCase ?? 'ORIGINAL') as TextCase,
    textDecoration: mapTextDecoration(nc.textDecoration as string),
    lineHeight: convertLineHeight(nc.lineHeight, nc.fontSize),
    letterSpacing: convertLetterSpacing(nc.letterSpacing, nc.fontSize),
    maxLines: (nc.maxLines ?? null) as number | null,
    styleRuns: importStyleRuns(nc),
    textTruncation: (nc.textTruncation as string) === 'ENDING' ? 'ENDING' : 'DISABLED',
    textDirection:
      (getOpenPencilPluginValue(nc, TEXT_DIRECTION_PLUGIN_KEY) as
        | SceneNode['textDirection']
        | null) || 'AUTO'
  }
}

function convertLayoutPadding(
  nc: NodeChange
): Pick<SceneNode, 'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight'> {
  return {
    paddingTop: nc.stackVerticalPadding ?? nc.stackPadding ?? 0,
    paddingBottom: nc.stackPaddingBottom ?? nc.stackVerticalPadding ?? nc.stackPadding ?? 0,
    paddingLeft: nc.stackHorizontalPadding ?? nc.stackPadding ?? 0,
    paddingRight: nc.stackPaddingRight ?? nc.stackHorizontalPadding ?? nc.stackPadding ?? 0
  }
}

function convertLayoutProps(
  nc: NodeChange
): Pick<
  SceneNode,
  | 'layoutMode'
  | 'itemSpacing'
  | 'paddingTop'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'paddingRight'
  | 'primaryAxisSizing'
  | 'counterAxisSizing'
  | 'primaryAxisAlign'
  | 'counterAxisAlign'
  | 'layoutWrap'
  | 'counterAxisSpacing'
  | 'layoutPositioning'
  | 'layoutGrow'
  | 'layoutAlignSelf'
  | 'counterAxisAlignContent'
  | 'itemReverseZIndex'
  | 'strokesIncludedInLayout'
  | 'layoutDirection'
> {
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
    counterAxisAlignContent:
      (nc.stackCounterAlignContent as string) === 'SPACE_BETWEEN' ? 'SPACE_BETWEEN' : 'AUTO',
    itemReverseZIndex: (nc.stackReverseZIndex ?? false) as boolean,
    strokesIncludedInLayout: (nc.strokesIncludedInLayout ?? false) as boolean,
    layoutDirection:
      (getOpenPencilPluginValue(nc, LAYOUT_DIRECTION_PLUGIN_KEY) as
        | SceneNode['layoutDirection']
        | null) || 'AUTO'
  }
}

function getVectorStrokeCap(nc: NodeChange, vectorNetwork: VectorNetwork | null): StrokeCap {
  return (nc.strokeCap ??
    vectorNetwork?.vertices.find((v) => v.strokeCap)?.strokeCap ??
    'NONE') as StrokeCap
}

function getVectorStrokeJoin(nc: NodeChange, vectorNetwork: VectorNetwork | null): StrokeJoin {
  return (nc.strokeJoin ??
    vectorNetwork?.vertices.find((v) => v.strokeJoin)?.strokeJoin ??
    'MITER') as StrokeJoin
}

function convertVectorAndStrokeProps(nc: NodeChange, blobs: Uint8Array[]) {
  const vectorNetwork = resolveVectorNetwork(nc, blobs)
  const strokeCap = getVectorStrokeCap(nc, vectorNetwork)
  const strokeJoin = getVectorStrokeJoin(nc, vectorNetwork)
  return {
    vectorNetwork,
    fillGeometry: resolveGeometryPaths(nc.fillGeometry, blobs),
    strokeGeometry: resolveGeometryPaths(nc.strokeGeometry, blobs),
    arcData: mapArcData(nc.arcData as Partial<ArcData> | undefined),
    strokeCap,
    strokeJoin,
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

  const vectorAndStrokeProps = convertVectorAndStrokeProps(nc, blobs)

  return {
    nodeType,
    name: nc.name ?? nodeType,
    ...convertTransformProps(nc),
    opacity: nc.opacity ?? 1,
    visible: nc.visible ?? true,
    locked: nc.locked ?? false,
    blendMode: (nc.blendMode as Fill['blendMode']) ?? 'PASS_THROUGH',
    fills: convertFills(nc.fillPaints),
    strokes: convertStrokes(
      nc.strokePaints,
      nc.strokeWeight,
      nc.strokeAlign,
      vectorAndStrokeProps.strokeCap,
      vectorAndStrokeProps.strokeJoin,
      nc.dashPattern ?? []
    ),
    effects: convertEffects(nc.effects),
    ...convertCornerProps(nc),
    ...convertTextProps(nc),
    horizontalConstraint: mapConstraint(nc.horizontalConstraint as string),
    verticalConstraint: mapConstraint(nc.verticalConstraint as string),
    ...convertLayoutProps(nc),
    ...vectorAndStrokeProps,
    minWidth: (nc.minWidth ?? null) as number | null,
    maxWidth: (nc.maxWidth ?? null) as number | null,
    minHeight: (nc.minHeight ?? null) as number | null,
    maxHeight: (nc.maxHeight ?? null) as number | null,
    isMask: (nc.isMask ?? false) as boolean,
    maskType: (nc.maskType ?? 'ALPHA') as 'ALPHA' | 'VECTOR' | 'LUMINANCE',
    expanded: true,
    autoRename: (nc.autoRename ?? true) as boolean,
    boundVariables: extractBoundVariables(nc),
    pluginData: extractPluginData(nc),
    sharedPluginData: extractSharedPluginData(nc),
    pluginRelaunchData: extractPluginRelaunchData(nc),
    clipsContent: nc.frameMaskDisabled === false && nc.resizeToFit !== true,
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
      if (aPos < bPos) return -1
      if (aPos > bPos) return 1
      return 0
    })
  }
}

function extractSymbolId(nc: NodeChange): string {
  const sd = nc.symbolData as { symbolID?: GUID } | undefined
  if (!sd?.symbolID) return ''
  return guidToString(sd.symbolID)
}
