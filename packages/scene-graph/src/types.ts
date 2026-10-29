/* eslint-disable max-lines -- scene node contracts are kept together as the public graph type surface */

import type { ExportFormatId } from './export-format'
import type { CanvasGuide } from './guides'
import type { InstanceOverrideState } from './instances/overrides'
import type { Color, Matrix, Rect, Vector } from './primitives'
import type { ShapeWithTextType } from './shape-with-text/kinds'

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

/** Hears about nodes as an edit adds and changes them, synchronously and before each change. */
export interface NodeChangeObserver {
  /** A node is about to change and is still as it was. */
  before: (node: SceneNode) => void
  /** A node was just added. */
  created: (node: SceneNode) => void
}

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
  | 'STICKY'

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
  /** A crop's image-space window; Fill, Fit and Tile ignore it. */
  imageTransform?: GradientTransform
  /** Clockwise turn of a Fill, Fit or Tile image, in multiples of 90°; a crop holds its own. */
  imageRotation?: number
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

export type StrokeCap =
  | 'NONE'
  | 'ROUND'
  | 'SQUARE'
  | 'ARROW_LINES'
  | 'ARROW_EQUILATERAL'
  | 'TRIANGLE_FILLED'
  | 'DIAMOND_FILLED'
  | 'CIRCLE_FILLED'
export type StrokeJoin = 'MITER' | 'BEVEL' | 'ROUND'
export type SharedStyleType = 'FILL' | 'TEXT' | 'EFFECT' | 'GRID'
export type SharedStyleKind = 'fill' | 'stroke' | 'text' | 'effect' | 'grid'
export type MaskType = 'ALPHA' | 'VECTOR' | 'LUMINANCE'

export interface LayoutGrid {
  visible?: boolean
  color?: Color
  /** `STRIPES` is the archive's name for columns or rows, along `axis`. */
  pattern?: 'COLUMNS' | 'ROWS' | 'GRID' | 'STRIPES'
  axis?: 'X' | 'Y'
  type?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH'
  alignment?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH'
  numSections?: number
  /** Figma's plugin API reports an Auto count as `null` and accepts `Infinity` for it. */
  count?: number | null
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

/** Where a connector end attaches to a layer: a side, the side Figma picks, or a fixed point. */
export type ConnectorMagnet =
  | 'NONE'
  | 'AUTO'
  | 'AUTO_HORIZONTAL'
  | 'TOP'
  | 'RIGHT'
  | 'BOTTOM'
  | 'LEFT'
  | 'CENTER'
  | 'EDGE'
  | 'ABSOLUTE'

/**
 * One end of a connector. Bound to a layer, it follows the layer by `magnet`, or by `position`
 * in the layer's own axes when the magnet is `NONE`. Free, `nodeId` is null and `position` is in
 * the connector's parent's axes.
 */
export interface ConnectorEndpoint {
  nodeId: string | null
  magnet: ConnectorMagnet
  position: Vector
}

export type ConnectorLineType = 'ELBOWED' | 'STRAIGHT' | 'CURVED'

/**
 * A segment of an elbow connector that was dragged into place: the line it runs along, through
 * `position`, in the connector's own axes. `position` lies midway along the segment as last drawn.
 */
export interface ConnectorControlPoint {
  position: Vector
  direction: 'HORIZONTAL' | 'VERTICAL'
}

/**
 * Where a connector's label was dragged along its line: `offset` of the way from the middle of
 * the line towards one end, by length, on the line or to one side of it. `ABOVE` is the side to
 * the left of the line's direction.
 */
export interface ConnectorLabelPosition {
  section: 'MIDDLE_TO_START' | 'MIDDLE_TO_END'
  offset: number
  offAxis: 'NONE' | 'ABOVE' | 'BELOW'
}
export type TextAlignVertical = 'TOP' | 'CENTER' | 'BOTTOM'
export type TextCase = 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE'
export type TextDecoration = 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH'
export type TextDecorationStyle = 'SOLID' | 'DOTTED' | 'WAVY'
export type LeadingTrim = 'NONE' | 'CAP_HEIGHT'
export type TextDirection = 'AUTO' | 'LTR' | 'RTL'
export type LayoutDirection = 'AUTO' | 'LTR' | 'RTL'
/** Whether a paragraph is an item of a numbered list, a bulleted list, or no list. */
export type TextListType = 'NONE' | 'ORDERED' | 'UNORDERED'

/** How one paragraph of a text node (a line ending at a newline) sits in a list. */
/** Spacing a text sets for all its paragraphs and a paragraph can set for itself. */
export type TextParagraphSpacingField = 'listSpacing' | 'paragraphSpacing' | 'paragraphIndent'

export interface TextParagraphStyle {
  listType: TextListType
  /** Nesting level: 1–5 for list items; kept but not drawn for plain paragraphs. */
  indentation: number
  /** This paragraph's own spacing, in place of the text's; absent ones follow the text. */
  listSpacing?: number
  paragraphSpacing?: number
  paragraphIndent?: number
}

export interface FontVariation {
  axis: string
  value: number
}

export interface FontFeature {
  tag: string
  enabled: boolean
}

/** Where a stretch of text links to, as Figma's `HyperlinkTarget`: a URL, or a node by its ID. */
export interface HyperlinkTarget {
  type: 'URL' | 'NODE'
  value: string
}

/** The text fields a range of characters can bind to a variable, as Figma lists them. */
export const TEXT_BINDABLE_FIELDS = [
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'paragraphSpacing',
  'paragraphIndent'
] as const

export type TextBindableField = (typeof TEXT_BINDABLE_FIELDS)[number]

/** Variable IDs bound to text fields, by field. */
export type TextBoundVariables = Partial<Record<TextBindableField, string>>

/**
 * A line height or letter spacing as Figma keeps it: pixels, or a percent of the font size that
 * follows the size when it changes.
 */
export interface TextLength {
  value: number
  unit: 'PIXELS' | 'PERCENT'
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
  letterSpacing?: TextLength
  /** `null` is automatic, from the font. */
  lineHeight?: TextLength | null
  fills?: Fill[]
  fontVariations?: FontVariation[]
  /** Whether the characters' optical size follows their font size, in place of the text's own. */
  opticalSizeFromFontSize?: boolean
  fontFeatures?: FontFeature[]
  textLanguage?: string | null
  textCase?: TextCase
  /** A link over the characters; `null`, like leaving it out, links nowhere. */
  hyperlink?: HyperlinkTarget | null
  /** The text style the characters use in place of the text's own; `null` uses none. */
  textStyleId?: string | null
  /** The fill style the characters use in place of the text's own; `null` uses none. */
  fillStyleId?: string | null
  /** The characters' text field bindings, in place of the text's own. */
  boundVariables?: TextBoundVariables
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
  /** Where on the start segment the text starts, from 0 at its start to 1 at its end. */
  tValue: number
  forward: boolean
  /** The segment the text starts on, which Figma marks in the network blob; 0 when unmarked. */
  startSegment?: number
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
  /**
   * The code points of the emoji this glyph stands for, sequence and all. Its outline is only a
   * placeholder square a 1 em wide; the emoji's image is drawn there instead, as Figma does.
   */
  emojiCodePoints?: number[]
  /** The image set Figma draws the emoji from, when the file names one other than Apple's. */
  emojiImageSet?: 'NOTO'
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

/** A reply in a canvas comment thread. */
export interface CommentReply {
  id: string
  author: string
  /** The author's collaboration color when they wrote it, for their avatar. */
  authorColor?: Color
  /** Markdown: bold, italic, strikethrough, links and lists. */
  text: string
  createdAt: string
  deleted?: boolean
}

/** A canvas comment thread, kept in the document's root plugin data. */
export interface CommentThread {
  id: string
  pageId: string
  /** Page name when the pin was placed, for readers of the raw data. */
  pageName?: string
  /** Top-level layer under the pin; the pin follows it when it moves. */
  nodeId?: string | null
  nodeName?: string | null
  /** Offset from the layer's top-left corner, in canvas units. */
  offsetX?: number
  offsetY?: number
  /** Canvas position when the pin was last saved; used when the layer is gone. */
  x: number
  y: number
  author: string
  /** The author's collaboration color when they wrote it, for their avatar. */
  authorColor?: Color
  /** Markdown: bold, italic, strikethrough, links and lists. */
  text: string
  createdAt: string
  /** Bumped on every change. */
  updatedAt: string
  resolved: boolean
  resolvedAt?: string | null
  /** Deleted threads stay as tombstones so a stale copy cannot bring them back. */
  deleted?: boolean
  replies: CommentReply[]
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
  /** `null` is automatic, from the font. */
  lineHeight: TextLength | null
  letterSpacing: TextLength
  maxLines: number | null
  /**
   * One entry per paragraph of `text`, in order. Missing entries are plain paragraphs, so text
   * without lists keeps this empty.
   */
  textParagraphs: TextParagraphStyle[]
  /** Space after a list item followed by another; a paragraph's own value comes first. */
  listSpacing: number
  /** Space after a paragraph other than between two list items. */
  paragraphSpacing: number
  /** Indent of the first line of each plain paragraph. */
  paragraphIndent: number
  /** Whether list markers hang outside the text box instead of indenting the items. */
  hangingList: boolean

  styleRuns: StyleRun[]
  fontVariations: FontVariation[]
  /**
   * Whether a variable font's optical size follows the font size, as Figma's "Set optical size
   * automatically" does by default; when it does not, the `opsz` in `fontVariations` applies.
   */
  opticalSizeFromFontSize: boolean
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
  /**
   * The size whose proportions the layer keeps, as Figma stores it: the width and height it had
   * when the ratio was locked, not a reduced ratio. Null leaves the proportions free.
   */
  targetAspectRatio: Vector | null

  /** A connector's ends and the line between them; null on other layers. */
  connectorStart: ConnectorEndpoint | null
  connectorEnd: ConnectorEndpoint | null
  connectorLineType: ConnectorLineType
  connectorStartCap: StrokeCap
  connectorEndCap: StrokeCap
  /**
   * An elbow connector's segments between its first and last, in order, once one was dragged;
   * empty while it routes itself. Kept, unused, while the line is straight or curved.
   */
  connectorControlPoints: ConnectorControlPoint[]
  /**
   * A curved connector's two cubic control points, in the connector's own axes, once its curve
   * was dragged; null while it curves by itself. Kept, unused, while the line is not curved.
   */
  connectorCurveHandles: [Vector, Vector] | null
  /** Where a connector's label was dragged to; null while it sits midway along the line. */
  connectorLabelPosition: ConnectorLabelPosition | null

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
  /** The FigJam kind a SHAPE_WITH_TEXT draws; its label is the node's own text. */
  shapeWithTextType: ShapeWithTextType
  /** The height a shape with text was given; it grows past it to fit its label. 0 is unset. */
  shapeUserHeight: number
  /**
   * Whether a shape with text keeps its height and cuts its label off with "…" instead of growing,
   * as FigJam does once the shape's height was set.
   */
  shapeTruncates: boolean

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
  /**
   * The id of the status a team gave the layer, a state of the document's workflow such as Ready
   * for dev. It stays while the layer sits where it cannot show one; `effectiveStatus` tells
   * whether it shows.
   */
  status: string | null

  pluginData: PluginDataEntry[]
  pluginRelaunchData: PluginRelaunchDataEntry[]

  internalOnly: boolean

  flipX: boolean
  flipY: boolean

  textPicture: Uint8Array | null
  derivedTextGlyphs: DerivedTextGlyph[] | null
  /**
   * How far a text's lines reach down from its top: measured at its width when its text or width
   * changes, or read from the lines a file saved, and never saved itself. A fixed-size box does not
   * clip them, as in Figma, so its visual bounds reach this far. Null when not known.
   */
  derivedTextHeight: number | null
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
export interface VariableAlias {
  aliasId: string
}

/** Figma's two-argument color expression; opacity is a percentage, not an alpha multiplier. */
export interface VariableColorExpression {
  expression: 'COMPOSE_COLOR'
  color: Color | VariableAlias
  opacity: number | VariableAlias
}

export type VariableLiteral = Color | number | string | boolean
/** The arithmetic, comparison, logic and conversions a formula combines values with. */
export const VARIABLE_FORMULA_OPERATORS = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'negate',
  'equal',
  'notEqual',
  'less',
  'lessOrEqual',
  'greater',
  'greaterOrEqual',
  'and',
  'or',
  'not',
  'text',
  'truthy',
  'if'
] as const
export type VariableFormulaOperator = (typeof VARIABLE_FORMULA_OPERATORS)[number]
export interface VariableFormulaOperation {
  operator: VariableFormulaOperator
  operands: VariableFormulaNode[]
}
export type VariableFormulaNode = VariableLiteral | VariableAlias | VariableFormulaOperation
export interface VariableFormula {
  expression: 'FORMULA'
  type: VariableType
  value: VariableFormulaNode
}
/**
 * An imported expression OpenPencil cannot evaluate, kept as the file wrote it so saving writes it
 * back. `references` holds one entry per alias in `value`, in the order the format walks them, and
 * `null` where the alias names a variable this document does not have. `modes` holds the mode id of
 * each mode key in `value`, in the same walk order.
 */
export interface VariableUnsupportedExpression {
  expression: 'UNSUPPORTED'
  /** The function name the file gives, such as `VAR_MODE_LOOKUP`. */
  function: string
  value: Record<string, unknown>
  references: (string | null)[]
  modes: string[]
}
export type VariableValue =
  | VariableLiteral
  | VariableAlias
  | VariableColorExpression
  | VariableFormula
  | VariableUnsupportedExpression
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

/**
 * CSS written in place of a number mode's value, such as `clamp(1rem, 4vw, 1.5rem)`. While the
 * mode holds a plain number, `resolved` records it, so a number later edited elsewhere, Figma
 * included, shows the CSS no longer describes it.
 */
export interface TokenExpression {
  css: string
  resolved?: number
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
  /** Where Figma lists the mode, as the file saved it; Figma orders a collection's modes by it. */
  sortPosition?: string
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
  /**
   * Published library key, for a collection the file copies from a library. Such a collection
   * belongs to the library: Figma lists it with the library's, not the file's own.
   */
  key?: string
  /** Published library version, which references by key carry with it. */
  version?: string
}

/** Whether a collection is a library's copy, which takes no variables or modes of the file's. */
export function isLibraryCollection(collection: Pick<VariableCollection, 'key'>): boolean {
  return !!collection.key
}

/** An HTML attribute name a stylesheet can select on unescaped: `data-theme`, `theme`. */
export const MODE_ATTRIBUTE_PATTERN = /^[A-Za-z_][\w-]*$/

export function isModeAttributeName(name: string): boolean {
  return name.length <= 100 && MODE_ATTRIBUTE_PATTERN.test(name)
}
