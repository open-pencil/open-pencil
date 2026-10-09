/* eslint-disable max-lines -- scene node contracts are kept together as the public graph type surface */

import type { ExportFormatId } from './export-format'
import type { CanvasGuide } from './guides'
import type { InstanceOverrideState } from './instance-overrides'
import type { Color, Matrix, Rect, Vector } from './primitives'

export interface SceneGraphEvents {
  'node:created': (node: SceneNode) => void
  'node:updated': (id: string, changes: Partial<SceneNode>) => void
  'node:previewUpdated': (id: string, changes: Partial<SceneNode>) => void
  'node:deleted': (id: string, parentId: string | null) => void
  'node:reparented': (nodeId: string, oldParentId: string | null, newParentId: string) => void
  'node:reordered': (
    nodeId: string,
    parentId: string,
    index: number,
    previousParentId: string | null
  ) => void
}

export type SceneGraphEventHandlers = Partial<{
  created: (node: SceneNode) => void
  updated: (id: string, changes: Partial<SceneNode>) => void
  previewUpdated: (id: string, changes: Partial<SceneNode>) => void
  deleted: (id: string, parentId: string | null) => void
  reparented: (nodeId: string, oldParentId: string | null, newParentId: string) => void
  reordered: (
    nodeId: string,
    parentId: string,
    index: number,
    previousParentId: string | null
  ) => void
}>

export type DocumentColorSpace = 'srgb' | 'display-p3'

export interface FigmaSourcePayload {
  rawSize: Vector | null
  rawTransform: Matrix | null
  rawNodeFields: Record<string, unknown>
  layout: FigmaLayoutMetadata | null
  symbolOverrides: unknown[]
  componentPropAssignments: unknown[]
  derivedSymbolData: unknown[]
  derivedSymbolDataLayoutVersion: number | null
  uniformScaleFactor: number | null
}

export interface SourceMetadata {
  format: 'fig' | null
  id: string | null
  orderKey: string | null
  editedFields: string[]
  fig: FigmaSourcePayload
}

export type HandleMirroring = 'NONE' | 'ANGLE' | 'ANGLE_AND_LENGTH'
export type WindingRule = 'NONZERO' | 'EVENODD'

export interface VectorVertex {
  x: number
  y: number
  strokeCap?: string
  strokeJoin?: string
  cornerRadius?: number
  handleMirroring?: HandleMirroring
}

export interface VectorSegment {
  start: number
  end: number
  tangentStart: Vector
  tangentEnd: Vector
}

export interface VectorRegion {
  windingRule: WindingRule
  loops: number[][]
}

export interface VectorNetwork {
  vertices: VectorVertex[]
  segments: VectorSegment[]
  regions: VectorRegion[]
}

export interface GeometryPath {
  windingRule: WindingRule
  commandsBlob: Uint8Array
  /** Resolved paints for geometry using a format-specific style override. */
  fills?: Fill[]
  /** Shared fill style attached to this geometry region, when available. */
  fillStyleId?: string
}

export type NodeType =
  | 'CANVAS'
  | 'FRAME'
  | 'RECTANGLE'
  | 'ROUNDED_RECTANGLE'
  | 'ELLIPSE'
  | 'TEXT'
  | 'LINE'
  | 'STAR'
  | 'POLYGON'
  | 'VECTOR'
  | 'BOOLEAN_OPERATION'
  | 'GROUP'
  | 'SECTION'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'CONNECTOR'
  | 'SHAPE_WITH_TEXT'

export type FillType =
  | 'SOLID'
  | 'GRADIENT_LINEAR'
  | 'GRADIENT_RADIAL'
  | 'GRADIENT_ANGULAR'
  | 'GRADIENT_DIAMOND'
  | 'IMAGE'
  | 'VIDEO'
  | 'PATTERN'
  | 'NOISE'
  | 'CUSTOM'
export type BlendMode =
  | 'NORMAL'
  | 'DARKEN'
  | 'MULTIPLY'
  | 'COLOR_BURN'
  | 'LIGHTEN'
  | 'SCREEN'
  | 'COLOR_DODGE'
  | 'OVERLAY'
  | 'SOFT_LIGHT'
  | 'HARD_LIGHT'
  | 'DIFFERENCE'
  | 'EXCLUSION'
  | 'HUE'
  | 'SATURATION'
  | 'COLOR'
  | 'LUMINOSITY'
  | 'PASS_THROUGH'
export type ImageScaleMode = 'FILL' | 'FIT' | 'CROP' | 'TILE'
export type NoiseType = 'MULTITONE' | 'MONOTONE' | 'DUOTONE'
export type PatternTileType = 'RECTANGULAR' | 'HORIZONTAL_HEXAGONAL' | 'VERTICAL_HEXAGONAL'
export type PatternAlignment = 'START' | 'CENTER' | 'END'

export interface GradientStop {
  color: Color
  position: number
}

export type GradientTransform = Matrix

export interface Fill {
  type: FillType
  color: Color
  opacity: number
  visible: boolean
  blendMode?: BlendMode
  gradientStops?: GradientStop[]
  gradientTransform?: GradientTransform
  imageHash?: string
  imageScaleMode?: ImageScaleMode
  imageTransform?: GradientTransform
  sourceNodeId?: string
  scale?: number
  spacing?: number
  patternSpacing?: Vector
  patternTileType?: PatternTileType
  verticalAlignment?: PatternAlignment
  horizontalAlignment?: PatternAlignment
  noiseType?: NoiseType
  density?: number
  noiseSize?: Vector
  customEffectId?: string
}

export type StrokeCap = 'NONE' | 'ROUND' | 'SQUARE' | 'ARROW_LINES' | 'ARROW_EQUILATERAL'
export type StrokeJoin = 'MITER' | 'BEVEL' | 'ROUND'
export type SharedStyleType = 'FILL' | 'TEXT' | 'EFFECT' | 'GRID'
export type SharedStyleKind = 'fill' | 'stroke' | 'text' | 'effect' | 'grid'
export type MaskType = 'ALPHA' | 'VECTOR' | 'LUMINANCE'

export interface LayoutGrid {
  visible?: boolean
  color?: Color
  pattern?: 'COLUMNS' | 'ROWS' | 'GRID'
  axis?: 'X' | 'Y'
  type?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH'
  alignment?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH'
  numSections?: number
  count?: number
  offset?: number
  sectionSize?: number
  gutterSize?: number
}

export interface SharedStyle {
  id: string
  nodeId: string
  name: string
  type: SharedStyleType
}

/** A stroke is a paint with the geometry that decides where it is drawn. */
export interface Stroke extends Fill {
  weight: number
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  cap?: StrokeCap
  join?: StrokeJoin
  dashPattern?: number[]
}

export interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR' | 'FOREGROUND_BLUR'
  color: Color
  offset: Vector
  radius: number
  spread: number
  visible: boolean
  blendMode?: BlendMode
  showShadowBehindNode?: boolean
}

export type ConstraintType = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE'
export type TextAutoResize = 'NONE' | 'HEIGHT' | 'WIDTH_AND_HEIGHT' | 'TRUNCATE'
export type TextAlignVertical = 'TOP' | 'CENTER' | 'BOTTOM'
export type TextCase = 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE'
export type TextDecoration = 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH'
export type TextDecorationStyle = 'SOLID' | 'DOTTED' | 'WAVY'
export type LeadingTrim = 'NONE' | 'CAP_HEIGHT'
export type TextDirection = 'AUTO' | 'LTR' | 'RTL'
export type LayoutDirection = 'AUTO' | 'LTR' | 'RTL'

export interface FontVariation {
  axis: string
  value: number
}

export interface FontFeature {
  tag: string
  enabled: boolean
}

export interface CharacterStyleOverride {
  fontWeight?: number
  italic?: boolean
  textDecoration?: TextDecoration
  textDecorationStyle?: TextDecorationStyle
  textDecorationThickness?: number | null
  textDecorationFills?: Fill[]
  textDecorationSkipInk?: boolean
  textUnderlineOffset?: number | null
  fontSize?: number
  fontFamily?: string
  letterSpacing?: number
  lineHeight?: number | null
  fills?: Fill[]
  fontVariations?: FontVariation[]
  fontFeatures?: FontFeature[]
  textLanguage?: string | null
}

export interface StyleRun {
  start: number
  length: number
  style: CharacterStyleOverride
}

export interface ArcData {
  startingAngle: number
  endingAngle: number
  innerRadius: number
}

export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID'
/** A node's sizing along one axis; fill is stored on the child, see `layoutSizing`. */
export type LayoutSizing = 'FIXED' | 'HUG' | 'FILL'
/** Whether an auto-layout frame keeps its size or hugs its children along one of its axes. */
export type AxisSizingMode = 'FIXED' | 'HUG'

export type GridTrackSizing = 'FIXED' | 'FR' | 'AUTO'

export interface GridTrack {
  sizing: GridTrackSizing
  value: number
}

export interface GridPosition {
  column: number
  row: number
  columnSpan: number
  rowSpan: number
}
export type LayoutAlign = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
export type LayoutCounterAlign = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'BASELINE'
export type LayoutAlignSelf = 'AUTO' | 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'BASELINE'
export type LayoutWrap = 'NO_WRAP' | 'WRAP'

export interface PluginDataEntry {
  pluginId: string
  key: string
  value: string
}

export interface ExportSetting {
  scale: number
  format: ExportFormatId
}

export interface PluginRelaunchDataEntry {
  pluginId: string
  command: string
  message: string
  isDeleted: boolean
}

/**
 * One derived glyph outline for display (path text / missing-font fidelity).
 * Figma import is one producer; OpenPencil editing and reflow can regenerate it.
 * commandsBlob is in font units; paint multiplies by fontSize (and scaleX/Y).
 */
export interface TextPathData {
  network: VectorNetwork
  normalizedSize: Vector
  tValue: number
  forward: boolean
}

export interface DerivedTextGlyph {
  /** UTF-16 source-text cluster start, when supplied by the shaping source. */
  firstCharacter?: number
  commandsBlob: Uint8Array
  x: number
  y: number
  fontSize: number
  /** Figma Glyph.rotation — radians, not degrees. Zero for axis-aligned text. */
  rotation?: number
  /**
   * Horizontal advance in pixels at `fontSize`, before `scaleX`, when the shaping source gave
   * one; where the glyph ends, so decorations stop at the text rather than the layer's edge.
   */
  advance?: number
  /**
   * Accumulated non-uniform resize scale (default 1). Paint order is
   * translate → scale(scaleX,Y) → rotate → scale(fontSize,-fontSize) so
   * anisotropic stretch matches scaleGeometryPaths(strokeGeometry).
   * Do not fold this into fontSize or rotated letters desync from outlines.
   */
  scaleX?: number
  scaleY?: number
}

export interface SymbolLink {
  uri: string
  displayName?: string
  displayText?: string
}

export interface VariantPropSpec {
  propDefId: string
  value: string
}

export type FigmaLayoutMetadata = Partial<
  Record<
    | 'stackMode'
    | 'stackCounterAlign'
    | 'stackJustify'
    | 'stackCounterAlignItems'
    | 'stackPrimaryAlignItems'
    | 'stackPrimarySizing'
    | 'stackCounterSizing'
    | 'stackWrap'
    | 'stackPositioning'
    | 'stackChildAlignSelf',
    string
  > &
    Record<
      | 'stackSpacing'
      | 'stackPadding'
      | 'stackPaddingRight'
      | 'stackPaddingBottom'
      | 'stackVerticalPadding'
      | 'stackHorizontalPadding'
      | 'stackChildPrimaryGrow'
      | 'stackCounterSpacing',
      number
    > &
    Record<'bordersTakeSpace' | 'stackReverseZIndex', boolean>
>

export interface LibraryAssetIdentity {
  libraryId: string
  assetKey: string
  revisionId: string
}

export interface LibraryAssetSource {
  identity: LibraryAssetIdentity
  sourceNodeId: string | null
  readOnly: boolean
}

export interface EnabledLibraryBinding {
  libraryId: string
  revisionId: string
  enabled: boolean
}

/** The library a document publishes as. */
export interface SourceLibraryPublication {
  libraryId: string
  revisionId: string
  name: string
  catalogSource?: string
}

export interface SceneNode {
  id: string
  type: NodeType
  name: string
  parentId: string | null
  childIds: string[]

  x: number
  y: number
  width: number
  height: number
  rotation: number
  source: SourceMetadata
  /** Materialized layout hint imported or generated outside the live Yoga layout pass. */
  derivedLayout: Partial<Rect> | null

  fills: Fill[]
  strokes: Stroke[]
  effects: Effect[]
  layoutGrids: LayoutGrid[]
  guides: CanvasGuide[]
  fillStyleId: string | null
  strokeStyleId: string | null
  textStyleId: string | null
  effectStyleId: string | null
  gridStyleId: string | null
  sharedStyleType: SharedStyleType | null
  opacity: number

  cornerRadius: number
  topLeftRadius: number
  topRightRadius: number
  bottomRightRadius: number
  bottomLeftRadius: number
  independentCorners: boolean
  cornerSmoothing: number

  visible: boolean
  locked: boolean
  clipsContent: boolean

  blendMode: BlendMode

  text: string
  fontSize: number
  fontFamily: string
  fontWeight: number
  italic: boolean
  textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textDirection: TextDirection
  textLanguage: string | null
  textAlignVertical: TextAlignVertical
  textAutoResize: TextAutoResize
  textCase: TextCase
  textDecoration: TextDecoration
  textDecorationStyle: TextDecorationStyle
  textDecorationThickness: number | null
  textDecorationFills: Fill[]
  textDecorationSkipInk: boolean
  textUnderlineOffset: number | null
  leadingTrim: LeadingTrim
  lineHeight: number | null
  letterSpacing: number
  maxLines: number | null

  styleRuns: StyleRun[]
  fontVariations: FontVariation[]
  fontFeatures: FontFeature[]

  horizontalConstraint: ConstraintType
  verticalConstraint: ConstraintType

  layoutMode: LayoutMode
  layoutDirection: LayoutDirection
  layoutWrap: LayoutWrap
  primaryAxisAlign: LayoutAlign
  counterAxisAlign: LayoutCounterAlign
  primaryAxisSizing: AxisSizingMode
  counterAxisSizing: AxisSizingMode
  itemSpacing: number
  counterAxisSpacing: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number

  layoutPositioning: 'AUTO' | 'ABSOLUTE'
  layoutGrow: number
  layoutAlignSelf: LayoutAlignSelf

  vectorNetwork: VectorNetwork | null
  handleMirroring: HandleMirroring
  booleanOperation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE' | undefined
  fillGeometry: GeometryPath[]
  strokeGeometry: GeometryPath[]

  arcData: ArcData | null

  strokeCap: StrokeCap
  strokeJoin: StrokeJoin
  dashPattern: number[]

  borderTopWeight: number
  borderRightWeight: number
  borderBottomWeight: number
  borderLeftWeight: number
  independentStrokeWeights: boolean

  /**
   * The weight and alignment a node keeps for its strokes, as Figma keeps them on the node: they
   * last while it has no strokes, and a stroke added to it takes them. Each stroke still carries
   * its own `weight` and `align`, which win while the node has strokes.
   */
  strokeWeight: number
  strokeAlign: Stroke['align']

  strokeMiterLimit: number

  minWidth: number | null
  maxWidth: number | null
  minHeight: number | null
  maxHeight: number | null

  isMask: boolean
  maskType: MaskType
  maskIsOutline: boolean

  gridTemplateColumns: GridTrack[]
  gridTemplateRows: GridTrack[]
  gridColumnGap: number
  gridRowGap: number
  gridPosition: GridPosition | null

  counterAxisAlignContent: 'AUTO' | 'SPACE_BETWEEN'
  itemReverseZIndex: boolean
  strokesIncludedInLayout: boolean

  expanded: boolean
  textTruncation: 'DISABLED' | 'ENDING'
  autoRename: boolean

  pointCount: number
  starInnerRadius: number

  componentId: string | null
  instanceOverrides: InstanceOverrideState
  componentPropertyDefinitions: ComponentPropertyDefinition[]
  componentPropertyReferences: ComponentPropertyReference[]
  componentPropertyAssignments: Record<string, string>
  componentPropertyValues: Record<string, string>
  componentKey: string | null
  sourceLibraryKey: string | null
  publishId: string | null
  overrideKey: string | null
  sharedSymbolVersion: string | null
  publishedVersion: string | null
  librarySource: LibraryAssetSource | null
  isPublishable: boolean
  isSymbolPublishable: boolean
  /**
   * On an instance inside a component: its properties show on instances of that component,
   * as Figma's `isExposedInstance`.
   */
  isExposedInstance: boolean
  symbolDescription: string
  symbolLinks: SymbolLink[]
  variantPropSpecs: VariantPropSpec[]

  boundVariables: Record<string, string>
  /** Multipliers from bound numeric values to this occurrence's scene units. */
  variableBindingScales: Partial<Record<string, number>>
  /** Numeric units for new declarations owned by this node's occurrence scope. */
  variableAssignmentScales: Partial<Record<string, number>>
  /** Explicit coordinate scale relative to the containing component definition. */
  componentScale: number
  variableModes: VariableModeMap
  exportSettings: ExportSetting[]

  pluginData: PluginDataEntry[]
  pluginRelaunchData: PluginRelaunchDataEntry[]

  internalOnly: boolean

  flipX: boolean
  flipY: boolean

  textPicture: Uint8Array | null
  derivedTextGlyphs: DerivedTextGlyph[] | null
  /** Format-neutral layout path for text-on-path nodes. */
  textPathData: TextPathData | null
  /** Node-local box that maps textPathData into the node coordinate space. */
  textPathBox: Rect | null
}

export type ComponentPropertyType = 'VARIANT' | 'TEXT' | 'BOOLEAN' | 'INSTANCE_SWAP' | 'SLOT'

/** `SLOT_CONTENT` marks a frame whose children are the slot's content. */
export type ComponentPropertyReferenceField = 'VISIBLE' | 'TEXT' | 'INSTANCE_SWAP' | 'SLOT_CONTENT'

export interface ComponentPropertyReference {
  propertyId: string
  field: ComponentPropertyReferenceField
}

/** Guidance for a slot property; Figma reports a breach but still accepts the content. */
export interface SlotSettings {
  minChildren?: number
  maxChildren?: number
  allowPreferredValuesOnly: boolean
  displayEmptyByDefault: boolean
  /** Content added to the slot fills its counter axis. */
  stretchChildOnInsert: boolean
}

/**
 * For a `SLOT` property, an instance assignment (whatever its value) means the instance owns
 * that slot's content: the slot frame's children in the instance, which component sync keeps.
 */
export interface ComponentPropertyDefinition {
  id: string
  name: string
  type: ComponentPropertyType
  defaultValue: string
  variantOptions?: string[]
  preferredValues?: string[]
  description?: string
  slotSettings?: SlotSettings
}

export type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
export type VariableValue = Color | number | string | boolean | { aliasId: string }
export type VariableModeMap = Record<string, string>

/** Property pickers a variable is offered in, as Figma names them. */
export const VARIABLE_SCOPES = [
  'ALL_SCOPES',
  'TEXT_CONTENT',
  'CORNER_RADIUS',
  'WIDTH_HEIGHT',
  'GAP',
  'ALL_FILLS',
  'FRAME_FILL',
  'SHAPE_FILL',
  'TEXT_FILL',
  'STROKE',
  'STROKE_FLOAT',
  'EFFECT_FLOAT',
  'EFFECT_COLOR',
  'OPACITY',
  'FONT_STYLE',
  'FONT_FAMILY',
  'FONT_SIZE',
  'LINE_HEIGHT',
  'LETTER_SPACING',
  'PARAGRAPH_SPACING',
  'PARAGRAPH_INDENT',
  'FONT_VARIATIONS',
  'TRANSFORM'
] as const
export type VariableScope = (typeof VARIABLE_SCOPES)[number]

export const CODE_SYNTAX_PLATFORMS = ['WEB', 'ANDROID', 'iOS'] as const
export type CodeSyntaxPlatform = (typeof CODE_SYNTAX_PLATFORMS)[number]

/**
 * The CSS unit a numeric token is written in. Lengths (`px`, `rem`) stay in canvas pixels in
 * the document and convert only when written as CSS; the other units store the number as written.
 */
export const TOKEN_UNITS = ['none', 'px', 'rem', '%', 'ms', 's', 'deg'] as const
export type TokenUnit = (typeof TOKEN_UNITS)[number]

/** A mode value authored as raw CSS. `resolved` is the number the canvas drew for it. */
export interface TokenExpression {
  css: string
  resolved: number
}

export interface Variable {
  id: string
  name: string
  type: VariableType
  collectionId: string
  valuesByMode: Record<string, VariableValue>
  description: string
  hiddenFromPublishing: boolean
  /** Absent means every scope. */
  scopes?: VariableScope[]
  /**
   * Per-platform code snippets, as Figma's Dev Mode shows them. A `WEB` snippet of `--x` or
   * `var(--x)` names the token's CSS custom property; otherwise the name is derived.
   */
  codeSyntax?: Partial<Record<CodeSyntaxPlatform, string>>
  /** FLOAT only. Absent means inferred when written as CSS. */
  unit?: TokenUnit
  /** Raw CSS by mode id, for values a number cannot express (`clamp()`, `calc()`). */
  expressions?: Record<string, TokenExpression>
  pluginData?: PluginDataEntry[]
  /** Published library key (from NodeChange.key). Used for assetRef resolution in colorVar. */
  key?: string
  /** Published library version (from NodeChange.version). Used for assetRef resolution in colorVar. */
  version?: string
}

/** Scalar numeric node fields accepted by numeric property controls. */
export type NumericNodeProperty = {
  [K in keyof SceneNode]-?: SceneNode[K] extends number ? K : never
}[keyof SceneNode]

export interface VariableCollectionMode {
  modeId: string
  name: string
  /**
   * Where the mode applies in CSS: a selector (`[data-theme="dark"]`, `.compact`) or an
   * at-rule prelude (`@media (max-width: 640px)`). Absent means the default for its axis.
   */
  condition?: string
}

export interface VariableCollection {
  id: string
  name: string
  /** The default mode comes first, as in Figma. */
  modes: VariableCollectionMode[]
  defaultModeId: string
  variableIds: string[]
  /**
   * The attribute that switches a mode with no condition of its own, `data-theme` for
   * `[data-theme="dark"]`. Absent means one named after the collection.
   */
  modeAttribute?: string
  pluginData?: PluginDataEntry[]
}

/** An HTML attribute name a stylesheet can select on unescaped: `data-theme`, `theme`. */
export const MODE_ATTRIBUTE_PATTERN = /^[A-Za-z_][\w-]*$/

export function isModeAttributeName(name: string): boolean {
  return name.length <= 100 && MODE_ATTRIBUTE_PATTERN.test(name)
}
