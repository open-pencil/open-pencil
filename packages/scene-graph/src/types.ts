import type { Color, Matrix, Rect, Vector } from './primitives'

export interface SceneGraphEvents {
  'node:created': (node: SceneNode) => void
  'node:updated': (id: string, changes: Partial<SceneNode>) => void
  'node:previewUpdated': (id: string, changes: Partial<SceneNode>) => void
  'node:deleted': (id: string) => void
  'node:reparented': (nodeId: string, oldParentId: string | null, newParentId: string) => void
  'node:reordered': (nodeId: string, parentId: string, index: number) => void
}

export type SceneGraphEventHandlers = Partial<{
  created: (node: SceneNode) => void
  updated: (id: string, changes: Partial<SceneNode>) => void
  previewUpdated: (id: string, changes: Partial<SceneNode>) => void
  deleted: (id: string) => void
  reparented: (nodeId: string, oldParentId: string | null, newParentId: string) => void
  reordered: (nodeId: string, parentId: string, index: number) => void
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
  /**
   * Original Figma Kiwi NodeType when it differs from the engine type
   * (e.g. TEXT_PATH → TEXT). Used to re-export the native type for unedited imports.
   */
  kiwiNodeType: string | null
}

export interface SourceMetadata {
  format: 'fig' | null
  id: string | null
  orderKey: string | null
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
export type MaskType = 'ALPHA' | 'VECTOR' | 'LUMINANCE'

export interface Stroke {
  color: Color
  weight: number
  opacity: number
  visible: boolean
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
export type LayoutSizing = 'FIXED' | 'HUG' | 'FILL'

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

export type ExportFormatId = 'png' | 'jpg' | 'webp' | 'svg' | 'pdf'

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

export interface FigmaDerivedTextGlyph {
  commandsBlob: Uint8Array
  x: number
  y: number
  fontSize: number
  /** Per-glyph rotation from Figma derivedTextData (radians). Used for text-on-path. */
  rotation?: number
  /**
   * Non-uniform geometric scale from resize (default 1). Applied after translate
   * and before rotation so stretched path text matches scaled strokeGeometry.
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
  figmaDerivedLayout: Partial<Rect> | null

  fills: Fill[]
  strokes: Stroke[]
  effects: Effect[]
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
  primaryAxisSizing: LayoutSizing
  counterAxisSizing: LayoutSizing
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
  booleanOperation?: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE'
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
  overrides: Record<string, unknown>
  componentPropertyDefinitions: ComponentPropertyDefinition[]
  componentPropertyValues: Record<string, string>
  componentKey: string | null
  sourceLibraryKey: string | null
  publishId: string | null
  overrideKey: string | null
  sharedSymbolVersion: string | null
  publishedVersion: string | null
  isPublishable: boolean
  isSymbolPublishable: boolean
  symbolDescription: string
  symbolLinks: SymbolLink[]
  variantPropSpecs: VariantPropSpec[]

  boundVariables: Record<string, string>
  exportSettings: ExportSetting[]

  pluginData: PluginDataEntry[]
  pluginRelaunchData: PluginRelaunchDataEntry[]

  internalOnly: boolean

  flipX: boolean
  flipY: boolean

  textPicture: Uint8Array | null
  figmaDerivedTextGlyphs: FigmaDerivedTextGlyph[] | null
}

export type ComponentPropertyType = 'VARIANT' | 'TEXT' | 'BOOLEAN' | 'INSTANCE_SWAP'

export interface ComponentPropertyDefinition {
  id: string
  name: string
  type: ComponentPropertyType
  defaultValue: string
  variantOptions?: string[]
}

export type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
export type VariableValue = Color | number | string | boolean | { aliasId: string }

export interface Variable {
  id: string
  name: string
  type: VariableType
  collectionId: string
  valuesByMode: Record<string, VariableValue>
  description: string
  hiddenFromPublishing: boolean
  /** Published library key (from NodeChange.key). Used for assetRef resolution in colorVar. */
  key?: string
  /** Published library version (from NodeChange.version). Used for assetRef resolution in colorVar. */
  version?: string
}

export interface VariableCollectionMode {
  modeId: string
  name: string
}

export interface VariableCollection {
  id: string
  name: string
  modes: VariableCollectionMode[]
  defaultModeId: string
  variableIds: string[]
}
