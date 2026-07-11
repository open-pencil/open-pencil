import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { parseVariantName } from '@open-pencil/scene-graph/variant-name'

/* eslint-disable max-lines -- kiwi↔scene conversion helpers are tightly coupled */
import { DEFAULT_FONT_FAMILY, DEFAULT_STROKE_MITER_LIMIT } from '#core/constants'
import { styleToWeight } from '#core/text/fonts'

import { convertEffects, convertFills, convertStrokes } from './paint'
import { importStyleRuns } from './style-runs'
export { importStyleRuns } from './style-runs'
import { convertFigmaDerivedTextGlyphs } from './derived-text-glyphs'
import { convertFontFeatures } from './font/features'
import { convertFontVariations } from './font/variations'
import { expandPathTextLayoutBox } from './path-text-layout'
import { convertLetterSpacing, convertLineHeight, mapTextDecoration } from './text-values'
export { convertEffects, convertFills, convertStrokes, setVariableColorResolver } from './paint'
export { convertLetterSpacing, convertLineHeight, mapTextDecoration } from './text-values'
import {
  extractBoundVariables,
  extractExportSettings,
  extractPluginData,
  extractPluginRelaunchData,
  getOpenPencilPluginValue,
  LAYOUT_DIRECTION_PLUGIN_KEY,
  NODE_TYPE_PLUGIN_KEY,
  TEXT_DIRECTION_PLUGIN_KEY
} from './plugin-data'
import { resolveGeometryPaths, resolveVectorNetwork } from './vector-geometry'
export { resolveGeometryPaths } from './vector-geometry'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
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
  VectorNetwork,
  ComponentPropertyDefinition,
  ComponentPropertyType,
  SymbolLink,
  VariantPropSpec
} from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'

export { guidToString, stringToGuid } from '@open-pencil/kiwi/fig/guid'

export const VARIABLE_BINDING_FIELDS: Record<string, string> = {
  // Corner radius
  cornerRadius: 'CORNER_RADIUS',
  topLeftRadius: 'RECTANGLE_TOP_LEFT_CORNER_RADIUS',
  topRightRadius: 'RECTANGLE_TOP_RIGHT_CORNER_RADIUS',
  bottomLeftRadius: 'RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS',
  bottomRightRadius: 'RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS',
  // Stroke
  strokeWeight: 'STROKE_WEIGHT',
  borderTopWeight: 'BORDER_TOP_WEIGHT',
  borderBottomWeight: 'BORDER_BOTTOM_WEIGHT',
  borderLeftWeight: 'BORDER_LEFT_WEIGHT',
  borderRightWeight: 'BORDER_RIGHT_WEIGHT',
  // Auto-layout spacing & padding
  itemSpacing: 'STACK_SPACING',
  paddingLeft: 'STACK_PADDING_LEFT',
  paddingTop: 'STACK_PADDING_TOP',
  paddingRight: 'STACK_PADDING_RIGHT',
  paddingBottom: 'STACK_PADDING_BOTTOM',
  counterAxisSpacing: 'STACK_COUNTER_SPACING',
  // Grid gaps
  gridRowGap: 'GRID_ROW_GAP',
  gridColumnGap: 'GRID_COLUMN_GAP',
  // Visibility & opacity
  visible: 'VISIBLE',
  opacity: 'OPACITY',
  // Dimensions
  width: 'WIDTH',
  height: 'HEIGHT',
  minWidth: 'MIN_WIDTH',
  maxWidth: 'MAX_WIDTH',
  minHeight: 'MIN_HEIGHT',
  maxHeight: 'MAX_HEIGHT',
  // Position & rotation
  x: 'X_POSITION',
  y: 'Y_POSITION',
  rotation: 'ROTATION',
  // Text
  fontSize: 'FONT_SIZE',
  letterSpacing: 'LETTER_SPACING',
  lineHeight: 'LINE_HEIGHT',
  fontFamily: 'FONT_FAMILY'
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
  BOOLEAN_OPERATION: 'BOOLEAN_OPERATION',
  GROUP: 'GROUP',
  SECTION: 'SECTION',
  COMPONENT: 'COMPONENT',
  COMPONENT_SET: 'COMPONENT_SET',
  INSTANCE: 'INSTANCE',
  SYMBOL: 'COMPONENT',
  CONNECTOR: 'CONNECTOR',
  SHAPE_WITH_TEXT: 'SHAPE_WITH_TEXT',
  // Figma Kiwi TEXT_PATH (41): no engine NodeType yet (no path-edit product).
  // Map to TEXT and keep fidelity via derived glyphs + strokeGeometry paint;
  // original type is stashed on source.fig.kiwiNodeType for unedited export.
  TEXT_PATH: 'TEXT'
}

function mapNodeType(type?: string): NodeType | 'DOCUMENT' | 'VARIABLE' {
  if (type) return NODE_TYPE_MAP[type] ?? 'RECTANGLE'
  return 'RECTANGLE'
}

function mapBooleanOperation(nc: NodeChange): SceneNode['booleanOperation'] {
  if (nc.type !== 'BOOLEAN_OPERATION') return undefined
  const operation = nc.booleanOperation as NodeChange['booleanOperation'] | 'EXCLUDE' | undefined
  switch (operation) {
    case 'SUBTRACT':
    case 'INTERSECT':
      return operation
    case 'EXCLUDE':
    case 'XOR':
      return 'EXCLUDE'
    default:
      return 'UNION'
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

    if (rotation !== 0 && !flipX) {
      const radians = (rotation * Math.PI) / 180
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)
      x = t.m02 - (width / 2) * (1 - cos) - sin * (height / 2)
      y = t.m12 - (height / 2) * (1 - cos) + sin * (width / 2)
    } else {
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

function importedTextLineHeight(nc: NodeChange): number | null {
  const derivedLineHeight = nc.derivedTextData?.baselines?.[0]?.lineHeight
  if (derivedLineHeight !== undefined && Number.isFinite(derivedLineHeight))
    return derivedLineHeight
  return convertLineHeight(nc.lineHeight, nc.fontSize)
}

type TextProps = Pick<
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
  | 'textDecorationStyle'
  | 'textDecorationThickness'
  | 'textDecorationFills'
  | 'leadingTrim'
  | 'lineHeight'
  | 'letterSpacing'
  | 'maxLines'
  | 'styleRuns'
  | 'fontVariations'
  | 'fontFeatures'
  | 'textTruncation'
  | 'textDirection'
  | 'figmaDerivedLayout'
  | 'figmaDerivedTextGlyphs'
>

function convertTextDecorationProps(
  nc: NodeChange
): Pick<
  SceneNode,
  | 'textDecoration'
  | 'textDecorationStyle'
  | 'textDecorationThickness'
  | 'textDecorationFills'
  | 'textDecorationSkipInk'
  | 'textUnderlineOffset'
> {
  return {
    textDecoration: mapTextDecoration(nc.textDecoration as string),
    textDecorationStyle: (nc.textDecorationStyle ?? 'SOLID') as SceneNode['textDecorationStyle'],
    textDecorationThickness: nc.textDecorationThickness?.value ?? null,
    textDecorationFills: convertFills(nc.textDecorationFillPaints),
    textDecorationSkipInk: nc.textDecorationSkipInk ?? true,
    textUnderlineOffset: nc.textUnderlineOffset?.value ?? null
  }
}

function convertTextProps(nc: NodeChange, blobs: Uint8Array[]): TextProps {
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
    ...convertTextDecorationProps(nc),
    leadingTrim: (nc.leadingTrim ?? 'NONE') as SceneNode['leadingTrim'],
    lineHeight: importedTextLineHeight(nc),
    letterSpacing: convertLetterSpacing(nc.letterSpacing, nc.fontSize),
    maxLines: (nc.maxLines ?? null) as number | null,
    styleRuns: importStyleRuns(nc),
    fontVariations: convertFontVariations(nc),
    fontFeatures: convertFontFeatures(nc),
    textTruncation: (nc.textTruncation as string) === 'ENDING' ? 'ENDING' : 'DISABLED',
    textDirection:
      (getOpenPencilPluginValue(nc, TEXT_DIRECTION_PLUGIN_KEY) as
        | SceneNode['textDirection']
        | null) || 'AUTO',
    figmaDerivedLayout: nc.derivedTextData?.layoutSize
      ? {
          width: nc.derivedTextData.layoutSize.x,
          height: nc.derivedTextData.layoutSize.y
        }
      : null,
    figmaDerivedTextGlyphs: convertFigmaDerivedTextGlyphs(nc.derivedTextData, blobs)
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

function visibleContainerDerivedLayout(
  nc: NodeChange,
  layoutMode: SceneNode['layoutMode'],
  primaryAxisSizing: SceneNode['primaryAxisSizing'],
  counterAxisSizing: SceneNode['counterAxisSizing']
): SceneNode['figmaDerivedLayout'] | undefined {
  const hasHugAxis = primaryAxisSizing === 'HUG' || counterAxisSizing === 'HUG'
  const hasVisiblePaint =
    (nc.fillPaints?.some((paint) => paint.visible !== false) ?? false) ||
    (nc.strokePaints?.some((paint) => paint.visible !== false) ?? false)
  if (layoutMode === 'NONE' || !hasHugAxis || !hasVisiblePaint) return undefined

  return {
    x: nc.transform?.m02 ?? 0,
    y: nc.transform?.m12 ?? 0,
    width: nc.size?.x ?? 100,
    height: nc.size?.y ?? 100
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
> &
  Partial<Pick<SceneNode, 'figmaDerivedLayout'>> {
  const layoutMode = mapStackMode(nc.stackMode)
  const primaryAxisSizing = mapStackSizing(nc.stackPrimarySizing)
  const counterAxisSizing = mapStackSizing(nc.stackCounterSizing)
  const figmaDerivedLayout = visibleContainerDerivedLayout(
    nc,
    layoutMode,
    primaryAxisSizing,
    counterAxisSizing
  )

  return {
    layoutMode,
    itemSpacing: nc.stackSpacing ?? 0,
    ...convertLayoutPadding(nc),
    primaryAxisSizing,
    counterAxisSizing,
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
        | null) || 'AUTO',
    ...(figmaDerivedLayout ? { figmaDerivedLayout } : {})
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

function resolveNodeType(nc: NodeChange): NodeType | 'DOCUMENT' | 'VARIABLE' {
  const nodeType = mapNodeType(nc.type)
  if (
    (nodeType === 'FRAME' && isComponentSet(nc)) ||
    getOpenPencilPluginValue(nc, NODE_TYPE_PLUGIN_KEY) === 'COMPONENT_SET'
  ) {
    return 'COMPONENT_SET'
  }
  // Figma stores plain groups as FRAME node-changes flagged with resizeToFit.
  // Auto-layout "hug" frames instead use stackPrimarySizing/stackCounterSizing and
  // always carry a stackMode, so guard on the absence of auto-layout — a real group
  // never has one. This keeps component-sets and auto-layout frames from being
  // misclassified as groups.
  if (
    nodeType === 'FRAME' &&
    nc.resizeToFit === true &&
    (nc.stackMode === undefined || nc.stackMode === 'NONE')
  ) {
    return 'GROUP'
  }
  return nodeType
}

function nearlyEqualSize(a: number | undefined, b: number | undefined): boolean {
  return Math.abs((a ?? 0) - (b ?? 0)) <= 0.5
}

export function shouldImportTextAsAutoSize(
  nc: NodeChange,
  parentNc: NodeChange | undefined
): boolean {
  if (nc.type !== 'TEXT' || nc.textAutoResize !== 'NONE') return false
  if (parentNc?.stackMode !== 'HORIZONTAL' && parentNc?.stackMode !== 'VERTICAL') return false
  if (!nc.textData?.characters) return false
  const layoutSize = nc.derivedTextData?.layoutSize
  if (!layoutSize || !nc.size) return false
  return nearlyEqualSize(layoutSize.x, nc.size.x) && nearlyEqualSize(layoutSize.y, nc.size.y)
}

export function nodeChangeToProps(
  nc: NodeChange,
  blobs: Uint8Array[]
): Partial<SceneNode> & { nodeType: NodeType | 'DOCUMENT' | 'VARIABLE' } {
  const nodeType = resolveNodeType(nc)

  const vectorAndStrokeProps = convertVectorAndStrokeProps(nc, blobs)

  const props: Partial<SceneNode> & { nodeType: NodeType | 'DOCUMENT' | 'VARIABLE' } = {
    nodeType,
    name: nc.name ?? nodeType,
    source: extractSourceMetadata(nc, blobs),
    ...convertTransformProps(nc),
    opacity: nc.opacity ?? 1,
    visible: nc.visible ?? true,
    locked: nc.locked ?? false,
    blendMode: (nc.blendMode as Fill['blendMode']) ?? 'PASS_THROUGH',
    booleanOperation: mapBooleanOperation(nc),
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
    ...convertTextProps(nc, blobs),
    horizontalConstraint: mapConstraint(nc.horizontalConstraint as string),
    verticalConstraint: mapConstraint(nc.verticalConstraint as string),
    ...convertLayoutProps(nc),
    ...vectorAndStrokeProps,
    minWidth: (nc.minWidth ?? null) as number | null,
    maxWidth: (nc.maxWidth ?? null) as number | null,
    minHeight: (nc.minHeight ?? null) as number | null,
    maxHeight: (nc.maxHeight ?? null) as number | null,
    isMask: nc.mask ?? false,
    maskType: (nc.maskType ?? 'ALPHA') as 'ALPHA' | 'VECTOR' | 'LUMINANCE',
    maskIsOutline: nc.maskIsOutline ?? false,
    expanded: true,
    autoRename: (nc.autoRename ?? true) as boolean,
    boundVariables: extractBoundVariables(nc),
    exportSettings: extractExportSettings(nc),
    pluginData: extractPluginData(nc),
    pluginRelaunchData: extractPluginRelaunchData(nc),
    clipsContent: nc.frameMaskDisabled === false && nc.resizeToFit !== true,
    componentId: extractSymbolId(nc),
    componentPropertyDefinitions: extractComponentPropertyDefs(nc),
    componentPropertyValues: extractComponentPropertyValues(nc),
    ...extractComponentMetadata(nc)
  }

  // See path-text-layout.ts — expand layout box before the node is created so
  // clipsContent parents don't shave overflowing path lettering at first paint.
  expandPathTextLayoutBox(props)
  return props
}

const COMPONENT_PROP_TYPE_MAP: Record<string, ComponentPropertyType> = {
  VARIANT: 'VARIANT',
  TEXT: 'TEXT',
  BOOL: 'BOOLEAN',
  BOOLEAN: 'BOOLEAN',
  INSTANCE_SWAP: 'INSTANCE_SWAP'
}

function componentPropValueToString(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const propValue = value as {
    boolValue?: boolean
    textValue?: string | { characters?: string }
    guidValue?: GUID
  }
  if (typeof propValue.boolValue === 'boolean') return String(propValue.boolValue)
  if (typeof propValue.textValue === 'string') return propValue.textValue
  if (propValue.textValue && typeof propValue.textValue === 'object') {
    return propValue.textValue.characters ?? ''
  }
  return propValue.guidValue ? guidToString(propValue.guidValue) : ''
}

interface RawComponentPropDef {
  id?: GUID
  name?: string
  type?: string
  initialValue?: unknown
}

interface RawSymbolData {
  symbolOverrides?: unknown[]
  uniformScaleFactor?: number
}

function extractComponentPropertyDefs(nc: NodeChange): ComponentPropertyDefinition[] {
  const defs = nc.componentPropDefs as RawComponentPropDef[] | undefined
  if (!defs?.length) return []
  const result: ComponentPropertyDefinition[] = []
  for (const def of defs) {
    if (!def.id || !def.name) continue
    const propType = COMPONENT_PROP_TYPE_MAP[def.type ?? ''] ?? 'VARIANT'
    result.push({
      id: guidToString(def.id),
      name: def.name,
      type: propType,
      defaultValue: componentPropValueToString(def.initialValue),
      variantOptions: propType === 'VARIANT' ? undefined : undefined
    })
  }
  return result
}

function extractVariantPropSpecs(nc: NodeChange): VariantPropSpec[] {
  const specs = nc.variantPropSpecs as Array<{ propDefId?: GUID; value?: string }> | undefined
  if (!specs?.length) return []
  return specs
    .filter((spec): spec is { propDefId: GUID; value?: string } => !!spec.propDefId)
    .map((spec) => ({ propDefId: guidToString(spec.propDefId), value: spec.value ?? '' }))
}

function extractComponentPropertyValues(nc: NodeChange): Record<string, string> {
  const specs = extractVariantPropSpecs(nc)
  const defs = new Map(extractComponentPropertyDefs(nc).map((def) => [def.id, def.name]))
  if (specs.length > 0 && defs.size > 0) {
    const values: Record<string, string> = {}
    for (const spec of specs) values[defs.get(spec.propDefId) ?? spec.propDefId] = spec.value
    return values
  }

  const name = nc.name
  if (!name?.includes('=')) return {}
  return parseVariantName(name)
}

type ComponentMetadataProps = Pick<
  SceneNode,
  | 'componentKey'
  | 'sourceLibraryKey'
  | 'publishId'
  | 'overrideKey'
  | 'sharedSymbolVersion'
  | 'publishedVersion'
  | 'isPublishable'
  | 'isSymbolPublishable'
  | 'symbolDescription'
  | 'symbolLinks'
  | 'variantPropSpecs'
>

function guidToStringOrNull(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const guid = value as Partial<GUID>
  if (typeof guid.sessionID !== 'number' || typeof guid.localID !== 'number') return null
  return guidToString({ sessionID: guid.sessionID, localID: guid.localID })
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function booleanOrFalse(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

function extractComponentMetadata(nc: NodeChange): ComponentMetadataProps {
  const symbolLinks = (nc.symbolLinks as Array<Partial<SymbolLink>> | undefined) ?? []
  return {
    componentKey: stringOrNull(nc.componentKey),
    sourceLibraryKey: stringOrNull(nc.sourceLibraryKey),
    publishId: guidToStringOrNull(nc.publishID),
    overrideKey: guidToStringOrNull(nc.overrideKey),
    sharedSymbolVersion: stringOrNull(nc.sharedSymbolVersion),
    publishedVersion: stringOrNull(nc.publishedVersion),
    isPublishable: booleanOrFalse(nc.isPublishable),
    isSymbolPublishable: booleanOrFalse(nc.isSymbolPublishable),
    symbolDescription: stringOrEmpty(nc.symbolDescription),
    symbolLinks: symbolLinks
      .filter((link): link is SymbolLink => typeof link.uri === 'string')
      .map((link) => ({
        uri: link.uri,
        displayName: link.displayName,
        displayText: link.displayText
      })),
    variantPropSpecs: extractVariantPropSpecs(nc)
  }
}

function isComponentSet(nc: NodeChange): boolean {
  const defs = nc.componentPropDefs as Array<{ type?: string }> | undefined
  if (!defs?.length) return false
  return defs.some((d) => d.type === 'VARIANT')
}

function extractFigmaLayoutMetadata(nc: NodeChange): SceneNode['source']['fig']['layout'] {
  return {
    stackMode: nc.stackMode,
    stackSpacing: nc.stackSpacing,
    stackPadding: nc.stackPadding,
    stackPaddingRight: nc.stackPaddingRight,
    stackPaddingBottom: nc.stackPaddingBottom,
    stackCounterAlign: nc.stackCounterAlign,
    stackJustify: nc.stackJustify,
    stackCounterAlignItems: nc.stackCounterAlignItems,
    stackPrimaryAlignItems: nc.stackPrimaryAlignItems,
    stackPrimarySizing: nc.stackPrimarySizing,
    stackCounterSizing: nc.stackCounterSizing,
    stackVerticalPadding: nc.stackVerticalPadding,
    stackHorizontalPadding: nc.stackHorizontalPadding,
    stackWrap: nc.stackWrap,
    stackPositioning: nc.stackPositioning,
    stackChildPrimaryGrow: nc.stackChildPrimaryGrow,
    stackChildAlignSelf: nc.stackChildAlignSelf,
    stackCounterSpacing: nc.stackCounterSpacing,
    bordersTakeSpace: nc.bordersTakeSpace as boolean | undefined,
    stackReverseZIndex: nc.stackReverseZIndex as boolean | undefined
  }
}

function extractSourceMetadata(nc: NodeChange, blobs: Uint8Array[]): SceneNode['source'] {
  return {
    format: 'fig',
    id: nc.guid ? guidToString(nc.guid) : null,
    orderKey: nc.parentIndex?.position ?? null,
    fig: {
      ...extractFigmaRawGeometry(nc, blobs),
      ...extractFigmaSymbolMetadata(nc, blobs),
      layout: extractFigmaLayoutMetadata(nc),
      // Engine type is TEXT; remember Kiwi TEXT_PATH so export can re-emit type 41
      // while path-text fidelity (glyphs) still exists. Cleared on content edit.
      kiwiNodeType: nc.type === 'TEXT_PATH' ? 'TEXT_PATH' : null
    }
  }
}

export function sortChildren(
  children: string[],
  parentNc: NodeChange,
  nodeMap: Map<string, NodeChange>
): void {
  // Always sort by parentIndex.position first (canonical tree order)
  const stackMode = parentNc.stackMode as string | undefined
  const isHorizontal = stackMode === 'HORIZONTAL'
  const isVertical = stackMode === 'VERTICAL'

  children.sort((a, b) => {
    const aPos = nodeMap.get(a)?.parentIndex?.position ?? ''
    const bPos = nodeMap.get(b)?.parentIndex?.position ?? ''
    // Primary sort: parentIndex.position (exact tree order)
    if (aPos < bPos) return -1
    if (aPos > bPos) return 1

    // Tiebreaker for auto-layout: sort by transform position
    if (isHorizontal || isVertical) {
      const axis = isHorizontal ? 'm02' : 'm12'
      const aT = nodeMap.get(a)?.transform?.[axis] ?? 0
      const bT = nodeMap.get(b)?.transform?.[axis] ?? 0
      if (aT !== bT) return aT - bT
    }

    return 0
  })
}

interface PreservedFigmaBlob {
  __openPencilFigmaBlob: Uint8Array
}

function preserveFigmaPayloadBlobs(value: unknown, blobs: Uint8Array[]): unknown {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value)) return value.map((item) => preserveFigmaPayloadBlobs(item, blobs))
  if (!value || typeof value !== 'object') return value
  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if ((key === 'commandsBlob' || key === 'vectorNetworkBlob') && typeof child === 'number') {
      const blob: unknown = blobs[child]
      if (blob == null) {
        result[key] = child
      } else {
        result[key] = {
          __openPencilFigmaBlob:
            blob instanceof Uint8Array
              ? blob
              : new Uint8Array(Object.values(blob as Record<string, number>))
        } satisfies PreservedFigmaBlob
      }
    } else {
      result[key] = preserveFigmaPayloadBlobs(child, blobs)
    }
  }
  return result
}

export const FIGMA_RAW_NODE_FIELD_KEYS = [
  'styleIdForFill',
  'styleIdForStrokeFill',
  'styleIdForText',
  'styleIdForEffect',
  'styleIdForGrid',
  'backgroundPaints',
  'layoutGrids',
  'exportSettings',
  'componentPropDefs',
  'componentPropRefs',
  'variantPropSpecs',
  'stateGroupPropertyValueOrders',
  'isStateGroup',
  'version',
  'sourceLibraryKey',
  'userFacingVersion',
  'description',
  'key',
  'sortPosition',
  'detachedSymbolId',
  'documentColorProfile',
  'variableConsumptionMap',
  'variableModeBySetMap',
  'parameterConsumptionMap',
  'editInfo',
  'backgroundColor',
  'pageType',
  'isPageDivider',
  'guides',
  'handoffStatusMap',
  'annotationCategories',
  'miterLimit',
  'mask',
  'maskType',
  'maskIsOutline',
  'strokeWeight',
  'strokeJoin',
  'borderStrokeWeightsIndependent',
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'minSize',
  'maxSize',
  'targetAspectRatio',
  'gridRows',
  'gridColumns',
  'gridRowAnchor',
  'gridColumnAnchor',
  'gridColumnsSizing',
  'gridRowsSizing',
  'gridChildVerticalAlign',
  'gridChildHorizontalAlign',
  'textAutoResize',
  'textData',
  'lineHeight',
  'fontName',
  'fontSize',
  'letterSpacing',
  'textTracking',
  'fontVersion',
  'textUserLayoutVersion',
  'textExplicitLayoutVersion',
  'fontVariations',
  'fontVariantCommonLigatures',
  'fontVariantContextualLigatures',
  'toggledOnOTFeatures',
  'toggledOffOTFeatures',
  'leadingTrim',
  'textDecorationFillPaints',
  'textUnderlineOffset',
  'textDecorationThickness',
  'textDecorationStyle',
  'semanticWeight',
  'semanticItalic',
  'maxLines',
  'textPathStart',
  'derivedTextData',
  'fillPaints',
  'strokePaints',
  'effects',
  'sectionStatusInfo',
  'prototypeStartNodeID',
  'prototypeInteractions',
  'transitionInfo',
  'codeSyntax',
  'lockMode',
  'slideThemeMap',
  'isSoftDeleted',
  'brushType',
  'scatterStrokeSettings',
  'vectorOperationVersion',
  'vectorData',
  'fillGeometry',
  'strokeGeometry'
] as const satisfies readonly (keyof NodeChange)[]

function extractFigmaRawGeometry(
  nc: NodeChange,
  blobs: Uint8Array[]
): Pick<SceneNode['source']['fig'], 'rawSize' | 'rawTransform' | 'rawNodeFields'> {
  const rawNodeFields: Record<string, unknown> = {}
  for (const key of FIGMA_RAW_NODE_FIELD_KEYS) {
    const value = nc[key]
    if (value !== undefined) rawNodeFields[key] = preserveFigmaPayloadBlobs(value, blobs)
  }
  return {
    rawSize: nc.size ? { ...nc.size } : null,
    rawTransform: nc.transform ? { ...nc.transform } : null,
    rawNodeFields
  }
}

function extractFigmaSymbolMetadata(
  nc: NodeChange,
  blobs: Uint8Array[]
): Pick<
  SceneNode['source']['fig'],
  | 'symbolOverrides'
  | 'componentPropAssignments'
  | 'derivedSymbolData'
  | 'derivedSymbolDataLayoutVersion'
  | 'uniformScaleFactor'
> {
  const sd = nc.symbolData as RawSymbolData | undefined
  return {
    symbolOverrides: preserveFigmaPayloadBlobs(sd?.symbolOverrides ?? [], blobs) as unknown[],
    componentPropAssignments: preserveFigmaPayloadBlobs(
      nc.componentPropAssignments ?? [],
      blobs
    ) as unknown[],
    derivedSymbolData: preserveFigmaPayloadBlobs(nc.derivedSymbolData ?? [], blobs) as unknown[],
    derivedSymbolDataLayoutVersion:
      typeof nc.derivedSymbolDataLayoutVersion === 'number'
        ? nc.derivedSymbolDataLayoutVersion
        : null,
    uniformScaleFactor: typeof sd?.uniformScaleFactor === 'number' ? sd.uniformScaleFactor : null
  }
}

function extractSymbolId(nc: NodeChange): string {
  const sd = nc.symbolData as { symbolID?: GUID } | undefined
  if (!sd?.symbolID) return ''
  return guidToString(sd.symbolID)
}
